import { fmtNum, setText } from '../data/exercises'
import type { Exercise, FirstTest, Group, Session, SetLog } from '../data/types'
import { getExercise } from './library'

// ---------- 48 小时规则 ----------

export const FATIGUE_HOURS = 48

// 每个肌群最近一次练的时间（按实际记过的组算；腹不受限制，不返回）
export function lastTrained(logs: SetLog[], excludeSessionId?: string): Map<Group, number> {
  const m = new Map<Group, number>()
  for (const l of logs) {
    if (l.sessionId === excludeSessionId) continue
    const g = getExercise(l.exerciseId).group
    if (g === 'core') continue
    if ((m.get(g) ?? 0) < l.doneAt) m.set(g, l.doneAt)
  }
  return m
}

export function fatigueFor(groups: Group[], last: Map<Group, number>, now: number): { group: Group; hours: number }[] {
  const out: { group: Group; hours: number }[] = []
  for (const g of groups) {
    const t = last.get(g)
    if (t === undefined) continue
    const hours = (now - t) / 3_600_000
    if (hours < FATIGUE_HOURS) out.push({ group: g, hours })
  }
  return out
}

// ---------- 「上次」的成绩 ----------

const bySet = (a: SetLog, b: SetLog) => a.setNo - b.setNo || (a.side === 'R' ? 1 : 0) - (b.side === 'R' ? 1 : 0)

// 最近一次「这个动作的肌群没处于疲劳模式」的训练里，这个动作的所有组
// before：只看这个时间之前开始的训练（看历史里某一次时，「上次」要在它之前）
export function findRef(
  ex: Exercise,
  logs: SetLog[],
  sessions: Map<string, Session>,
  currentId: string,
  before?: number,
): SetLog[] | null {
  const bySession = new Map<string, SetLog[]>()
  for (const l of logs) {
    if (l.exerciseId !== ex.id || l.sessionId === currentId) continue
    const s = sessions.get(l.sessionId)
    if (!s || s.fatigued.includes(ex.group)) continue
    if (before !== undefined && s.startedAt >= before) continue
    const arr = bySession.get(l.sessionId) ?? []
    arr.push(l)
    bySession.set(l.sessionId, arr)
  }
  let best: SetLog[] | null = null
  let bestAt = -1
  for (const arr of bySession.values()) {
    const at = Math.max(...arr.map((l) => l.doneAt))
    if (at > bestAt) {
      bestAt = at
      best = arr
    }
  }
  return best ? best.sort(bySet) : null
}

// 双重渐进：上次每一组（左右都算）都到了次数上限
export function earnedProgression(ex: Exercise, ref: SetLog[] | null): boolean {
  return !!ref && ref.length > 0 && ex.repMax !== null && ref.every((l) => l.reps >= ex.repMax!)
}

export function readyForLoad(ex: Exercise, ref: SetLog[] | null): boolean {
  return !!ref && ex.loadAfterReps !== undefined && ref.some((l) => l.reps > ex.loadAfterReps!)
}

export function firstTestLoad(ft: FirstTest, reps: number): number {
  return ft.rules.find((r) => reps >= r.minReps)?.load ?? ft.testLoad
}

// ---------- 每一组的预填 ----------

export interface Banner {
  tone: 'amber' | 'sky' | 'lime'
  text: string
}

// 力竭动作（引体）：不比每组，比总次数。目标 = 上次总数 +1
export interface TotalGoal {
  ref: number // 上次（前 sets 组）一共几次
  sets: number // 比几组：两次组数不一样时只比前几组
  partial: boolean // 上次组数更多，只比了前几组
  target: number | null // 这次目标总数；疲劳模式不给
  done: number // 这次前 sets 组已经做了几次
  extra: boolean // 现在这组是多做的（超出对比的组数）
}

export interface Prefill {
  setNo: number
  load: number
  target: number | null // null = 力竭
  reps: number // 次数框默认值
  chips: number[] // 一排可以直接点的次数
  refText: string | null
  goalText: string // 记组页「→」后面：目标 9 / 目标 力竭 / 目标共 31 次
  progressText: string | null // 力竭动作第 2 组起：已做 15，还差 16
  restGoal: string // 休息页「下一个」：目标 9 / 还差 16（目标共 31）
  total?: TotalGoal
  banners: Banner[]
}

const maxSetNo = (ls: SetLog[]) => ls.reduce((m, l) => Math.max(m, l.setNo), 0)
const sumReps = (ls: SetLog[], upTo = Infinity) => ls.reduce((s, l) => (l.setNo <= upTo ? s + l.reps : s), 0)

// 两次训练比总次数：组数一样比全部；不一样只比前几组
export function totalCompare(mine: SetLog[], ref: SetLog[], plannedSets?: number) {
  const refSets = maxSetNo(ref)
  const sets = Math.min(plannedSets ?? maxSetNo(mine), refSets)
  return { sets, partial: sets < refSets, mine: sumReps(mine, sets), ref: sumReps(ref, sets), refAll: sumReps(ref), refSets }
}

function range(a: number, b: number): number[] {
  const out: number[] = []
  for (let i = a; i <= b; i++) out.push(i)
  return out
}

export function computePrefill(
  ex: Exercise,
  side: 'L' | 'R' | undefined,
  sessionLogs: SetLog[], // 这次训练里这个动作已经记的组
  ref: SetLog[] | null,
  fatigued: boolean,
  plannedSets?: number, // 这次计划做几组（这一边）；力竭动作比总次数用
): Prefill {
  const sameSide = (l: SetLog) => (l.side ?? null) === (side ?? null)
  const mine = sessionLogs.filter(sameSide).sort(bySet)
  const setNo = mine.length + 1
  const refSide = (ref ?? []).filter(sameSide)
  const refLast = refSide[refSide.length - 1] // 上次最后一组 = 上次的工作重量（首测那组不算）
  const testing = !!ex.firstTest && !ref
  const earned = !fatigued && earnedProgression(ex, ref)
  const addKg = earned && ex.unit === 'kg' && ex.addLoad ? ex.addLoad : 0
  const banners: Banner[] = []

  // 负重：本次上一组 → 上次最后一组（达标就加重）→ 首测重量 → 0
  let load: number | undefined
  if (side === 'R') load = sessionLogs.find((l) => l.side === 'L' && l.setNo === setNo)?.load
  if (load === undefined) {
    if (testing && setNo === 2 && mine[0]) load = firstTestLoad(ex.firstTest!, mine[0].reps)
    else if (mine.length) load = mine[mine.length - 1].load
    else if (refLast) load = refLast.load + addKg
    else if (testing) load = ex.firstTest!.testLoad
    else load = 0
  }

  // 「上次同一组」：只跟同样负重的组比；同负重里找组号最接近的
  const sameLoad = refSide.filter((l) => l.load === load)
  const refSame = sameLoad.length
    ? sameLoad.reduce((best, l) => (Math.abs(l.setNo - setNo) < Math.abs(best.setNo - setNo) ? l : best))
    : undefined

  // 次数目标
  let target: number | null
  if (testing && setNo === 1) target = null
  else if (testing) target = ex.repMin
  else if (addKg > 0) target = ex.repMin
  else if (ex.repMin === null && !fatigued) target = null // 力竭：每组不定目标，看总数
  else if (refSame) {
    target = fatigued ? refSame.reps : refSame.reps + 1
    if (ex.repMax !== null) target = Math.min(target, ex.repMax)
    if (ex.repMin !== null) target = Math.max(target, ex.repMin)
  } else target = ex.repMin // 换了负重或第一次做：从下限开始

  const reps = target ?? refSame?.reps ?? refLast?.reps ?? (ex.repMin !== null && ex.repMax !== null ? Math.round((ex.repMin + ex.repMax) / 2) : 5)

  let chips: number[]
  const span = ex.repMin !== null && ex.repMax !== null ? ex.repMax - ex.repMin : -1
  if (target !== null && span >= 2 && span <= 5) chips = range(ex.repMin!, ex.repMax!)
  else {
    const lo = Math.max(1, reps - 2)
    chips = range(lo, lo + 4)
  }

  // 提示条
  if (fatigued) banners.push({ tone: 'amber', text: '疲劳模式：每组留 1-2 个，别做到力竭' })
  if (testing && setNo === 1) {
    banners.push({ tone: 'sky', text: `第一次做：背 ${fmtNum(ex.firstTest!.testLoad)}kg 做到力竭，后面的重量 App 来定` })
  }
  if (testing && setNo === 2 && mine[0]) {
    banners.push({ tone: 'sky', text: `测出 ${mine[0].reps} 次 → 后面用 ${fmtNum(load)}kg` })
  }
  if (setNo === 1 && side !== 'R' && earned) {
    if (addKg > 0) {
      banners.push({ tone: 'lime', text: `上次每组都到 ${ex.repMax} 次 → 加重 ${ex.addLoadText ?? `+${fmtNum(addKg)}kg`}，次数从 ${ex.repMin} 练回来` })
    } else if (ex.progressTip) {
      banners.push({ tone: 'lime', text: `上次每组都到顶 → ${ex.progressTip}` })
    }
  }
  if (setNo === 1 && side !== 'R' && !fatigued && readyForLoad(ex, ref)) {
    banners.push({ tone: 'lime', text: `上次有一组超过 ${ex.loadAfterReps} 个 → 可以背背包了（${ex.addLoadText ?? '+1–2kg'}）` })
  }

  let refText: string | null = null
  const shown = refSame ?? refLast
  if (shown) refText = `上次 ${setText(ex, shown.load, shown.reps)}`
  else if (!testing) refText = '第一次做'

  let goalText = `目标 ${target ?? '力竭'}`
  let restGoal = goalText
  let progressText: string | null = null
  let total: TotalGoal | undefined
  if (ex.repMin === null && !testing && ref?.length) {
    const cmp = totalCompare(sessionLogs, ref, plannedSets ?? maxSetNo(ref))
    total = {
      ref: cmp.ref,
      sets: cmp.sets,
      partial: cmp.partial,
      target: fatigued ? null : cmp.ref + 1,
      done: cmp.mine,
      extra: setNo > cmp.sets,
    }
    refText = cmp.partial ? `上次前 ${cmp.sets} 组共 ${cmp.ref} 次` : `上次共 ${cmp.ref} 次`
    if (total.target !== null) {
      const left = total.target - total.done
      goalText = `目标共 ${total.target} 次`
      restGoal = total.done === 0 ? goalText : left > 0 ? `还差 ${left}（目标共 ${total.target}）` : `已达标 ✓ 共 ${total.done}`
      if (total.extra) progressText = `前 ${total.sets} 组共 ${total.done} 次${left > 0 ? `，差 ${left} 没到目标` : ' ✓'} · 这组是多做的`
      else if (total.done > 0) progressText = left > 0 ? `已做 ${total.done}，还差 ${left}` : `已做 ${total.done}，已经超过目标 ✓`
    }
  }

  return { setNo, load, target, reps, chips, refText, goalText, progressText, restGoal, total, banners }
}

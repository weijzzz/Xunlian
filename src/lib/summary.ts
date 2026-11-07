import { fmtNum } from '../data/exercises'
import type { Exercise, Session, SetLog } from '../data/types'
import { getExercise } from './library'
import { earnedProgression, findRef, readyForLoad, totalCompare } from './progress'

// 一次训练的总结：每个动作的成绩、该加重的、跟上次比

export type Trend = 'better' | 'same' | 'worse' | 'first' | 'fatigued' | 'harder' // harder = 变难了、次数少了，不算退步

export interface ExerciseSummary {
  ex: Exercise
  logs: SetLog[]
  fatigued: boolean
  harder: boolean // 这次打了「变难了」
  totalReps: number
  maxLoad: number
  advice: string | null // 下次怎么加难
  trend: Trend
  trendText: string
}

export interface SessionSummary {
  minutes: number
  sets: number
  reps: number
  exercises: ExerciseSummary[]
}

const bySet = (a: SetLog, b: SetLog) => a.setNo - b.setNo || (a.side === 'R' ? 1 : 0) - (b.side === 'R' ? 1 : 0)
const key = (l: SetLog) => `${l.setNo}-${l.side ?? ''}`
const unitOf = (ex: Exercise) => (ex.unit === 'cm' ? 'cm' : 'kg')

function advice(ex: Exercise, logs: SetLog[], maxLoad: number): string | null {
  if (readyForLoad(ex, logs)) return `有一组超过 ${ex.loadAfterReps} 个 → 下次可以背背包（${ex.addLoadText ?? '+1–2kg'}）`
  if (!earnedProgression(ex, logs)) return null
  if (ex.unit === 'kg' && ex.addLoad) {
    return `每组都到 ${ex.repMax} 次 → 下次 ${fmtNum(maxLoad)} → ${fmtNum(maxLoad + ex.addLoad)}kg`
  }
  if (ex.progressTip) return `每组都到 ${ex.repMax} 次 → ${ex.progressTip}`
  return `每组都到 ${ex.repMax} 次`
}

function compare(ex: Exercise, logs: SetLog[], ref: SetLog[] | null, maxLoad: number): { trend: Trend; text: string } {
  if (!ref || !ref.length) return { trend: 'first', text: '第一次做' }
  if (ex.unit !== 'none') {
    const refMax = Math.max(...ref.map((l) => l.load))
    const d = maxLoad - refMax
    if (Math.abs(d) >= 0.01) {
      return d > 0 ? { trend: 'better', text: `+${fmtNum(d)}${unitOf(ex)}` } : { trend: 'worse', text: `−${fmtNum(-d)}${unitOf(ex)}` }
    }
  }
  // 力竭动作（引体）：比总次数；组数不一样只比前几组
  if (ex.repMin === null) {
    const c = totalCompare(logs, ref)
    const all = logs.reduce((s, l) => s + l.reps, 0)
    const sameSets = c.sets === c.refSets && logs.every((l) => l.setNo <= c.sets)
    const text = sameSets ? `共 ${all} 次 · 上次 ${c.refAll}` : `前 ${c.sets} 组 ${c.mine} · 上次 ${c.ref}`
    const d = c.mine - c.ref
    return { trend: d > 0 ? 'better' : d < 0 ? 'worse' : 'same', text }
  }
  // 负重一样：比同一组（同组号、同边、同负重）的次数；对不上就比每组平均
  const refMap = new Map(ref.map((l) => [key(l), l]))
  const pairs = logs.map((l) => [l, refMap.get(key(l))] as const).filter(([l, r]) => r && r.load === l.load)
  let diff: number
  if (pairs.length) diff = pairs.reduce((s, [l, r]) => s + l.reps - r!.reps, 0)
  else {
    const avg = (xs: SetLog[]) => xs.reduce((s, l) => s + l.reps, 0) / xs.length
    diff = Math.round(avg(logs) - avg(ref))
  }
  if (diff > 0) return { trend: 'better', text: `多 ${diff} 次` }
  if (diff < 0) return { trend: 'worse', text: `少 ${-diff} 次` }
  return { trend: 'same', text: '持平' }
}

export function summarize(session: Session, logs: SetLog[], history: SetLog[], sessions: Map<string, Session>): SessionSummary {
  const order: string[] = []
  const byEx = new Map<string, SetLog[]>()
  for (const l of [...logs].sort((a, b) => a.doneAt - b.doneAt)) {
    if (!byEx.has(l.exerciseId)) order.push(l.exerciseId)
    byEx.set(l.exerciseId, [...(byEx.get(l.exerciseId) ?? []), l])
  }

  const exercises = order.map((id): ExerciseSummary => {
    const ex = getExercise(id)
    const ls = byEx.get(id)!.sort(bySet)
    const fatigued = session.fatigued.includes(ex.group)
    const maxLoad = Math.max(...ls.map((l) => l.load))
    const totalReps = ls.reduce((s, l) => s + l.reps, 0)
    const ref = findRef(ex, history, sessions, session.id, session.startedAt)
    const harder = (session.harder ?? []).includes(id)
    let cmp: { trend: Trend; text: string } = fatigued ? { trend: 'fatigued', text: '疲劳模式，不算退步' } : compare(ex, ls, ref, maxLoad)
    if (harder && cmp.trend === 'worse') cmp = { trend: 'harder', text: '变难了' }
    return {
      ex,
      logs: ls,
      fatigued,
      harder,
      totalReps,
      maxLoad,
      advice: fatigued ? null : advice(ex, ls, maxLoad),
      trend: cmp.trend,
      trendText: cmp.text,
    }
  })

  const end = session.endedAt ?? Math.max(session.startedAt, ...logs.map((l) => l.doneAt))
  return {
    minutes: Math.max(0, Math.round((end - session.startedAt) / 60000)),
    sets: logs.length,
    reps: logs.reduce((s, l) => s + l.reps, 0),
    exercises,
  }
}

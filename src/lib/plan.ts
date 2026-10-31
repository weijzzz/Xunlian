import { REST, restBetween, restDefault } from '../data/templates'
import type { Block, Cursor } from '../data/types'
import { getExercise } from './library'

// 把训练卡展开成一步一步：块 → 轮 → 动作 → 左右
export interface PlanStep {
  b: number // 第几块（①②③）
  r: number // 第几轮（从 1 开始）
  s: number // 块里第几个动作
  side?: 'L' | 'R'
  rounds: number // 这一块一共几轮
  exerciseId: string
  restAfter: number // 做完这一步休息几秒（最后一步 = 0）
  finisher: boolean
}

export function buildPlan(blocks: Block[]): PlanStep[] {
  const steps: PlanStep[] = []
  blocks.forEach((block, b) => {
    const rounds = Math.max(0, ...block.slots.map((x) => x.sets))
    for (let r = 1; r <= rounds; r++) {
      block.slots.forEach((slot, s) => {
        if (slot.sets < r) return
        const base = { b, r, s, rounds, exerciseId: slot.exerciseId, restAfter: 0, finisher: !!block.finisher }
        if (getExercise(slot.exerciseId).sided === 'LR') {
          steps.push({ ...base, side: 'L' }, { ...base, side: 'R' })
        } else {
          steps.push(base)
        }
      })
    }
  })

  for (let i = 0; i < steps.length - 1; i++) {
    const cur = steps[i]
    const next = steps[i + 1]
    if (cur.side === 'L' && next.side === 'R' && cur.b === next.b && cur.r === next.r && cur.s === next.s) {
      cur.restAfter = REST.sideSwitch
    } else if (next.b !== cur.b) {
      cur.restAfter = REST.nextBlock
    } else if (cur.finisher) {
      cur.restAfter = REST.finisher
    } else {
      cur.restAfter = restDefault(restBetween(getExercise(cur.exerciseId).group, getExercise(next.exerciseId).group))
    }
  }
  return steps
}

// ---------- 光标定位 ----------

function key(x: { b: number; r: number; s: number; side?: 'L' | 'R' }): number[] {
  return [x.b, x.r, x.s, x.side === 'R' ? 1 : 0]
}

function cmp(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return 0
}

// 找光标对应的步骤；那一步被删掉了就找它后面的第一步。-1 = 已经没有后面的了
export function stepIndex(plan: PlanStep[], c: Pick<Cursor, 'b' | 'r' | 's' | 'side'>): number {
  const k = key(c)
  return plan.findIndex((st) => cmp(key(st), k) >= 0)
}

export function cursorAt(st: PlanStep): Pick<Cursor, 'b' | 'r' | 's' | 'side'> {
  return { b: st.b, r: st.r, s: st.s, side: st.side }
}

// ---------- 预计时间 ----------

const SEC_PER_REP = 4.5
const SETUP_SEC = 10

export function setSeconds(exerciseId: string): number {
  const ex = getExercise(exerciseId)
  const reps = ex.repMin !== null && ex.repMax !== null ? (ex.repMin + ex.repMax) / 2 : 8
  return reps * SEC_PER_REP + SETUP_SEC
}

export function warmupMinutes(short: boolean): number {
  return short ? 3 : 5
}

export function estimateMinutes(blocks: Block[], short: boolean): number {
  const plan = buildPlan(blocks)
  const sec = plan.reduce((t, st) => t + setSeconds(st.exerciseId) + st.restAfter, 0)
  return Math.round(sec / 60 + warmupMinutes(short))
}

// 光标之后（严格之后）的第一步；-1 = 没有了
export function nextAfter(plan: PlanStep[], c: Pick<Cursor, 'b' | 'r' | 's' | 'side'>): number {
  const k = key(c)
  return plan.findIndex((st) => cmp(key(st), k) > 0)
}

import { getExercise } from './exercises'
import type { Group, Pair, RestRange, Slot, Template } from './types'

// 休息规则：需求文档 5.1
export const REST = {
  pair: [60, 90] as RestRange, // 同一对两个动作之间
  legsToCore: [30, 45] as RestRange,
  coreToLegs: [45, 60] as RestRange,
  sideSwitch: [20, 30] as RestRange, // 单边：左 → 右
  finisher: 45, // ③ 收尾组间
  nextPair: 90, // 换下一对（文档没写，默认 90 秒）
}

export function restBetween(fromId: string, toId: string): RestRange {
  const from = getExercise(fromId).group
  const to = getExercise(toId).group
  if (from === 'legs' && to === 'core') return REST.legsToCore
  if (from === 'core' && to === 'legs') return REST.coreToLegs
  return REST.pair
}

// 倒计时默认取区间中间值
export function restDefault(r: RestRange): number {
  return Math.round((r[0] + r[1]) / 2 / 5) * 5
}

function pair(a: Slot, b: Slot): Pair {
  return {
    a,
    b,
    restAB: restBetween(a.exerciseId, b.exerciseId),
    restBA: restBetween(b.exerciseId, a.exerciseId),
  }
}

// 训练卡：需求文档第 4 节
export const TEMPLATES: Template[] = [
  {
    id: 'upper_a',
    name: '上肢A',
    short: 'A',
    location: 'home',
    pairs: [
      pair({ exerciseId: 'deficit_pushup', sets: 4 }, { exerciseId: 'backpack_row', sets: 4 }),
      pair({ exerciseId: 'pike_pushup', sets: 3 }, { exerciseId: 'pullover', sets: 3 }),
    ],
    finisher: { exerciseId: 'reverse_crunch', sets: 3, rest: REST.finisher },
  },
  {
    id: 'upper_b',
    name: '上肢B',
    short: 'B',
    location: 'out',
    pairs: [
      pair({ exerciseId: 'decline_wide_pushup', sets: 4 }, { exerciseId: 'pullup', sets: 4 }),
      pair(
        { exerciseId: 'diamond_pushup', sets: 3 },
        { exerciseId: 'backpack_row', sets: 3, altId: 'inverted_row' },
      ),
    ],
    finisher: { exerciseId: 'reverse_crunch', sets: 3, rest: REST.finisher },
  },
  {
    id: 'lower',
    name: '下肢+核心',
    short: '腿',
    location: 'home',
    pairs: [
      pair({ exerciseId: 'bss', sets: 4 }, { exerciseId: 'dead_bug', sets: 3 }),
      pair({ exerciseId: 'sl_rdl', sets: 3 }, { exerciseId: 'weighted_crunch', sets: 3 }),
    ],
  },
  {
    id: 'full',
    name: '全身',
    short: '全',
    location: 'home',
    pairs: [
      pair({ exerciseId: 'deficit_pushup', sets: 4 }, { exerciseId: 'backpack_row', sets: 4 }),
      pair({ exerciseId: 'bss', sets: 3 }, { exerciseId: 'pullover', sets: 3 }),
    ],
    finisher: { exerciseId: 'reverse_crunch', sets: 3, rest: REST.finisher },
  },
]

const BY_ID = new Map(TEMPLATES.map((t) => [t.id, t]))

export function getTemplate(id: string): Template {
  const t = BY_ID.get(id)
  if (!t) throw new Error(`未知训练卡：${id}`)
  return t
}

// 一张卡练到的肌群（按动作自动算）
export function templateGroups(t: Template): Group[] {
  const ids: string[] = []
  for (const p of t.pairs) ids.push(p.a.exerciseId, p.b.exerciseId)
  if (t.finisher) ids.push(t.finisher.exerciseId)
  const order: Group[] = ['push', 'pull', 'legs', 'core']
  const set = new Set(ids.map((id) => getExercise(id).group))
  return order.filter((g) => set.has(g))
}

// 精简模式（需求 5.2）：① 做 3 轮 → ② 做 2 轮 → ③ 跳过
export const SHORT_MODE = {
  warmupMin: 3,
  pairRounds: [3, 2],
  skipFinisher: true,
}

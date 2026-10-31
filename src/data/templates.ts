import type { Block, Group, RestRange, Template } from './types'

// 休息规则：需求文档 5.1
export const REST = {
  pair: [60, 90] as RestRange, // 同一块里两个动作之间
  legsToCore: [30, 45] as RestRange,
  coreToLegs: [45, 60] as RestRange,
  sideSwitch: 25, // 单边：左 → 右（20-30 秒取中）
  finisher: 45, // 收尾组间
  nextBlock: 90, // 换下一对（文档没写，默认 90 秒）
}

export function restBetween(from: Group, to: Group): RestRange {
  if (from === 'legs' && to === 'core') return REST.legsToCore
  if (from === 'core' && to === 'legs') return REST.coreToLegs
  return REST.pair
}

// 倒计时默认取区间中间值（取整到 5 秒）
export function restDefault(r: RestRange): number {
  return Math.round((r[0] + r[1]) / 2 / 5) * 5
}

// 精简模式（需求 5.2）：① 做 3 轮 → ② 做 2 轮（之后的也 2 轮）→ 收尾跳过
export const SHORT_ROUNDS = [3, 2]

export function shortLayout(blocks: Block[]): Block[] {
  return blocks
    .filter((b) => !b.finisher)
    .map((b, i) => {
      const cap = SHORT_ROUNDS[i] ?? SHORT_ROUNDS[SHORT_ROUNDS.length - 1]
      return { ...b, slots: b.slots.map((s) => ({ ...s, sets: Math.min(s.sets, cap) })) }
    })
}

export function cloneBlocks(blocks: Block[]): Block[] {
  return blocks.map((b) => ({ ...b, slots: b.slots.map((s) => ({ ...s })) }))
}

const pair = (a: string, aSets: number, b: string, bSets: number, altB?: string): Block => ({
  slots: [
    { exerciseId: a, sets: aSets },
    { exerciseId: b, sets: bSets, ...(altB ? { altId: altB } : {}) },
  ],
})
const finisher = (id: string, sets: number): Block => ({ slots: [{ exerciseId: id, sets }], finisher: true })

// 训练卡初始数据：需求文档第 4 节。第一次打开时导入数据库。
export const SEED_TEMPLATES: Template[] = [
  {
    id: 'upper_a',
    name: '上肢A',
    short: 'A',
    location: 'home',
    order: 1,
    blocks: [pair('deficit_pushup', 4, 'backpack_row', 4), pair('pike_pushup', 3, 'pullover', 3), finisher('reverse_crunch', 3)],
  },
  {
    id: 'upper_b',
    name: '上肢B',
    short: 'B',
    location: 'out',
    order: 2,
    blocks: [
      pair('decline_wide_pushup', 4, 'pullup', 4),
      pair('diamond_pushup', 3, 'backpack_row', 3, 'inverted_row'),
      finisher('reverse_crunch', 3),
    ],
  },
  {
    id: 'lower',
    name: '下肢+核心',
    short: '腿',
    location: 'home',
    order: 3,
    blocks: [pair('bss', 4, 'dead_bug', 3), pair('sl_rdl', 3, 'weighted_crunch', 3)],
  },
  {
    id: 'full',
    name: '全身',
    short: '全',
    location: 'home',
    order: 4,
    blocks: [pair('deficit_pushup', 4, 'backpack_row', 4), pair('bss', 3, 'pullover', 3), finisher('reverse_crunch', 3)],
  },
]

export const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨']

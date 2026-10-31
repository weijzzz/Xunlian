import { addDays, dayNumber, mondayOf, weekdayIndex } from './dates'

export type Parity = 'odd' | 'even' // odd = 单周，even = 双周

export const PARITY_NAME: Record<Parity, string> = { odd: '单周', even: '双周' }

// 2026-11-02（周一）那周是单周
const ANCHOR_MONDAY = dayNumber(new Date(2026, 10, 2))

export function weekParity(d: Date, flip: boolean): Parity {
  const idx = Math.floor((dayNumber(mondayOf(d)) - ANCHOR_MONDAY) / 7)
  let odd = ((idx % 2) + 2) % 2 === 0
  if (flip) odd = !odd
  return odd ? 'odd' : 'even'
}

// 早起日：周一到周五 7:00 起床，单周的周二、周五除外
export function isEarlyDay(d: Date, flip: boolean): boolean {
  const wd = weekdayIndex(d)
  if (wd > 4) return false
  if (weekParity(d, flip) === 'odd' && (wd === 1 || wd === 4)) return false
  return true
}

// 早起日的前一晚 21 点后不推荐训练（只提示）
export const LATE_HOUR = 21

export function lateNightWarning(now: Date, flip: boolean): boolean {
  return now.getHours() >= LATE_HOUR && isEarlyDay(addDays(now, 1), flip)
}

// 默认排法：weekdayIndex（周一=0）→ 训练卡 id。用户可以在 App 里改（存设置 defaultPlan）
export type WeekPlan = Record<Parity, Partial<Record<number, string>>>

export const DEFAULT_PLAN: WeekPlan = {
  odd: { 0: 'upper_a', 4: 'lower', 6: 'upper_b' }, // 周一晚上肢A、周五晚下肢、周日上肢B
  even: { 4: 'full' }, // 周五晚全身
}

export function planTemplateId(d: Date, flip: boolean, plan: WeekPlan = DEFAULT_PLAN): string | undefined {
  return plan[weekParity(d, flip)][weekdayIndex(d)]
}

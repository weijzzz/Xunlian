const DAY_MS = 86_400_000

// 本地日期 → YYYY-MM-DD
export function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// 按本地年月日算的"第几天"，不受夏令时影响
export function dayNumber(d: Date): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS)
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

// 周一 = 0 … 周日 = 6
export function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7
}

export function mondayOf(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  r.setDate(r.getDate() - weekdayIndex(r))
  return r
}

export const WEEKDAY_NAME = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

export function shortDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export function longDate(d: Date): string {
  return `${d.getMonth() + 1}月${d.getDate()}日 ${WEEKDAY_NAME[weekdayIndex(d)]}`
}

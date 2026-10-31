import { useLiveQuery } from 'dexie-react-hooks'
import type { BodyMetric, MetricType } from '../data/types'
import { addDays, parseYmd, ymd } from './dates'
import { db } from './db'

export const WEIGHT_STEP = 0.1
export const WEIGHT_MIN = 30
export const WEIGHT_MAX = 200
export const WEIGHT_FALLBACK = 65 // 第一次用、还没有任何记录时的起始值
export const MIN_DAYS_FOR_AVG = 3 // 7 天里至少记了几天才算平均

export function roundTo(v: number, step: number): number {
  const inv = 1 / step
  return Math.round(v * inv) / inv
}

export function clampWeight(v: number): number {
  return Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, roundTo(v, WEIGHT_STEP)))
}

// 支持 "64.5" 和西语键盘的 "64,5"
export function parseWeight(text: string): number | null {
  const v = Number(text.trim().replace(',', '.'))
  if (!Number.isFinite(v) || v < WEIGHT_MIN || v > WEIGHT_MAX) return null
  return roundTo(v, WEIGHT_STEP)
}

export async function saveMetric(type: MetricType, date: string, value: number) {
  await db.bodyMetrics.put({ type, date, value })
}

export async function deleteMetric(type: MetricType, date: string) {
  await db.bodyMetrics.delete([type, date])
}

// 按日期从新到旧
export function useMetrics(type: MetricType): BodyMetric[] | undefined {
  return useLiveQuery(
    () =>
      db.bodyMetrics
        .where('type')
        .equals(type)
        .toArray()
        .then((rows) => rows.sort((a, b) => (a.date < b.date ? 1 : -1))),
    [type],
  )
}

function avg(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length
}

export interface WeightStats {
  today: BodyMetric | null
  last: BodyMetric | null // 今天之前最近的一次
  avg7: number | null // 最近 7 天（含今天）平均
  count7: number
  weekChange: number | null // 这 7 天平均 − 前 7 天平均
}

// rows：同一类型、任意顺序
export function weightStats(rows: BodyMetric[], todayStr: string): WeightStats {
  const today = parseYmd(todayStr)
  const byDate = new Map(rows.map((r) => [r.date, r.value]))
  const windowValues = (endOffset: number) => {
    const vals: number[] = []
    for (let i = 0; i < 7; i++) {
      const v = byDate.get(ymd(addDays(today, -endOffset - i)))
      if (v !== undefined) vals.push(v)
    }
    return vals
  }
  const cur = windowValues(0)
  const prev = windowValues(7)
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? 1 : -1))
  const avg7 = cur.length >= MIN_DAYS_FOR_AVG ? avg(cur) : null
  const prevAvg = prev.length >= MIN_DAYS_FOR_AVG ? avg(prev) : null
  return {
    today: sorted.find((r) => r.date === todayStr) ?? null,
    last: sorted.find((r) => r.date < todayStr) ?? null,
    avg7,
    count7: cur.length,
    weekChange: avg7 !== null && prevAvg !== null ? avg7 - prevAvg : null,
  }
}

// 先保留两位再四舍五入到一位，避免 64.65 因浮点误差显示成 64.6
export function round1(v: number): number {
  return Math.round(Math.round(v * 100) / 10) / 10
}

export function fmtKg(v: number): string {
  return round1(v).toFixed(1)
}

export function fmtChange(v: number): string {
  const r = round1(v)
  if (r === 0) return '±0.0'
  return `${r > 0 ? '+' : '−'}${Math.abs(r).toFixed(1)}`
}

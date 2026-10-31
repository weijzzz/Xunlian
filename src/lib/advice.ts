import type { BodyMetric, Session, SetLog } from '../data/types'
import { addDays, parseYmd, ymd } from './dates'
import { round1 } from './body'
import { summarize } from './summary'

// 趋势提示（需求文档 6.5 + 和用户确认过的补充）
// - 肌酸开始后 3 周：体重会涨水，先不给热量建议
// - 周均每周掉 0.1-0.3kg → 正常；掉得更快，或者在掉且力量下滑 → 建议 +150kcal
// - 体重不动（周均变化 <0.1）但腰围降（≥0.5cm）→ 保持；体重和腰围连续 3 周都不动 → 建议 −150kcal
// - 周均在涨：腰围也涨 → 建议 −150kcal；腰围不变或降 → 正常

export type AdviceLevel = 'plus' | 'normal' | 'keep' | 'minus' | 'wait' | 'nodata'

export interface Advice {
  level: AdviceLevel
  title: string
  reasons: string[]
  facts: string[] // 用到的数据
}

export const WAIST_EVERY = 14
export const CHEST_EVERY = 28
const FLAT_KG = 0.1
const FLAT_CM = 0.5
export const CREATINE_DAYS = 21

// 第 k 周（0 = 最近 7 天）的平均体重；7 天里不到 3 天记录就是 null
export function weekAvg(weights: BodyMetric[], today: Date, k: number): number | null {
  const byDate = new Map(weights.map((w) => [w.date, w.value]))
  const vals: number[] = []
  for (let i = 0; i < 7; i++) {
    const v = byDate.get(ymd(addDays(today, -7 * k - i)))
    if (v !== undefined) vals.push(v)
  }
  return vals.length >= 3 ? vals.reduce((s, v) => s + v, 0) / vals.length : null
}

function weekChange(weights: BodyMetric[], today: Date, k: number): number | null {
  const a = weekAvg(weights, today, k)
  const b = weekAvg(weights, today, k + 1)
  return a !== null && b !== null ? a - b : null
}

// 最新一次和至少 minDays 天前的那一次比
function measureChange(rows: BodyMetric[], minDays: number): { latest: BodyMetric; prev: BodyMetric; diff: number } | null {
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? 1 : -1))
  const latest = sorted[0]
  if (!latest) return null
  const limit = ymd(addDays(parseYmd(latest.date), -minDays))
  const prev = sorted.find((r) => r.date <= limit)
  return prev ? { latest, prev, diff: latest.value - prev.value } : null
}

// 最近两次非疲劳训练，都是过半动作比上次差 → 力量下滑
export function strengthDecline(sessions: Session[], logs: SetLog[]): boolean {
  const done = sessions
    .filter((s) => s.status === 'done' && s.fatigued.length === 0)
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, 2)
  if (done.length < 2) return false
  const sessMap = new Map(sessions.map((s) => [s.id, s]))
  return done.every((s) => {
    const sum = summarize(
      s,
      logs.filter((l) => l.sessionId === s.id),
      logs,
      sessMap,
    )
    const compared = sum.exercises.filter((e) => e.trend === 'better' || e.trend === 'same' || e.trend === 'worse')
    const worse = compared.filter((e) => e.trend === 'worse').length
    return compared.length > 0 && worse * 2 > compared.length
  })
}

const kg = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(round1(v)).toFixed(1)}kg`
const cm = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(round1(v)).toFixed(1)}cm`

export function computeAdvice(opts: {
  weights: BodyMetric[]
  waists: BodyMetric[]
  creatineStart: string | null
  today: Date
  strengthDown: boolean
}): Advice {
  const { weights, waists, creatineStart, today, strengthDown } = opts
  const facts: string[] = []
  const a0 = weekAvg(weights, today, 0)
  const w0 = weekChange(weights, today, 0)
  if (a0 !== null) facts.push(`7 日平均 ${round1(a0).toFixed(1)}kg${w0 !== null ? `，比上周 ${kg(w0)}` : ''}`)
  const waist = measureChange(waists, 10)
  const waist3 = measureChange(waists, 20) ?? waist
  if (waist) facts.push(`腰围 ${waist.latest.value.toFixed(1)}cm，比 ${waist.prev.date.slice(5).replace('-', '/')} ${cm(waist.diff)}`)
  if (strengthDown) facts.push('最近两次训练过半动作比上次差')

  if (creatineStart) {
    const days = Math.floor((parseYmd(ymd(today)).getTime() - parseYmd(creatineStart).getTime()) / 86_400_000)
    if (days >= 0 && days < CREATINE_DAYS) {
      return {
        level: 'wait',
        title: '先不调热量',
        reasons: [`开始吃肌酸第 ${days + 1} 天，前 3 周体重会涨 1-2kg 水分`, `再过 ${CREATINE_DAYS - days} 天给建议，这期间主要看腰围`],
        facts,
      }
    }
  }

  if (w0 === null) {
    return { level: 'nodata', title: '数据还不够', reasons: ['最近两周每周都要记 3 天以上体重，才能算周平均'], facts }
  }

  if (w0 <= -0.3 - 1e-9) {
    return { level: 'plus', title: '建议每天 +150kcal', reasons: [`周平均掉了 ${Math.abs(round1(w0)).toFixed(1)}kg，比每周 0.1-0.3kg 快，容易掉肌肉`], facts }
  }
  if (w0 < 0 && strengthDown) {
    return { level: 'plus', title: '建议每天 +150kcal', reasons: ['体重在掉，力量也在下滑（最近两次训练过半动作比上次差）'], facts }
  }
  if (w0 <= -FLAT_KG) {
    return { level: 'normal', title: '正常', reasons: [`周平均 ${kg(w0)}，在每周掉 0.1-0.3kg 的范围里`], facts }
  }
  if (w0 < FLAT_KG) {
    // 体重基本没动
    if (waist && waist.diff <= -FLAT_CM) {
      return { level: 'keep', title: '保持', reasons: [`体重没动，腰围小了 ${Math.abs(waist.diff).toFixed(1)}cm → 在增肌减脂`], facts }
    }
    const flat3 = [0, 1, 2].every((k) => {
      const w = weekChange(weights, today, k)
      return w !== null && Math.abs(w) < FLAT_KG
    })
    if (flat3 && waist3 && Math.abs(waist3.diff) < FLAT_CM) {
      return { level: 'minus', title: '建议每天 −150kcal', reasons: ['体重和腰围连续 3 周都没动'], facts }
    }
    if (!waist) return { level: 'normal', title: '先观察', reasons: ['体重这周没动；量一下腰围才能判断是不是在增肌减脂'], facts }
    return { level: 'normal', title: '先观察', reasons: ['体重这周没动，连续 3 周不动再调'], facts }
  }
  // 体重在涨
  if (!waist) return { level: 'normal', title: '先量腰围', reasons: [`周平均涨了 ${round1(w0).toFixed(1)}kg，要看腰围才知道是肌肉还是脂肪`], facts }
  if (waist.diff >= FLAT_CM) {
    return { level: 'minus', title: '建议每天 −150kcal', reasons: [`周平均涨了 ${round1(w0).toFixed(1)}kg，腰围也大了 ${waist.diff.toFixed(1)}cm`], facts }
  }
  return { level: 'normal', title: '正常', reasons: [`周平均涨了 ${round1(w0).toFixed(1)}kg，但腰围没变大 → 多半是肌肉和水分`], facts }
}

// 腰围 / 胸围到期了吗
export function measureDue(rows: BodyMetric[], every: number, today: Date): { due: boolean; last: BodyMetric | null; days: number | null } {
  const last = [...rows].sort((a, b) => (a.date < b.date ? 1 : -1))[0] ?? null
  if (!last) return { due: true, last: null, days: null }
  const days = Math.floor((parseYmd(ymd(today)).getTime() - parseYmd(last.date).getTime()) / 86_400_000)
  return { due: days >= every, last, days }
}

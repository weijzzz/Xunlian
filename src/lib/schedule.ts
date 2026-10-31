import { useLiveQuery } from 'dexie-react-hooks'
import type { Group, PlanOverride } from '../data/types'
import { addDays, weekdayIndex, WEEKDAY_NAME, ymd } from './dates'
import { db } from './db'
import { blocksGroups, getTemplate } from './library'
import { setSetting, useSettings } from './settings'
import { DEFAULT_PLAN, isEarlyDay, PARITY_NAME, weekParity, type Parity, type WeekPlan } from './week'

// 某一天实际练什么 = 「只这一天」的改动 → 默认排法（可能被用户改过）

export interface DayPlan {
  id: string | undefined // undefined = 休息
  overridden: boolean // 这一天单独改过
}

export function useSchedule() {
  const { parityFlip, defaultPlan } = useSettings()
  const rows = useLiveQuery(() => db.planOverrides.toArray(), []) as PlanOverride[] | undefined
  const overrides = new Map((rows ?? []).map((r) => [r.date, r.templateId]))
  const plan = defaultPlan ?? DEFAULT_PLAN

  const defaultFor = (d: Date) => plan[weekParity(d, parityFlip)][weekdayIndex(d)]
  const dayPlan = (d: Date): DayPlan => {
    const k = ymd(d)
    if (overrides.has(k)) return { id: overrides.get(k) ?? undefined, overridden: true }
    return { id: defaultFor(d), overridden: false }
  }
  return { loaded: rows !== undefined, flip: parityFlip, plan, customPlan: defaultPlan !== null, dayPlan, defaultFor }
}

// 只改这一天
export async function setDayOnly(date: Date, templateId: string | null) {
  await db.planOverrides.put({ date: ymd(date), templateId })
}

export async function clearDay(date: Date) {
  await db.planOverrides.delete(ymd(date))
}

// 以后每个单周/双周的这一天都这样（改默认排法），同时去掉这一天的单独改动
export async function setDefaultFor(date: Date, flip: boolean, plan: WeekPlan, templateId: string | null) {
  const parity = weekParity(date, flip)
  const wd = weekdayIndex(date)
  const next: WeekPlan = { odd: { ...plan.odd }, even: { ...plan.even } }
  if (templateId) next[parity][wd] = templateId
  else delete next[parity][wd]
  await setSetting('defaultPlan', next)
  await clearDay(date)
}

export async function resetDefaultPlan() {
  await setSetting('defaultPlan', null)
}

export function describePlan(plan: WeekPlan, parity: Parity): string {
  const days = Object.entries(plan[parity])
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([wd, id]) => `${WEEKDAY_NAME[Number(wd)]} ${getTemplate(id!)?.name ?? '?'}`)
  return `${PARITY_NAME[parity]}：${days.length ? days.join(' · ') : '全休息'}`
}

// 选了某张卡之后的提醒
export function dayWarnings(date: Date, templateId: string | undefined, sched: ReturnType<typeof useSchedule>): string[] {
  if (!templateId) return []
  const tpl = getTemplate(templateId)
  if (!tpl) return []
  const out: string[] = []
  const mine = blocksGroups(tpl.blocks).filter((g) => g !== 'core')
  for (const offset of [-1, 1]) {
    const other = addDays(date, offset)
    const id = sched.dayPlan(other).id
    if (!id) continue
    const ot = getTemplate(id)
    if (!ot) continue
    const shared: Group[] = blocksGroups(ot.blocks).filter((g) => g !== 'core' && mine.includes(g))
    if (shared.length) {
      const names = shared.map((g) => ({ push: '推', pull: '拉', legs: '腿', core: '腹' })[g]).join('、')
      out.push(`和${offset < 0 ? '前一天' : '后一天'}（${WEEKDAY_NAME[weekdayIndex(other)]} ${ot.name}）都练${names}，间隔不到 48 小时，会进疲劳模式`)
    }
  }
  if (isEarlyDay(addDays(date, 1), sched.flip)) out.push('第二天 7:00 起床，这天晚上 21 点前练完')
  if (tpl.location === 'out' && weekdayIndex(date) !== 6) out.push(`${tpl.name} 要单杠，一般只有周日在外面能练`)
  return out
}

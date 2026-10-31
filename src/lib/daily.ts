import { useLiveQuery } from 'dexie-react-hooks'
import type { DailyCheck } from '../data/types'
import { mondayOf, ymd } from './dates'
import { db } from './db'

export type DailyField = 'creatine' | 'vacuum'

// 今天的打卡 + 本周（周一到今天）各打了几天
export function useDaily(now: Date) {
  const today = ymd(now)
  const monday = ymd(mondayOf(now))
  const rows = useLiveQuery(() => db.dailyChecks.where('date').between(monday, today, true, true).toArray(), [monday, today])
  const todayRow: DailyCheck = rows?.find((r) => r.date === today) ?? { date: today, creatine: false, vacuum: false }
  const week = {
    creatine: (rows ?? []).filter((r) => r.creatine).length,
    vacuum: (rows ?? []).filter((r) => r.vacuum).length,
  }
  const daysSoFar = Math.round((new Date(today).getTime() - new Date(monday).getTime()) / 86_400_000) + 1
  return { loaded: rows !== undefined, today: todayRow, week, daysSoFar }
}

export async function toggleDaily(date: string, field: DailyField) {
  await db.transaction('rw', db.dailyChecks, async () => {
    const cur = (await db.dailyChecks.get(date)) ?? { date, creatine: false, vacuum: false }
    await db.dailyChecks.put({ ...cur, [field]: !cur[field] })
  })
}


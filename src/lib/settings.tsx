import { useLiveQuery } from 'dexie-react-hooks'
import { createContext, useContext, type ReactNode } from 'react'
import type { KV } from '../data/types'
import { db } from './db'
import type { WeekPlan } from './week'

// 定时提醒（以后可以往里加别的）
export interface Reminder {
  id: string // 'weight'
  label: string
  enabled: boolean
  early: string // 早起日几点提醒 HH:MM
  other: string // 不早起的日子几点
}

export interface Settings {
  parityFlip: boolean // 单双周翻转
  creatineStart: string | null // 肌酸开始日期 YYYY-MM-DD
  defaultPlan: WeekPlan | null // 改过的默认排法；null = 用原始排法
  vacuumHold: number // 吸腹每组保持几秒
  pushOn: boolean // 开了通知
  reminders: Reminder[]
}

export const DEFAULT_SETTINGS: Settings = {
  parityFlip: false,
  creatineStart: null,
  defaultPlan: null,
  vacuumHold: 30,
  pushOn: false,
  reminders: [{ id: 'weight', label: '记体重', enabled: true, early: '08:00', other: '08:00' }],
}

function toSettings(rows: KV[]): Settings {
  const s: Settings = { ...DEFAULT_SETTINGS }
  for (const r of rows) {
    if (r.key in s) (s as unknown as Record<string, unknown>)[r.key] = r.value
  }
  return s
}

// 启动时先读一次，避免第一帧用默认值（比如单双周闪一下错的）
let initialRows: KV[] = []

export async function preloadSettings() {
  try {
    initialRows = await db.kv.toArray()
  } catch {
    initialRows = []
  }
}

const SettingsContext = createContext<Settings>(DEFAULT_SETTINGS)

// 全 App 只有这一个订阅，所有页面共用同一份设置
export function SettingsProvider({ children }: { children: ReactNode }) {
  const rows = useLiveQuery(() => db.kv.toArray(), [], initialRows)
  return <SettingsContext.Provider value={toSettings(rows)}>{children}</SettingsContext.Provider>
}

export function useSettings(): Settings {
  return useContext(SettingsContext)
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  await db.kv.put({ key, value })
}

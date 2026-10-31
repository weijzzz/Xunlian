import { useLiveQuery } from 'dexie-react-hooks'
import { createContext, useContext, type ReactNode } from 'react'
import type { KV } from '../data/types'
import { db } from './db'

export interface Settings {
  parityFlip: boolean // 单双周翻转
  creatineStart: string | null // 肌酸开始日期 YYYY-MM-DD
}

export const DEFAULT_SETTINGS: Settings = {
  parityFlip: false,
  creatineStart: null,
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

import { db, TABLE_NAMES } from './db'
import { ymd } from './dates'

const APP_ID = 'xunlian'
const FORMAT_VERSION = 1

type Tables = Record<(typeof TABLE_NAMES)[number], unknown[]>

interface Backup {
  app: string
  version: number
  exportedAt: string
  tables: Tables
}

export async function buildBackup(): Promise<Backup> {
  const tables = {} as Tables
  await db.transaction('r', TABLE_NAMES.map((n) => db.table(n)), async () => {
    for (const name of TABLE_NAMES) tables[name] = await db.table(name).toArray()
  })
  return { app: APP_ID, version: FORMAT_VERSION, exportedAt: new Date().toISOString(), tables }
}

export function backupFileName(): string {
  return `xunlian-backup-${ymd(new Date())}.json`
}

export async function backupFile(): Promise<File> {
  const data = await buildBackup()
  return new File([JSON.stringify(data)], backupFileName(), { type: 'application/json' })
}

// 下载到手机"下载"文件夹
export async function downloadBackup() {
  const file = await backupFile()
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function canShareFiles(): boolean {
  try {
    const probe = new File(['{}'], 'x.json', { type: 'application/json' })
    return !!navigator.canShare?.({ files: [probe] })
  } catch {
    return false
  }
}

// 用系统分享发到 Google Drive / WhatsApp 等
export async function shareBackup() {
  const file = await backupFile()
  await navigator.share({ files: [file], title: file.name })
}

export interface ImportSummary {
  sessions: number
  setLogs: number
  bodyMetrics: number
  dailyChecks: number
}

export function parseBackup(text: string): Backup {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('不是有效的 JSON 文件')
  }
  const b = data as Partial<Backup>
  if (b?.app !== APP_ID || typeof b.tables !== 'object' || b.tables === null) {
    throw new Error('这不是本 App 导出的备份')
  }
  if ((b.version ?? 0) > FORMAT_VERSION) throw new Error('备份来自更新的版本，请先更新 App')
  for (const name of TABLE_NAMES) {
    if (!Array.isArray(b.tables[name])) throw new Error(`备份缺少 ${name} 表`)
  }
  return b as Backup
}

export function summarize(b: Backup): ImportSummary {
  return {
    sessions: b.tables.sessions.length,
    setLogs: b.tables.setLogs.length,
    bodyMetrics: b.tables.bodyMetrics.length,
    dailyChecks: b.tables.dailyChecks.length,
  }
}

// 用备份整体替换现有数据
export async function restoreBackup(b: Backup) {
  await db.transaction('rw', TABLE_NAMES.map((n) => db.table(n)), async () => {
    for (const name of TABLE_NAMES) {
      const t = db.table(name)
      await t.clear()
      await t.bulkAdd(b.tables[name])
    }
  })
}

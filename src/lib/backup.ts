import { db, TABLE_NAMES, type TableName } from './db'
import { ymd } from './dates'

const APP_ID = 'xunlian'
const FORMAT_VERSION = 2

// v1 备份只有前 5 张表；v2 起多了动作库、训练卡、排法改动
const REQUIRED: TableName[] = ['sessions', 'setLogs', 'bodyMetrics', 'dailyChecks', 'kv']

type Tables = Partial<Record<TableName, unknown[]>>

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
  for (const name of REQUIRED) {
    if (!Array.isArray(b.tables[name])) throw new Error(`备份缺少 ${name} 表`)
  }
  for (const name of TABLE_NAMES) {
    const t = b.tables[name]
    if (t !== undefined && !Array.isArray(t)) throw new Error(`备份里 ${name} 表格式不对`)
  }
  return b as Backup
}

export function summarize(b: Backup): ImportSummary {
  return {
    sessions: b.tables.sessions?.length ?? 0,
    setLogs: b.tables.setLogs?.length ?? 0,
    bodyMetrics: b.tables.bodyMetrics?.length ?? 0,
    dailyChecks: b.tables.dailyChecks?.length ?? 0,
  }
}

// 用备份整体替换现有数据。旧版备份里没有的表（动作库、训练卡）保持手机上现在的
export async function restoreBackup(b: Backup) {
  await db.transaction('rw', TABLE_NAMES.map((n) => db.table(n)), async () => {
    for (const name of TABLE_NAMES) {
      const rows = b.tables[name]
      if (rows === undefined) continue
      const t = db.table(name)
      await t.clear()
      await t.bulkAdd(rows)
    }
  })
}

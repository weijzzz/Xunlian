import { Dexie, type Table } from 'dexie'
import type { BodyMetric, DailyCheck, Exercise, KV, PlanOverride, Session, SetLog, Template } from '../data/types'

// 用户给动作配的图片/动图/视频（不进 JSON 备份，太大）
export interface Media {
  exerciseId: string
  blob: Blob
  type: string
  updatedAt: number
}

export class TrainingDB extends Dexie {
  sessions!: Table<Session, string>
  setLogs!: Table<SetLog, string>
  bodyMetrics!: Table<BodyMetric, [string, string]>
  dailyChecks!: Table<DailyCheck, string>
  kv!: Table<KV, string>
  exercises!: Table<Exercise, string>
  templates!: Table<Template, string>
  planOverrides!: Table<PlanOverride, string>
  media!: Table<Media, string>

  constructor() {
    super('xunlian')
    this.version(1).stores({
      sessions: 'id, startedAt, status, templateId',
      setLogs: 'id, sessionId, exerciseId, doneAt, [exerciseId+doneAt]',
      bodyMetrics: '[type+date], type, date',
      dailyChecks: 'date',
      kv: 'key',
    })
    // v2：动作库、训练卡搬进数据库；「只这周」的排法改动
    this.version(2).stores({
      exercises: 'id',
      templates: 'id',
      planOverrides: 'date',
    })
    // v3：动作的自定义图片/视频
    this.version(3).stores({
      media: 'exerciseId',
    })
  }
}

export const db = new TrainingDB()

export const TABLE_NAMES = [
  'sessions',
  'setLogs',
  'bodyMetrics',
  'dailyChecks',
  'kv',
  'exercises',
  'templates',
  'planOverrides',
] as const

export type TableName = (typeof TABLE_NAMES)[number]

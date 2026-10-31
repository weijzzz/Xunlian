import { Dexie, type Table } from 'dexie'
import type { BodyMetric, DailyCheck, KV, Session, SetLog } from '../data/types'

export class TrainingDB extends Dexie {
  sessions!: Table<Session, string>
  setLogs!: Table<SetLog, string>
  bodyMetrics!: Table<BodyMetric, [string, string]>
  dailyChecks!: Table<DailyCheck, string>
  kv!: Table<KV, string>

  constructor() {
    super('xunlian')
    this.version(1).stores({
      sessions: 'id, startedAt, status, templateId',
      setLogs: 'id, sessionId, exerciseId, doneAt, [exerciseId+doneAt]',
      bodyMetrics: '[type+date], type, date',
      dailyChecks: 'date',
      kv: 'key',
    })
  }
}

export const db = new TrainingDB()

export const TABLE_NAMES = ['sessions', 'setLogs', 'bodyMetrics', 'dailyChecks', 'kv'] as const

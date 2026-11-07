import { useLiveQuery } from 'dexie-react-hooks'
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { ROW_TIP, SEED_EXERCISES } from '../data/exercises'
import { SEED_TEMPLATES } from '../data/templates'
import { GROUP_ORDER, type Block, type Exercise, type Group, type Template } from '../data/types'
import { db } from './db'

// 动作库和训练卡存在数据库里。启动时读进内存，组件里可以同步取用。

let exMap = new Map<string, Exercise>()
let templates: Template[] = []

function setCache(ex: Exercise[], tpl: Template[]) {
  exMap = new Map(ex.map((e) => [e.id, e]))
  templates = [...tpl].sort((a, b) => a.order - b.order)
}

// 第一次打开（或旧版本升级上来）时把代码里的初始数据导入数据库
export async function seedLibrary() {
  await db.transaction('rw', db.exercises, db.templates, async () => {
    if ((await db.exercises.count()) === 0) await db.exercises.bulkAdd(SEED_EXERCISES)
    if ((await db.templates.count()) === 0) await db.templates.bulkAdd(SEED_TEMPLATES)
  })
  await migrateLibrary()
}

// 已有用户的动作库改动（SEED 只在表空时导入，所以改已有数据要在这里写）。每条只跑一次。
const OLD_ROW_TIP = '脚往前移，让身体更平'
const LIB_MIGRATIONS: { id: string; run: () => Promise<void> }[] = [
  {
    // 2026-11：自重划船达标后不提示 +1kg，改提示更难的做法
    id: 'row-bodyweight',
    run: async () => {
      const inv = await db.exercises.get('inverted_row')
      if (inv && (inv.progressTip === OLD_ROW_TIP || !inv.progressTip)) await db.exercises.update(inv.id, { progressTip: ROW_TIP })
      for (const ex of await db.exercises.filter((e) => e.name.includes('门框划船')).toArray()) {
        if (ex.unit === 'kg') {
          // 新建时负重方式默认是「背包」；只有从没背过东西（记录全是 0kg）才改成自重
          const logs = await db.setLogs.where('exerciseId').equals(ex.id).toArray()
          if (logs.some((l) => l.load !== 0)) continue
          await db.exercises.update(ex.id, {
            unit: 'none',
            step: 0,
            loadLabel: '自重',
            addLoad: undefined,
            addLoadText: undefined,
            loadAfterReps: undefined,
            firstTest: undefined,
            progressTip: ex.progressTip || ROW_TIP,
          })
        } else if (ex.unit === 'none' && !ex.progressTip) {
          await db.exercises.update(ex.id, { progressTip: ROW_TIP })
        }
      }
    },
  },
]

async function migrateLibrary() {
  const row = await db.kv.get('libMigrations')
  const done = new Set(Array.isArray(row?.value) ? (row.value as string[]) : [])
  const todo = LIB_MIGRATIONS.filter((m) => !done.has(m.id))
  if (!todo.length) return
  await db.transaction('rw', db.exercises, db.setLogs, db.kv, async () => {
    for (const m of todo) {
      await m.run()
      done.add(m.id)
    }
    await db.kv.put({ key: 'libMigrations', value: [...done] })
  })
}

export async function preloadLibrary() {
  try {
    await seedLibrary()
    setCache(await db.exercises.toArray(), await db.templates.toArray())
  } catch {
    setCache(SEED_EXERCISES, SEED_TEMPLATES)
  }
}

interface Library {
  exercises: Exercise[] // 包括已隐藏的
  templates: Template[]
}

const LibraryContext = createContext<Library>({ exercises: [], templates: [] })

export function LibraryProvider({ children }: { children: ReactNode }) {
  const ex = useLiveQuery(() => db.exercises.toArray(), [], [...exMap.values()])
  const tpl = useLiveQuery(() => db.templates.toArray(), [], templates)
  const value = useMemo(() => {
    setCache(ex, tpl)
    return { exercises: [...exMap.values()], templates }
  }, [ex, tpl])
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}

export function useLibrary(): Library {
  return useContext(LibraryContext)
}

const UNKNOWN: Exercise = {
  id: '?',
  name: '（已删除的动作）',
  area: '',
  group: 'core',
  sided: 'no',
  unit: 'none',
  step: 0,
  loadLabel: '',
  repMin: null,
  repMax: null,
  cue: '',
}

export function getExercise(id: string): Exercise {
  return exMap.get(id) ?? { ...UNKNOWN, id }
}

export function getTemplate(id: string): Template | undefined {
  return templates.find((t) => t.id === id)
}

export function blockExerciseIds(blocks: Block[]): string[] {
  return blocks.flatMap((b) => b.slots.map((s) => s.exerciseId))
}

// 一组动作练到的肌群（按动作自动算）
export function blocksGroups(blocks: Block[]): Group[] {
  const set = new Set(blockExerciseIds(blocks).map((id) => getExercise(id).group))
  return GROUP_ORDER.filter((g) => set.has(g))
}

// 新建动作：存进动作库（永久），同时马上放进内存，避免刚建好时显示成「已删除」
export async function createExercise(fields: Omit<Exercise, 'id' | 'custom'>): Promise<string> {
  const id = `custom_${crypto.randomUUID().slice(0, 8)}`
  const ex: Exercise = { ...fields, id, custom: true }
  await db.exercises.add(ex)
  exMap.set(id, ex)
  return id
}

export async function updateExercise(id: string, patch: Partial<Exercise>) {
  const cur = exMap.get(id) ?? (await db.exercises.get(id))
  if (!cur) return
  const next = { ...cur, ...patch, id }
  await db.exercises.put(next)
  exMap.set(id, next)
}

export async function setArchived(id: string, archived: boolean) {
  await updateExercise(id, { archived })
}

// ---------- 训练卡 ----------

export async function saveTemplate(t: Template) {
  await db.templates.put(t)
  templates = [...templates.filter((x) => x.id !== t.id), t].sort((a, b) => a.order - b.order)
}

export async function createTemplate(): Promise<string> {
  const all = await db.templates.toArray()
  const id = `tpl_${crypto.randomUUID().slice(0, 8)}`
  const t: Template = {
    id,
    name: '新训练卡',
    short: '新',
    location: 'home',
    order: Math.max(0, ...all.map((x) => x.order)) + 1,
    blocks: [],
  }
  await saveTemplate(t)
  return id
}

// 删除训练卡：顺便把排法里用到它的地方清掉（历史训练存了卡名，不受影响）
export async function deleteTemplate(id: string) {
  await db.transaction('rw', db.templates, db.planOverrides, db.kv, async () => {
    await db.templates.delete(id)
    const ov = await db.planOverrides.toArray()
    for (const o of ov) if (o.templateId === id) await db.planOverrides.delete(o.date)
    const kv = await db.kv.get('defaultPlan')
    const plan = kv?.value as Record<string, Record<string, string>> | null | undefined
    if (plan) {
      for (const parity of Object.keys(plan)) {
        for (const wd of Object.keys(plan[parity])) if (plan[parity][wd] === id) delete plan[parity][wd]
      }
      await db.kv.put({ key: 'defaultPlan', value: plan })
    }
  })
  templates = templates.filter((t) => t.id !== id)
}

// 上移 / 下移一张卡
export async function moveTemplate(id: string, delta: -1 | 1) {
  const list = [...templates]
  const i = list.findIndex((t) => t.id === id)
  const j = i + delta
  if (i < 0 || j < 0 || j >= list.length) return
  ;[list[i], list[j]] = [list[j], list[i]]
  await db.transaction('rw', db.templates, async () => {
    for (let k = 0; k < list.length; k++) {
      list[k] = { ...list[k], order: k + 1 }
      await db.templates.put(list[k])
    }
  })
  templates = list
}

import { useLiveQuery } from 'dexie-react-hooks'
import { cloneBlocks, shortLayout } from '../data/templates'
import type { Block, Cursor, Group, Session, Template } from '../data/types'
import { db } from './db'
import { getExercise } from './library'
import { buildPlan, cursorAt, nextAfter, stepIndex, type PlanStep } from './plan'

export const STALE_HOURS = 6

// undefined = 还在读；null = 没有进行中的训练
export function useActiveSession(): Session | null | undefined {
  return useLiveQuery(async () => {
    const list = await db.sessions.where('status').equals('active').toArray()
    list.sort((a, b) => b.startedAt - a.startedAt)
    return list[0] ?? null
  }, [])
}

async function lastActivity(s: Session): Promise<number> {
  const logs = await db.setLogs.where('sessionId').equals(s.id).toArray()
  return Math.max(s.startedAt, ...logs.map((l) => l.doneAt))
}

export async function finishSession(id: string, endedAt?: number) {
  const s = await db.sessions.get(id)
  if (!s) return
  const end = endedAt ?? Date.now()
  await db.sessions.update(id, { status: 'done', endedAt: end, cursor: { ...s.cursor, phase: 'done', restEndsAt: undefined } })
}

// 超过 6 小时没动的训练自动算结束（结束时间 = 最后一组的时间）
export async function autoEndStale(now = Date.now()) {
  const active = await db.sessions.where('status').equals('active').toArray()
  for (const s of active) {
    const last = await lastActivity(s)
    if (now - last > STALE_HOURS * 3_600_000) await finishSession(s.id, last)
  }
}

export async function startSession(tpl: Template, draft: Block[], short: boolean, fatigued: Group[]): Promise<string> {
  const layout = short ? shortLayout(draft) : cloneBlocks(draft)
  const plan = buildPlan(layout)
  if (plan.length === 0) throw new Error('这张卡里没有动作')
  // 同时只能有一个进行中的训练
  const active = await db.sessions.where('status').equals('active').toArray()
  for (const s of active) await finishSession(s.id, await lastActivity(s))
  const id = crypto.randomUUID()
  const session: Session = {
    id,
    templateId: tpl.id,
    templateName: tpl.name,
    location: tpl.location,
    startedAt: Date.now(),
    status: 'active',
    short,
    fatigued,
    layout,
    cursor: { ...cursorAt(plan[0]), phase: 'warmup' },
  }
  await db.sessions.add(session)
  return id
}

async function setCursor(id: string, cursor: Cursor) {
  await db.sessions.update(id, { cursor })
}

export async function finishWarmup(s: Session) {
  const plan = buildPlan(s.layout)
  const i = stepIndex(plan, s.cursor)
  if (i < 0) return finishSession(s.id)
  await setCursor(s.id, { ...cursorAt(plan[i]), phase: 'set' })
}

// 记一组。返回 true = 整个训练做完了
export async function logSet(s: Session, step: PlanStep, setNo: number, load: number, reps: number): Promise<boolean> {
  const now = Date.now()
  const plan = buildPlan(s.layout)
  const next = nextAfter(plan, step)
  await db.transaction('rw', db.setLogs, db.sessions, async () => {
    await db.setLogs.add({
      id: crypto.randomUUID(),
      sessionId: s.id,
      exerciseId: step.exerciseId,
      setNo,
      ...(step.side ? { side: step.side } : {}),
      load,
      reps,
      doneAt: now,
    })
    if (next < 0) {
      await db.sessions.update(s.id, { status: 'done', endedAt: now, cursor: { ...cursorAt(step), phase: 'done' } })
    } else if (step.restAfter > 0) {
      await setCursor(s.id, { ...cursorAt(step), phase: 'rest', restEndsAt: now + step.restAfter * 1000, restTotal: step.restAfter })
    } else {
      await setCursor(s.id, { ...cursorAt(plan[next]), phase: 'set' })
    }
  })
  return next < 0
}

// 休息结束（到点或跳过）→ 下一组。返回 true = 没有下一组了
export async function endRest(s: Session): Promise<boolean> {
  const plan = buildPlan(s.layout)
  const next = nextAfter(plan, s.cursor)
  if (next < 0) {
    await finishSession(s.id)
    return true
  }
  await setCursor(s.id, { ...cursorAt(plan[next]), phase: 'set' })
  return false
}

export async function addRest(s: Session, sec: number) {
  if (s.cursor.phase !== 'rest' || !s.cursor.restEndsAt) return
  await setCursor(s.id, {
    ...s.cursor,
    restEndsAt: s.cursor.restEndsAt + sec * 1000,
    restTotal: (s.cursor.restTotal ?? 0) + sec,
  })
}

// ---------- 训练中改动作 ----------

// 休息中打开菜单时，改动针对的是「下一组」：先把光标移过去
function targetCursor(s: Session, plan: PlanStep[]): Cursor | null {
  if (s.cursor.phase === 'rest') {
    const next = nextAfter(plan, s.cursor)
    return next < 0 ? null : { ...cursorAt(plan[next]), phase: 'set' }
  }
  return s.cursor
}

async function editLayout(s: Session, edit: (blocks: Block[], c: Cursor) => Cursor | void) {
  const plan = buildPlan(s.layout)
  const c = targetCursor(s, plan)
  if (!c) return
  const blocks = cloneBlocks(s.layout)
  const newCursor = edit(blocks, { ...c }) ?? c
  const newPlan = buildPlan(blocks)

  // 休息中改：倒计时照常继续，改动只影响后面的组
  if (s.cursor.phase === 'rest') {
    await db.sessions.update(s.id, { layout: blocks })
    if (nextAfter(newPlan, s.cursor) < 0) await finishSession(s.id)
    return
  }

  const i = stepIndex(newPlan, newCursor)
  if (i < 0) {
    await db.sessions.update(s.id, { layout: blocks, cursor: newCursor })
    await finishSession(s.id)
    return
  }
  const phase = newCursor.phase === 'warmup' ? 'warmup' : 'set'
  await db.sessions.update(s.id, { layout: blocks, cursor: { ...cursorAt(newPlan[i]), phase } })
}

// 换动作：这个动作剩下的组都换成新的
export async function replaceExercise(s: Session, newId: string) {
  await editLayout(s, (blocks, c) => {
    const slot = blocks[c.b]?.slots[c.s]
    if (!slot) return
    const old = slot.exerciseId
    slot.exerciseId = newId
    if (slot.altId === newId) slot.altId = old
    return { ...c, side: getExercise(newId).sided === 'LR' ? 'L' : undefined }
  })
}

// 跳过这个动作：剩下的组都不做
export async function skipExercise(s: Session) {
  await editLayout(s, (blocks, c) => {
    const slot = blocks[c.b]?.slots[c.s]
    if (slot) slot.sets = Math.min(slot.sets, c.r - 1)
  })
}

// 这个动作多做一组
export async function addSet(s: Session) {
  await editLayout(s, (blocks, c) => {
    const slot = blocks[c.b]?.slots[c.s]
    if (slot) slot.sets += 1
  })
}

// 在最后加一个动作（3 组）
export async function appendExercise(s: Session, exerciseId: string, sets = 3) {
  await editLayout(s, (blocks) => {
    blocks.push({ slots: [{ exerciseId, sets }] })
  })
}

export async function updateLog(id: string, load: number, reps: number) {
  await db.setLogs.update(id, { load, reps })
}

export async function deleteLog(id: string) {
  await db.setLogs.delete(id)
}

// 删整次训练（连同它的所有组）
export async function deleteSession(id: string) {
  await db.transaction('rw', db.sessions, db.setLogs, async () => {
    await db.setLogs.where('sessionId').equals(id).delete()
    await db.sessions.delete(id)
  })
}

import { addDays, ymd } from './dates'
import { db } from './db'
import type { Reminder } from './settings'
import { setSetting } from './settings'
import { isEarlyDay } from './week'

// 推送服务器地址（Cloudflare Worker）。部署后填上；调试时可以用 localStorage 的 xunlian.pushUrl 覆盖
const DEPLOYED_URL = 'https://xunlian-push.zhangweijie2006.workers.dev'
export function pushUrl(): string {
  try {
    return localStorage.getItem('xunlian.pushUrl') || DEPLOYED_URL
  } catch {
    return DEPLOYED_URL
  }
}

export const SCHEDULE_DAYS = 21

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function permission(): NotificationPermission | 'unsupported' {
  return pushSupported() ? Notification.permission : 'unsupported'
}

interface DeviceKey {
  id: string
  secret: string
}

async function device(): Promise<DeviceKey> {
  const row = await db.kv.get('pushDevice')
  if (row?.value) return row.value as DeviceKey
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  const d = { id: crypto.randomUUID(), secret: [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('') }
  await db.kv.put({ key: 'pushDevice', value: d })
  return d
}

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : ''
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function call(path: string, body: unknown): Promise<Response> {
  return fetch(pushUrl() + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

async function subscription(): Promise<PushSubscription> {
  const reg = await navigator.serviceWorker.ready
  const existing = await reg.pushManager.getSubscription()
  if (existing) return existing
  const { publicKey } = (await (await fetch(pushUrl() + '/key')).json()) as { publicKey: string }
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlToBytes(publicKey) })
}

async function register(): Promise<void> {
  const d = await device()
  const sub = await subscription()
  const r = await call('/register', { device: d.id, secret: d.secret, subscription: sub.toJSON() })
  if (!r.ok) throw new Error(`注册失败（${r.status}）`)
}

// 开通知：要权限 → 订阅 → 在服务器登记 → 同步提醒时间
export async function enablePush(): Promise<void> {
  if (!pushSupported()) throw new Error('这个浏览器不支持通知')
  if (!pushUrl()) throw new Error('推送服务器还没部署好')
  const p = await Notification.requestPermission()
  if (p !== 'granted') throw new Error(p === 'denied' ? '通知权限被拒绝了' : '没有允许通知')
  await register()
  await setSetting('pushOn', true)
}

export async function disablePush(): Promise<void> {
  const d = await device()
  try {
    await call('/unregister', { device: d.id, secret: d.secret })
    const reg = await navigator.serviceWorker.ready
    await (await reg.pushManager.getSubscription())?.unsubscribe()
  } finally {
    await setSetting('pushOn', false)
  }
}

export async function sendTest(): Promise<void> {
  const d = await device()
  let r = await call('/test', { device: d.id, secret: d.secret })
  if (r.status === 401) {
    await register()
    r = await call('/test', { device: d.id, secret: d.secret })
  }
  if (!r.ok) throw new Error(`发送失败（${r.status}）`)
}

// ---------- 提醒时间 ----------

const TEXT: Record<string, { title: string; body: string; url: string }> = {
  weight: { title: '该记体重了', body: '早上起床、上完厕所、空腹称一下', url: '/Xunlian/#/weigh' },
}

export interface PushItem {
  id: string
  at: number
  title: string
  body: string
  url: string
  tag: string
}

function atTime(day: Date, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h || 0, m || 0).getTime()
}

// 未来 21 天每天什么时候提醒：早起日用 early，不早起的日子用 other；今天已经记过体重就跳过今天
export function buildItems(reminders: Reminder[], flip: boolean, now: Date, doneToday: Record<string, boolean>): PushItem[] {
  const items: PushItem[] = []
  for (const r of reminders) {
    if (!r.enabled) continue
    const text = TEXT[r.id] ?? { title: r.label, body: '', url: '/Xunlian/' }
    for (let i = 0; i < SCHEDULE_DAYS; i++) {
      const day = addDays(now, i)
      if (i === 0 && doneToday[r.id]) continue
      const at = atTime(day, isEarlyDay(day, flip) ? r.early : r.other)
      if (at <= now.getTime()) continue
      items.push({ id: `${r.id}-${ymd(day)}`, at, tag: r.id, ...text })
    }
  }
  return items.sort((a, b) => a.at - b.at)
}

let lastSent = ''

// 把提醒时间同步给服务器（内容没变就不重复发）
export async function syncReminders(reminders: Reminder[], flip: boolean, doneToday: Record<string, boolean>, force = false): Promise<number | null> {
  if (!pushUrl() || !pushSupported() || Notification.permission !== 'granted') return null
  const items = buildItems(reminders, flip, new Date(), doneToday)
  const sig = JSON.stringify(items.map((i) => [i.id, i.at]))
  if (!force && sig === lastSent) return items[0]?.at ?? null
  const d = await device()
  let r = await call('/schedule', { device: d.id, secret: d.secret, items })
  if (r.status === 401) {
    await register()
    r = await call('/schedule', { device: d.id, secret: d.secret, items })
  }
  if (!r.ok) throw new Error(`同步失败（${r.status}）`)
  lastSent = sig
  return items[0]?.at ?? null
}

// 训练记录 App 的提醒推送服务（Cloudflare Worker + Durable Object）
// App 每次打开都把「接下来 21 天什么时候提醒」整份发过来；这里用 Durable Object 的闹钟准点发 Web Push。
// 服务器上只存：推送订阅 + 提醒时间。不存体重、训练数据。
import { DurableObject } from 'cloudflare:workers'
import { generateVapid, sendPush, type PushSubscriptionJSON, type Vapid } from './webpush'

export interface Env {
  HUB: DurableObjectNamespace<PushHub>
  ALLOWED_ORIGINS: string
  ALLOW_HTTP_ENDPOINTS?: string // 只给本地测试用（wrangler dev --var ALLOW_HTTP_ENDPOINTS:1）
}

interface Item {
  id: string // 比如 weight-2026-11-02
  at: number // 什么时候发（毫秒时间戳）
  title: string
  body: string
  url: string
  tag: string
}

interface Device {
  secret: string
  sub: PushSubscriptionJSON
  items: Item[]
  updatedAt: number
}

const MAX_DEVICES = 5
const MAX_ITEMS = 120
const STALE_MS = 2 * 3600_000 // 错过 2 小时以上的提醒就不发了
const SUBJECT = 'https://weijzzz.github.io/Xunlian/'

function cors(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
  return allowed.includes(origin)
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
      }
    : {}
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req, env) })
    const stub = env.HUB.get(env.HUB.idFromName('main'))
    const res = await stub.fetch(req)
    const out = new Response(res.body, res)
    for (const [k, v] of Object.entries(cors(req, env))) out.headers.set(k, v)
    return out
  },
} satisfies ExportedHandler<Env>

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

function validSub(s: unknown, allowHttp: boolean): s is PushSubscriptionJSON {
  const x = s as PushSubscriptionJSON
  const okUrl = typeof x?.endpoint === 'string' && (x.endpoint.startsWith('https://') || (allowHttp && x.endpoint.startsWith('http://')))
  return !!x && okUrl && typeof x.keys?.p256dh === 'string' && typeof x.keys?.auth === 'string'
}

function validItems(items: unknown): items is Item[] {
  return (
    Array.isArray(items) &&
    items.length <= MAX_ITEMS &&
    items.every(
      (i) =>
        i &&
        typeof i.id === 'string' &&
        typeof i.at === 'number' &&
        typeof i.title === 'string' &&
        typeof i.body === 'string' &&
        typeof i.url === 'string' &&
        typeof i.tag === 'string',
    )
  )
}

export class PushHub extends DurableObject<Env> {
  private async vapid(): Promise<Vapid> {
    let v = await this.ctx.storage.get<Vapid>('vapid')
    if (!v) {
      v = await generateVapid(SUBJECT)
      await this.ctx.storage.put('vapid', v)
    }
    return v
  }

  private async devices(): Promise<Map<string, Device>> {
    return (await this.ctx.storage.list<Device>({ prefix: 'device:' })) as Map<string, Device>
  }

  private async authed(body: { device?: string; secret?: string }): Promise<Device | null> {
    if (typeof body.device !== 'string' || typeof body.secret !== 'string') return null
    const d = await this.ctx.storage.get<Device>(`device:${body.device}`)
    return d && d.secret === body.secret ? d : null
  }

  // 把闹钟定到所有设备里最早的那条提醒
  private async reschedule() {
    let next = Infinity
    for (const d of (await this.devices()).values()) for (const i of d.items) next = Math.min(next, i.at)
    if (Number.isFinite(next)) await this.ctx.storage.setAlarm(Math.max(next, Date.now() + 1000))
    else await this.ctx.storage.deleteAlarm()
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const path = url.pathname

    if (req.method === 'GET' && path === '/health') return json({ ok: true })
    if (req.method === 'GET' && path === '/key') return json({ publicKey: (await this.vapid()).publicKey })
    if (req.method !== 'POST') return json({ error: 'not found' }, 404)

    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return json({ error: 'bad json' }, 400)
    }

    if (path === '/register') {
      const { device, secret, subscription } = body as { device?: string; secret?: string; subscription?: unknown }
      if (typeof device !== 'string' || typeof secret !== 'string' || secret.length < 20 || !validSub(subscription, this.env.ALLOW_HTTP_ENDPOINTS === '1')) {
        return json({ error: 'bad request' }, 400)
      }
      const key = `device:${device}`
      const existing = await this.ctx.storage.get<Device>(key)
      if (existing && existing.secret !== secret) return json({ error: 'forbidden' }, 403)
      if (!existing && (await this.devices()).size >= MAX_DEVICES) return json({ error: 'too many devices' }, 403)
      await this.ctx.storage.put<Device>(key, { secret, sub: subscription, items: existing?.items ?? [], updatedAt: Date.now() })
      return json({ ok: true })
    }

    const dev = await this.authed(body as { device?: string; secret?: string })
    if (!dev) return json({ error: 'unknown device' }, 401)
    const key = `device:${body.device as string}`

    if (path === '/schedule') {
      if (!validItems(body.items)) return json({ error: 'bad items' }, 400)
      const now = Date.now()
      dev.items = body.items.filter((i) => i.at > now).sort((a, b) => a.at - b.at)
      dev.updatedAt = now
      await this.ctx.storage.put(key, dev)
      await this.reschedule()
      return json({ ok: true, count: dev.items.length, next: dev.items[0]?.at ?? null })
    }

    if (path === '/test') {
      const r = await sendPush(dev.sub, { title: '测试通知', body: '能看到这条，提醒就设好了 ✓', url: '/Xunlian/#/settings', tag: 'test' }, await this.vapid())
      if (r.gone) await this.ctx.storage.delete(key)
      return json(r, r.ok ? 200 : 502)
    }

    if (path === '/unregister') {
      await this.ctx.storage.delete(key)
      await this.reschedule()
      return json({ ok: true })
    }

    return json({ error: 'not found' }, 404)
  }

  async alarm() {
    const now = Date.now()
    const vapid = await this.vapid()
    for (const [key, dev] of await this.devices()) {
      const due = dev.items.filter((i) => i.at <= now + 1000)
      if (!due.length) continue
      dev.items = dev.items.filter((i) => i.at > now + 1000)
      let gone = false
      for (const i of due) {
        if (now - i.at > STALE_MS) continue
        const r = await sendPush(dev.sub, { title: i.title, body: i.body, url: i.url, tag: i.tag }, vapid)
        if (r.gone) {
          gone = true
          break
        }
      }
      if (gone) await this.ctx.storage.delete(key)
      else await this.ctx.storage.put(key, dev)
    }
    await this.reschedule()
  }
}

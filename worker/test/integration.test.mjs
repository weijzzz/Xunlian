// 本地 wrangler dev 跑起来以后：注册 → 排 3 秒后的提醒 → 闹钟到点 → 收到推送并解密
import { createServer } from 'node:http'
import { createECDH, randomBytes } from 'node:crypto'
import { createRequire } from 'node:module'
const ece = createRequire(import.meta.url)('http_ece')
const W = process.env.WORKER ?? 'http://127.0.0.1:8787'
let fails = 0
const check = (c, m) => { if (!c) fails++; console.log(c ? '  ✓' : '  ✗ FAIL', m) }
const b64u = (b) => Buffer.from(b).toString('base64url')
const post = (path, body, origin) => fetch(W + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body) })

const ua = createECDH('prime256v1'); ua.generateKeys()
const auth = randomBytes(16)
const received = []
const server = createServer((req, res) => { const c = []; req.on('data', (x) => c.push(x)); req.on('end', () => { received.push({ at: Date.now(), body: Buffer.concat(c), auth: req.headers.authorization }); res.statusCode = 201; res.end() }) })
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const sub = { endpoint: `http://127.0.0.1:${server.address().port}/push`, keys: { p256dh: b64u(ua.getPublicKey()), auth: b64u(auth) } }
const device = 'dev-' + randomBytes(4).toString('hex'), secret = randomBytes(24).toString('hex')
const decode = (r) => JSON.parse(ece.decrypt(r.body, { version: 'aes128gcm', privateKey: ua, authSecret: auth }).toString())

const key = await (await fetch(W + '/key')).json()
check(typeof key.publicKey === 'string' && key.publicKey.length > 80, '/key 返回公钥')
check((await post('/register', { device, secret, subscription: sub })).status === 200, '注册设备')
check((await post('/register', { device, secret: 'x'.repeat(30), subscription: sub })).status === 403, '别人用同一个设备 id 注册 → 拒绝')
check((await post('/schedule', { device, secret: 'wrong'.repeat(5), items: [] })).status === 401, '密钥不对 → 401')

const now = Date.now()
const items = [
  { id: 'weight-past', at: now - 60000, title: '过去的', body: 'x', url: '/', tag: 'weight' },
  { id: 'weight-soon', at: now + 3000, title: '该记体重了', body: '早上空腹称一下', url: '/Xunlian/#/weigh', tag: 'weight' },
  { id: 'weight-later', at: now + 86400000, title: '明天', body: 'y', url: '/', tag: 'weight' },
]
const sres = await (await post('/schedule', { device, secret, items })).json()
check(sres.ok && sres.count === 2, `排了 2 条（过去的那条丢掉）：${JSON.stringify(sres)}`)
for (let i = 0; i < 40 && !received.length; i++) await new Promise((r) => setTimeout(r, 250))
check(received.length === 1, `3 秒后闹钟发出 1 条推送（收到 ${received.length} 条）`)
if (received[0]) {
  const msg = decode(received[0])
  check(msg.title === '该记体重了' && msg.url === '/Xunlian/#/weigh' && msg.tag === 'weight', '解密内容正确：' + JSON.stringify(msg))
  check(received[0].at - (now + 3000) < 3000, `准时（晚了 ${received[0].at - (now + 3000)}ms）`)
}
const t = await post('/test', { device, secret })
await new Promise((r) => setTimeout(r, 300))
check(t.status === 200 && received.length === 2 && decode(received[1]).title === '测试通知', '测试通知马上到')

const opt = await fetch(W + '/schedule', { method: 'OPTIONS', headers: { Origin: 'https://weijzzz.github.io', 'Access-Control-Request-Method': 'POST' } })
check(opt.headers.get('access-control-allow-origin') === 'https://weijzzz.github.io', 'CORS 允许 App 的网址')
const bad = await fetch(W + '/key', { headers: { Origin: 'https://evil.example' } })
check(!bad.headers.get('access-control-allow-origin'), 'CORS 不允许别的网站')

check((await post('/unregister', { device, secret })).status === 200, '注销设备')
check((await post('/test', { device, secret })).status === 401, '注销后就不认了')
server.close()
console.log(fails ? `✗ ${fails} 项失败` : '✓ 全部通过')
process.exit(fails ? 1 : 0)

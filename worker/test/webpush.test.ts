// 用独立的 http_ece 库解密，验证我们的 RFC 8291 加密和 VAPID 签名是对的
import { createServer } from 'node:http'
import { createECDH, randomBytes } from 'node:crypto'
import { createRequire } from 'node:module'
import { b64urlDecode, b64urlEncode, generateVapid, sendPush } from '../src/webpush.ts'
const ece = createRequire(import.meta.url)('http_ece')

let fails = 0
const check = (c: boolean, m: string) => { if (!c) fails++; console.log(c ? '  ✓' : '  ✗ FAIL', m) }

// 假装是手机浏览器：生成订阅用的密钥
const ua = createECDH('prime256v1'); ua.generateKeys()
const auth = randomBytes(16)
let got: { headers: Record<string, string | string[] | undefined>; body: Buffer } | null = null
const server = createServer((req, res) => {
  const chunks: Buffer[] = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => { got = { headers: req.headers, body: Buffer.concat(chunks) }; res.statusCode = 201; res.end() })
})
await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
const port = (server.address() as { port: number }).port

const vapid = await generateVapid('https://weijzzz.github.io/Xunlian/')
const sub = { endpoint: `http://127.0.0.1:${port}/push/abc`, keys: { p256dh: b64urlEncode(ua.getPublicKey()), auth: b64urlEncode(auth) } }
const payload = { title: '该记体重了', body: '早上空腹称一下', url: '/Xunlian/#/weigh', tag: 'weight' }
const r = await sendPush(sub, payload, vapid)
check(r.ok && r.status === 201, '推送服务器收到请求（201）')
check(got!.headers['content-encoding'] === 'aes128gcm' && got!.headers['ttl'] === '3600', 'Content-Encoding aes128gcm、TTL')

// 1) 用 http_ece 解密
const plain = ece.decrypt(got!.body, { version: 'aes128gcm', privateKey: ua, authSecret: auth })
check(JSON.stringify(JSON.parse(plain.toString('utf8'))) === JSON.stringify(payload), '独立库解密出来和原文一样（中文也对）')

// 2) 验证 VAPID：k 是公钥，t 是 ES256 JWT，aud = 推送服务器的 origin
const m = /^vapid t=([^,]+), k=(.+)$/.exec(String(got!.headers['authorization']))!
check(!!m && m[2] === vapid.publicKey, 'Authorization 里带着公钥')
const [h, c, s] = m[1].split('.')
const claims = JSON.parse(Buffer.from(b64urlDecode(c)).toString())
check(claims.aud === `http://127.0.0.1:${port}` && claims.sub === 'https://weijzzz.github.io/Xunlian/' && claims.exp > Date.now() / 1000, 'JWT 的 aud / sub / exp 正确')
const pub = await crypto.subtle.importKey('raw', b64urlDecode(m[2]), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, b64urlDecode(s), new TextEncoder().encode(`${h}.${c}`))
check(valid, 'ES256 签名验证通过')

// 3) 订阅失效：410 → gone
const gone = createServer((_q, res) => { res.statusCode = 410; res.end('expired') })
await new Promise<void>((r2) => gone.listen(0, '127.0.0.1', () => r2()))
const r3 = await sendPush({ ...sub, endpoint: `http://127.0.0.1:${(gone.address() as { port: number }).port}/x` }, payload, vapid)
check(r3.gone && !r3.ok, '410 时标记订阅失效')
server.close(); gone.close()
console.log(fails ? `✗ ${fails} 项失败` : '✓ 全部通过')
process.exit(fails ? 1 : 0)

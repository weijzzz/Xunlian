// Web Push：只用 WebCrypto，Cloudflare Workers 和 Node 都能跑
// - 加密：RFC 8291（Message Encryption for Web Push）+ RFC 8188 aes128gcm
// - 身份：RFC 8292 VAPID（ES256 JWT）

export interface PushSubscriptionJSON {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export interface Vapid {
  publicKey: string // base64url，65 字节未压缩点
  privateJwk: JsonWebKey
  subject: string // mailto: 或 https: 联系方式
}

const enc = new TextEncoder()

export function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : ''
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8)
  return new Uint8Array(bits)
}

// 生成 VAPID 密钥对（第一次启动时由服务器自己生成并保存）
export async function generateVapid(subject: string): Promise<Vapid> {
  const kp = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair
  const pub = new Uint8Array((await crypto.subtle.exportKey('raw', kp.publicKey)) as ArrayBuffer)
  const privateJwk = (await crypto.subtle.exportKey('jwk', kp.privateKey)) as JsonWebKey
  return { publicKey: b64urlEncode(pub), privateJwk, subject }
}

export async function vapidJWT(audience: string, vapid: Vapid, expSeconds = 12 * 3600): Promise<string> {
  const header = b64urlEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = b64urlEncode(
    enc.encode(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + expSeconds, sub: vapid.subject })),
  )
  const key = await crypto.subtle.importKey('jwk', vapid.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  // WebCrypto 的 ECDSA 签名本来就是 r||s（64 字节），正好是 JWS 要的格式
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`))
  return `${header}.${claims}.${b64urlEncode(sig)}`
}

// 按 RFC 8291 加密，返回请求体（aes128gcm 格式）
export async function encryptPayload(sub: PushSubscriptionJSON, payload: Uint8Array): Promise<Uint8Array> {
  const uaPublic = b64urlDecode(sub.keys.p256dh)
  const authSecret = b64urlDecode(sub.keys.auth)

  const as = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair
  const asPublic = new Uint8Array((await crypto.subtle.exportKey('raw', as.publicKey)) as ArrayBuffer)
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  // 标准参数名是 public（workers-types 里写成 $public，运行时用的还是 public）
  const ecdhParams = { name: 'ECDH', public: uaKey } as unknown as Parameters<typeof crypto.subtle.deriveBits>[0]
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits(ecdhParams, as.privateKey, 256))

  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic)
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32)

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12)

  const plaintext = concat(payload, new Uint8Array([2])) // 0x02 = 最后一条记录的分隔符
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plaintext))

  const rs = new Uint8Array(4)
  new DataView(rs.buffer).setUint32(0, 4096)
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, ciphertext)
}

export interface PushResult {
  ok: boolean
  status: number
  gone: boolean // 订阅失效（404/410），该删掉
  text?: string
}

export async function sendPush(sub: PushSubscriptionJSON, data: unknown, vapid: Vapid, ttl = 3600): Promise<PushResult> {
  const body = await encryptPayload(sub, enc.encode(JSON.stringify(data)))
  const audience = new URL(sub.endpoint).origin
  const jwt = await vapidJWT(audience, vapid)
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      TTL: String(ttl),
      Urgency: 'high',
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
    },
    body,
  })
  const text = res.ok ? undefined : await res.text().catch(() => '')
  return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410, text }
}

// 小人动画引擎：侧视图，y 轴向下。角度单位：度，0 = 向右，-90 = 向上，90 = 向下。
// 姿势只给出髋、躯干方向、手脚落点，肘和膝用两段式 IK 自动算，所以四肢长度永远不变。

export type P = [number, number]

export const BODY = {
  torso: 28,
  head: 11, // 肩 → 头中心
  headR: 7,
  upperArm: 15,
  forearm: 14.5,
  thigh: 21.5,
  shin: 21,
  foot: 6,
}
export const ARM = BODY.upperArm + BODY.forearm
export const LEG = BODY.thigh + BODY.shin

// 手：at = 绝对位置；rel = [相对躯干方向的角度, 离肩膀的距离]（适合绕肩摆动的动作）
export type Hand = { at: P } | { rel: [number, number] }

// 脚：直接给踝的坐标，或者 rel = [相对躯干方向的角度, 离髋的距离]（腿跟着上身一起转，比如 RDL 的后腿）
export type Foot = P | { rel: [number, number] }

export interface Pose {
  hip: P
  torso: number // 髋 → 肩的方向
  head?: number // 头相对躯干的角度（低头/抬头）
  hands: [Hand, Hand] // 近侧、远侧
  feet: [Foot, Foot] // 近侧、远侧
  toes?: [number, number] // 脚尖方向（绝对角度）
}

export interface Joints {
  hip: P
  shoulder: P
  head: P
  torso: number
  elbow: [P, P]
  hand: [P, P]
  knee: [P, P]
  ankle: [P, P]
  toe: [P, P]
}

const rad = (d: number) => (d * Math.PI) / 180
export const dir = (deg: number, len = 1): P => [Math.cos(rad(deg)) * len, Math.sin(rad(deg)) * len]
export const add = (a: P, b: P): P => [a[0] + b[0], a[1] + b[1]]
export const sub = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1]]
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const lerpP = (a: P, b: P, t: number): P => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]

// 两段式 IK：从 a 出发，末端尽量够到 t。sign 决定关节往哪边弯
export function ik(a: P, t: P, l1: number, l2: number, sign: number): [P, P] {
  const dx = t[0] - a[0]
  const dy = t[1] - a[1]
  const d = Math.min(l1 + l2 - 1e-3, Math.max(Math.abs(l1 - l2) + 1e-3, Math.hypot(dx, dy)))
  const base = Math.atan2(dy, dx)
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)
  const alpha = Math.acos(Math.min(1, Math.max(-1, cosA)))
  const joint: P = [a[0] + l1 * Math.cos(base + sign * alpha), a[1] + l1 * Math.sin(base + sign * alpha)]
  const end: P = [a[0] + d * Math.cos(base), a[1] + d * Math.sin(base)]
  return [joint, end]
}

export function shoulderOf(p: Pose): P {
  return add(p.hip, dir(p.torso, BODY.torso))
}

// 已知肩的位置和躯干方向，反推髋（躺着的动作肩膀贴地不动时用）
export function hipFrom(shoulder: P, torso: number): P {
  return sub(shoulder, dir(torso, BODY.torso))
}

// 身体从脚踝到肩一条直线（俯卧撑、反向划船）
export function plank(ankle: P, angle: number): { hip: P; torso: number; shoulder: P } {
  const hip = add(ankle, dir(angle, LEG))
  return { hip, torso: angle, shoulder: add(hip, dir(angle, BODY.torso)) }
}

// 直线身体，肩膀落在指定高度
export function plankToHeight(ankle: P, shoulderY: number) {
  const angle = (Math.asin((shoulderY - ankle[1]) / (LEG + BODY.torso)) * 180) / Math.PI
  return plank(ankle, angle)
}

export function solve(p: Pose, elbowSign: [number, number], kneeSign: [number, number]): Joints {
  const shoulder = shoulderOf(p)
  const head = add(shoulder, dir(p.torso + (p.head ?? 0), BODY.head))
  const elbow: P[] = []
  const hand: P[] = []
  p.hands.forEach((h, i) => {
    const target = 'at' in h ? h.at : add(shoulder, dir(p.torso + h.rel[0], h.rel[1]))
    const [e, w] = ik(shoulder, target, BODY.upperArm, BODY.forearm, elbowSign[i])
    elbow.push(e)
    hand.push(w)
  })
  const knee: P[] = []
  const ankle: P[] = []
  const toe: P[] = []
  p.feet.forEach((f, i) => {
    const target = Array.isArray(f) ? f : add(p.hip, dir(p.torso + f.rel[0], f.rel[1]))
    const [k, a] = ik(p.hip, target, BODY.thigh, BODY.shin, kneeSign[i])
    knee.push(k)
    ankle.push(a)
    toe.push(add(a, dir(p.toes?.[i] ?? 0, BODY.foot)))
  })
  return {
    hip: p.hip,
    shoulder,
    head,
    torso: p.torso,
    elbow: elbow as [P, P],
    hand: hand as [P, P],
    knee: knee as [P, P],
    ankle: ankle as [P, P],
    toe: toe as [P, P],
  }
}

function lerpFoot(a: Foot, b: Foot, t: number): Foot {
  if (Array.isArray(a) && Array.isArray(b)) return lerpP(a, b, t)
  if (!Array.isArray(a) && !Array.isArray(b)) return { rel: [lerp(a.rel[0], b.rel[0], t), lerp(a.rel[1], b.rel[1], t)] }
  return t < 0.5 ? a : b
}

function lerpHand(a: Hand, b: Hand, t: number): Hand {
  if ('at' in a && 'at' in b) return { at: lerpP(a.at, b.at, t) }
  if ('rel' in a && 'rel' in b) return { rel: [lerp(a.rel[0], b.rel[0], t), lerp(a.rel[1], b.rel[1], t)] }
  return t < 0.5 ? a : b
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return {
    hip: lerpP(a.hip, b.hip, t),
    torso: lerp(a.torso, b.torso, t),
    head: lerp(a.head ?? 0, b.head ?? 0, t),
    hands: [lerpHand(a.hands[0], b.hands[0], t), lerpHand(a.hands[1], b.hands[1], t)],
    feet: [lerpFoot(a.feet[0], b.feet[0], t), lerpFoot(a.feet[1], b.feet[1], t)],
    toes: [lerp(a.toes?.[0] ?? 0, b.toes?.[0] ?? 0, t), lerp(a.toes?.[1] ?? 0, b.toes?.[1] ?? 0, t)],
  }
}

// 时间轴：从 poses[0] 开始；move = 用 dur 秒移到第 to 个姿势；hold = 停一会儿
export type Step = { to: number; dur: number } | { hold: number }

export interface AnimDef {
  viewBox: [number, number, number, number]
  elbow: [number, number]
  knee: [number, number]
  poses: Pose[]
  timeline: Step[]
  floor?: number // 地面 y（不画就不给）
  back?: (j: Joints) => string // 画在小人后面的道具（SVG 片段）
  mid?: (j: Joints) => string // 画在躯干上、近侧手臂下（背包）
  front?: (j: Joints) => string // 画在小人前面的道具
}

const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t)

export function totalDuration(def: AnimDef): number {
  return def.timeline.reduce((s, st) => s + ('hold' in st ? st.hold : st.dur), 0)
}

export function poseAt(def: AnimDef, time: number): Pose {
  const total = totalDuration(def)
  let t = total > 0 ? time % total : 0
  let cur = 0
  for (const st of def.timeline) {
    const d = 'hold' in st ? st.hold : st.dur
    if (t <= d) {
      if ('hold' in st) return def.poses[cur]
      return lerpPose(def.poses[cur], def.poses[st.to], ease(d ? t / d : 1))
    }
    t -= d
    if (!('hold' in st)) cur = st.to
  }
  return def.poses[cur]
}

// ---------- 画 ----------

export const COLOR = {
  near: '#f4f4f5',
  far: '#71717a',
  prop: '#52525b',
  propLight: '#a1a1aa',
  floor: '#3f3f46',
  backpack: '#a3e635',
  rice: '#fcd34d',
  water: '#38bdf8',
}

const f = (n: number) => n.toFixed(1)
const pts = (...ps: P[]) => ps.map((p) => `${f(p[0])},${f(p[1])}`).join(' ')

function limb(points: P[], color: string, w: number): string {
  return `<polyline points="${pts(...points)}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`
}

export function renderSVG(def: AnimDef, j: Joints): string {
  const W = 5.5
  let s = ''
  if (def.floor !== undefined) {
    const [x, , w] = def.viewBox
    s += `<line x1="${x}" y1="${def.floor}" x2="${x + w}" y2="${def.floor}" stroke="${COLOR.floor}" stroke-width="2"/>`
  }
  if (def.back) s += def.back(j)
  // 远侧手脚（灰色，画在后面）
  s += limb([j.hip, j.knee[1], j.ankle[1], j.toe[1]], COLOR.far, W)
  s += limb([j.shoulder, j.elbow[1], j.hand[1]], COLOR.far, W)
  // 躯干、头、近侧手脚
  s += limb([j.hip, j.shoulder], COLOR.near, W + 1.5)
  s += `<circle cx="${f(j.head[0])}" cy="${f(j.head[1])}" r="${BODY.headR}" fill="${COLOR.near}"/>`
  if (def.mid) s += def.mid(j)
  s += limb([j.hip, j.knee[0], j.ankle[0], j.toe[0]], COLOR.near, W)
  s += limb([j.shoulder, j.elbow[0], j.hand[0]], COLOR.near, W)
  if (def.front) s += def.front(j)
  return s
}

// ---------- 常用道具 ----------

export function rect(x: number, y: number, w: number, h: number, fill: string, rx = 2): string {
  return `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${rx}" fill="${fill}"/>`
}

// 背在背上的背包：沿躯干放，贴在背的那一侧（side = -1 / 1 选哪一边算"背"）
export function backpack(j: Joints, side = -1, at = 0.55): string {
  const c = add(j.hip, dir(j.torso, BODY.torso * at))
  const n = dir(j.torso + 90 * side, 7)
  const center = add(c, n)
  return `<g transform="translate(${f(center[0])} ${f(center[1])}) rotate(${f(j.torso)})"><rect x="-9" y="-4.5" width="18" height="9" rx="3" fill="${COLOR.backpack}"/></g>`
}

// 手里提着的东西（挂在手下面）
export function hanging(hand: P, color: string, w = 11, h = 13): string {
  return `<line x1="${f(hand[0])}" y1="${f(hand[1])}" x2="${f(hand[0])}" y2="${f(hand[1] + 3)}" stroke="${color}" stroke-width="2"/>` + rect(hand[0] - w / 2, hand[1] + 2, w, h, color, 3)
}

export function chair(x: number, seatY: number, w: number, floor: number): string {
  return (
    rect(x, seatY, w, 4, COLOR.prop, 1.5) +
    rect(x + 1, seatY + 3, 3, floor - seatY - 3, COLOR.prop, 1) +
    rect(x + w - 4, seatY + 3, 3, floor - seatY - 3, COLOR.prop, 1)
  )
}

export function books(cx: number, top: number, floor: number): string {
  const h = floor - top
  return rect(cx - 10, top, 20, h / 2, '#71717a', 1.5) + rect(cx - 11, top + h / 2, 22, h / 2, '#52525b', 1.5)
}

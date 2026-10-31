// 13 个动作的小人动画。姿势按动作手册画，节奏按要点（比如下放 2-3 秒、底部停半秒）
import {
  add,
  ARM,
  backpack,
  books,
  chair,
  COLOR,
  dir,
  hanging,
  hipFrom,
  LEG,
  BODY,
  plank,
  plankToHeight,
  rect,
  type AnimDef,
  type Joints,
  type P,
  type Pose,
} from './figure'

const FLOOR = 100
const at = (p: P) => ({ at: p })
const rel = (a: number, d: number) => ({ rel: [a, d] as [number, number] })

// 在一个角度范围里找直线身体的角度，让肩膀离目标点刚好 dist（反向划船用）
function plankReaching(heel: P, target: P, dist: number, from: number, to: number) {
  let best = from
  let bestErr = Infinity
  for (let a = from; a <= to; a += 0.25) {
    const s = plank(heel, a).shoulder
    const err = Math.abs(Math.hypot(s[0] - target[0], s[1] - target[1]) - dist)
    if (err < bestErr) {
      bestErr = err
      best = a
    }
  }
  return plank(heel, best)
}

// 下放慢、底部停、发力起的标准节奏
const tempo = (down: number, bottom: number, up: number, top = 0.4) => [
  { hold: top },
  { to: 1, dur: down },
  { hold: bottom },
  { to: 0, dur: up },
]

// ---------- 推 ----------

function deficitPushup(): AnimDef {
  const ankle: P = [36, 95]
  const handY = 87 // 手撑在书上
  const top = plankToHeight(ankle, handY - ARM + 0.5)
  const hand: P = [top.shoulder[0], handY]
  const bot = plankToHeight(ankle, handY + 3) // 胸低过手
  const pose = (b: { hip: P; torso: number }): Pose => ({
    hip: b.hip,
    torso: b.torso,
    hands: [at(hand), at([hand[0] - 2, hand[1] - 0.5])],
    feet: [ankle, [ankle[0] - 2, ankle[1] - 0.5]],
    toes: [100, 100],
  })
  return {
    viewBox: [20, 40, 140, 64],
    floor: FLOOR,
    elbow: [1, 1],
    knee: [-1, -1],
    poses: [pose(top), pose(bot)],
    timeline: tempo(2.5, 0.5, 1),
    back: () => books(hand[0], handY, FLOOR),
    mid: (j) => backpack(j, -1, 0.45),
  }
}

function declinePushup(handBack: number): AnimDef {
  const seat = 76
  const ankle: P = [34, seat - 5]
  const bot = plankToHeight(ankle, 87)
  // 手在胸口下方（比底部时的肩膀靠后），底部时上臂才会向后、手肘朝上
  const hand: P = [bot.shoulder[0] - handBack, 97]
  const top = plankReaching(ankle, hand, ARM - 0.5, -20, 10)
  const pose = (b: { hip: P; torso: number }): Pose => ({
    hip: b.hip,
    torso: b.torso,
    hands: [at(hand), at([hand[0] - 2, hand[1] - 0.5])],
    feet: [ankle, [ankle[0] - 2, ankle[1] - 0.5]],
    toes: [100, 100],
  })
  return {
    viewBox: [10, 40, 140, 64],
    floor: FLOOR,
    elbow: [1, 1],
    knee: [-1, -1],
    poses: [pose(top), pose(bot)],
    timeline: tempo(2.5, 0.3, 1),
    back: () => chair(16, seat, 30, FLOOR),
    mid: (j) => backpack(j, -1, 0.45),
  }
}

function pikePushup(): AnimDef {
  const hand: P = [119, 97]
  const foot: P = [74, 95]
  const pose = (hip: P, torso: number): Pose => ({
    hip,
    torso,
    head: 8,
    hands: [at(hand), at([hand[0] - 2, hand[1] - 0.5])],
    feet: [foot, [foot[0] - 2, foot[1] - 0.5]],
    toes: [75, 75],
  })
  return {
    viewBox: [50, 36, 100, 66],
    floor: FLOOR,
    elbow: [1, 1],
    knee: [-1, -1],
    poses: [pose([84, 55], 45), pose([95, 60], 42)],
    timeline: tempo(2.5, 0.4, 1),
  }
}

// ---------- 拉 ----------

function pullup(): AnimDef {
  const barY = 14
  const hand: P = [101, barY + 1]
  const bottomShoulder: P = [95, barY + ARM - 1]
  const topShoulder: P = [92, 28]
  const pose = (s: P, head: number): Pose => {
    const hip = hipFrom(s, -90)
    return {
      hip,
      torso: -90,
      head,
      hands: [at(hand), at([hand[0] - 2, hand[1]])],
      // 膝盖弯，脚踝在身后交叉
      feet: [
        [hip[0] - 13, hip[1] + 29],
        [hip[0] - 11, hip[1] + 28],
      ],
      toes: [110, 110],
    }
  }
  return {
    viewBox: [40, 0, 110, 118],
    elbow: [1, 1],
    knee: [-1, -1],
    poses: [pose(bottomShoulder, 0), pose(topShoulder, -18)],
    timeline: [{ hold: 0.6 }, { to: 1, dur: 1.2 }, { hold: 0.4 }, { to: 0, dur: 2.5 }],
    back: () =>
      `<line x1="45" y1="${barY}" x2="145" y2="${barY}" stroke="${COLOR.propLight}" stroke-width="3.5" stroke-linecap="round"/>`,
  }
}

function backpackRow(): AnimDef {
  const bedTop = 78
  const hip: P = [84, 54.5]
  const torso = -4
  const shoulder = add(hip, dir(torso, BODY.torso))
  const pose = (h: P): Pose => ({
    hip,
    torso,
    head: 12,
    hands: [at(h), at([shoulder[0] + 2, bedTop])],
    feet: [
      [82, 96],
      [63, bedTop - 2.5],
    ],
    toes: [0, 180],
  })
  return {
    viewBox: [40, 30, 125, 72],
    floor: FLOOR,
    elbow: [1, 1],
    knee: [-1, -1],
    poses: [pose([shoulder[0] + 1, shoulder[1] + ARM - 1.5]), pose([95, 57])],
    timeline: [{ hold: 0.4 }, { to: 1, dur: 1 }, { hold: 1 }, { to: 0, dur: 3 }],
    back: () => rect(60, bedTop, 95, FLOOR - bedTop, COLOR.prop, 3),
    front: (j: Joints) => hanging(j.hand[0], COLOR.backpack, 13, 15),
  }
}

function pullover(): AnimDef {
  const s: P = [102, 89]
  const hip = hipFrom(s, 0)
  const pose = (handRel: number): Pose => ({
    hip,
    torso: 0,
    hands: [rel(handRel, 27), rel(handRel - 2, 27)],
    feet: [
      [52, 94],
      [50, 93.5],
    ],
    toes: [180, 180],
  })
  return {
    viewBox: [30, 50, 120, 52],
    floor: 96,
    elbow: [-1, -1],
    knee: [1, 1],
    poses: [pose(-90), pose(-8)],
    timeline: tempo(2.5, 0.4, 1.2),
    front: (j: Joints) => {
      const c = j.hand[0]
      return (
        `<path d="M${c[0] - 5} ${c[1] - 3} Q${c[0]} ${c[1] - 10} ${c[0] + 5} ${c[1] - 3}" fill="none" stroke="${COLOR.water}" stroke-width="1.5"/>` +
        rect(c[0] - 6, c[1] - 3, 12, 11, COLOR.water, 2)
      )
    },
  }
}

function invertedRow(): AnimDef {
  const heel: P = [34, 95]
  const top = plank(heel, -30)
  // 顶端：胸口碰杠，肘在身体下面
  const elbowTop = add(top.shoulder, dir(110, BODY.upperArm))
  const bar = add(elbowTop, dir(-90, BODY.forearm))
  const bot = plankReaching(heel, bar, ARM - 0.5, -20, 0)
  const pose = (b: { hip: P; torso: number }): Pose => ({
    hip: b.hip,
    torso: b.torso,
    hands: [at(bar), at([bar[0] - 2, bar[1]])],
    feet: [heel, [heel[0] - 2, heel[1] - 0.5]],
    toes: [-60, -60],
  })
  return {
    viewBox: [20, 30, 135, 72],
    floor: FLOOR,
    elbow: [-1, -1],
    knee: [1, 1],
    poses: [pose(bot), pose(top)],
    timeline: [{ hold: 0.4 }, { to: 1, dur: 1.2 }, { hold: 0.5 }, { to: 0, dur: 2.5 }],
    back: () =>
      `<line x1="${bar[0] - 30}" y1="${bar[1]}" x2="${bar[0] + 40}" y2="${bar[1]}" stroke="${COLOR.propLight}" stroke-width="3.5" stroke-linecap="round"/>` +
      rect(bar[0] + 38, bar[1], 3, FLOOR - bar[1], COLOR.prop, 1),
  }
}

// ---------- 腿 ----------

function bss(): AnimDef {
  const seat = 76
  const rear: P = [40, seat - 4]
  const front: P = [90, 95]
  const pose = (hip: P, torso: number): Pose => ({
    hip,
    torso,
    hands: [rel(168 - (torso + 90), 25), rel(166 - (torso + 90), 25)],
    feet: [front, rear],
    toes: [0, 200],
  })
  return {
    viewBox: [15, 10, 105, 92],
    floor: FLOOR,
    elbow: [1, 1],
    knee: [-1, -1],
    poses: [pose([79, 55], -78), pose([77, 75], -70)],
    timeline: tempo(3, 0.3, 1),
    back: () => chair(22, seat, 30, FLOOR),
    mid: (j: Joints) => backpack(j, -1),
  }
}

function slRdl(): AnimDef {
  const stand: P = [80, 95]
  const top: Pose = {
    hip: [80, 54],
    torso: -88,
    hands: [at([103, 44]), rel(178, 27)],
    feet: [stand, { rel: [177, LEG - 3] }],
    toes: [0, 10],
  }
  const hipB: P = [73, 57]
  const bottom: Pose = {
    hip: hipB,
    torso: -6,
    head: 4,
    hands: [at([112, 57]), rel(96, 28)],
    feet: [stand, { rel: [180, LEG - 0.5] }],
    toes: [0, 95],
  }
  return {
    viewBox: [20, 8, 110, 94],
    floor: FLOOR,
    elbow: [1, 1],
    knee: [-1, -1],
    poses: [top, bottom],
    timeline: tempo(3, 0.4, 1.2),
    // 墙：画成背景平面，扶墙的手贴在上面
    back: () => rect(98, 10, 30, FLOOR - 10, '#27272a', 0),
    front: (j: Joints) => hanging(j.hand[1], COLOR.backpack, 12, 14),
  }
}

// ---------- 腹 ----------

function reverseCrunch(): AnimDef {
  const s: P = [104, 89]
  const flatHip = hipFrom(s, 0)
  const curlHip = hipFrom(s, 18)
  const hands = [at([80, 93]), at([79, 92.5])] as Pose['hands']
  return {
    viewBox: [30, 34, 120, 68],
    floor: 96,
    elbow: [1, 1],
    knee: [1, 1],
    poses: [
      {
        hip: flatHip,
        torso: 0,
        hands,
        feet: [
          [flatHip[0] - BODY.shin, flatHip[1] - BODY.thigh],
          [flatHip[0] - BODY.shin + 1, flatHip[1] - BODY.thigh - 1],
        ],
        toes: [180, 180],
      },
      {
        hip: curlHip,
        torso: 18,
        hands,
        feet: [
          [curlHip[0] + 2, curlHip[1] - 30],
          [curlHip[0] + 3, curlHip[1] - 31],
        ],
        toes: [200, 200],
      },
    ],
    timeline: [{ hold: 0.3 }, { to: 1, dur: 1.2 }, { hold: 1 }, { to: 0, dur: 2.5 }],
  }
}

function weightedCrunch(): AnimDef {
  const hip: P = [76, 89]
  const pose = (torso: number, head: number): Pose => ({
    hip,
    torso,
    head,
    hands: [rel(-150, 11), rel(-152, 11)],
    feet: [
      [54, 94],
      [52, 93.5],
    ],
    toes: [180, 180],
  })
  return {
    viewBox: [30, 44, 110, 58],
    floor: 96,
    elbow: [-1, -1],
    knee: [1, 1],
    poses: [pose(0, 0), pose(-26, -12)],
    timeline: [{ hold: 0.3 }, { to: 1, dur: 1 }, { hold: 1 }, { to: 0, dur: 2.5 }],
    front: (j: Joints) => {
      const c = add(j.hand[0], dir(j.torso - 90, 2))
      return `<g transform="translate(${c[0].toFixed(1)} ${c[1].toFixed(1)}) rotate(${j.torso.toFixed(1)})"><rect x="-7" y="-5" width="14" height="9" rx="3" fill="${COLOR.rice}"/></g>`
    },
  }
}

function deadBug(): AnimDef {
  const s: P = [104, 89]
  const hip = hipFrom(s, 0)
  const bent: P = [hip[0] - BODY.shin, hip[1] - BODY.thigh]
  const bentFar: P = [bent[0] + 1, bent[1] - 1]
  const out: P = [hip[0] - LEG + 1.5, hip[1] - 4]
  const up = rel(-90, 28)
  const over = rel(-8, 28)
  const pose = (h0: Pose['hands'][0], h1: Pose['hands'][1], f0: P, f1: P): Pose => ({
    hip,
    torso: 0,
    hands: [h0, h1],
    feet: [f0, f1],
    toes: [180, 180],
  })
  return {
    viewBox: [22, 50, 130, 52],
    floor: 96,
    elbow: [1, 1],
    knee: [1, 1],
    poses: [
      pose(up, rel(-92, 28), bent, bentFar),
      pose(over, rel(-92, 28), bent, out), // 右手 + 左腿
      pose(up, over, out, bentFar), // 左手 + 右腿
    ],
    timeline: [
      { hold: 0.4 },
      { to: 1, dur: 3 },
      { hold: 0.3 },
      { to: 0, dur: 2 },
      { hold: 0.4 },
      { to: 2, dur: 3 },
      { hold: 0.3 },
      { to: 0, dur: 2 },
    ],
  }
}

export const ANIMS: Record<string, AnimDef> = {
  deficit_pushup: deficitPushup(),
  decline_wide_pushup: declinePushup(10),
  pike_pushup: pikePushup(),
  diamond_pushup: declinePushup(13),
  pullup: pullup(),
  backpack_row: backpackRow(),
  pullover: pullover(),
  inverted_row: invertedRow(),
  bss: bss(),
  sl_rdl: slRdl(),
  reverse_crunch: reverseCrunch(),
  weighted_crunch: weightedCrunch(),
  dead_bug: deadBug(),
}

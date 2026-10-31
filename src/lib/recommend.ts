import { GROUP_NAME, type Group, type Location, type Session, type Template } from '../data/types'
import { addDays, mondayOf, weekdayIndex, WEEKDAY_NAME } from './dates'
import { blocksGroups } from './library'
import { FATIGUE_HOURS } from './progress'

// 「今天练什么」：需求文档 5.5
// 1. 在家 → 不推荐要在外面练的卡；在外面 → 优先外面的卡
// 2. 卡里的肌群 48 小时内练过 → 不推荐（硬要练 = 疲劳模式）
// 3. 剩下的：优先今天排好的卡；没有就选「最久没练的肌群」所在的卡；平手时单周优先分化卡、双周优先全身
// 4. 双周的全身没练成 → 拆成「上肢A + 下肢」放在相邻两天

export interface Blocked {
  template: Template
  reason: string
}

export interface Recommendation {
  template: Template | null
  reasons: string[]
  blocked: Blocked[] // 因为 48 小时不推荐的
  splitHint: string | null
}

const FULL_ID = 'full'
const SPLIT_IDS = ['upper_a', 'lower'] as const

function mainGroups(t: Template): Group[] {
  return blocksGroups(t.blocks).filter((g) => g !== 'core')
}

const isFullBody = (t: Template) => {
  const g = mainGroups(t)
  return g.includes('push') && g.includes('pull') && g.includes('legs')
}

function ago(hours: number): string {
  if (!Number.isFinite(hours)) return '还没练过'
  if (hours < 48) return `${Math.round(hours)} 小时前练过`
  return `${Math.round(hours / 24)} 天没练`
}

export function recommend(opts: {
  templates: Template[]
  location: Location
  now: Date
  parity: 'odd' | 'even'
  todayPlanId: string | undefined
  planFor: (d: Date) => string | undefined // 某天排的是什么卡
  lastTrained: Map<Group, number> // 每个肌群最后一次练的时间（腹不算）
  sessions: Session[] // 用来判断这周的全身有没有练
}): Recommendation {
  const { templates, location, now, parity, todayPlanId, lastTrained } = opts
  const t0 = now.getTime()
  const hoursSince = (g: Group) => {
    const t = lastTrained.get(g)
    return t === undefined ? Infinity : (t0 - t) / 3_600_000
  }

  let pool = templates.filter((t) => t.blocks.length > 0)
  if (location === 'home') pool = pool.filter((t) => t.location === 'home')

  const blocked: Blocked[] = []
  const ok: Template[] = []
  for (const t of pool) {
    const tired = mainGroups(t).filter((g) => hoursSince(g) < FATIGUE_HOURS)
    if (tired.length) {
      blocked.push({ template: t, reason: tired.map((g) => `${GROUP_NAME[g]} ${Math.round(hoursSince(g))} 小时前练过`).join('、') })
    } else ok.push(t)
  }

  // 规则 4：双周排的全身已经过了那天还没练 → 拆开
  let splitHint: string | null = null
  let splitPick: Template | undefined
  if (location === 'home' && parity === 'even') {
    const monday = mondayOf(now)
    const todayIdx = weekdayIndex(now)
    for (let i = 0; i < todayIdx; i++) {
      const day = addDays(monday, i)
      if (opts.planFor(day) !== FULL_ID) continue
      const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime()
      const doneFull = opts.sessions.some((s) => s.templateId === FULL_ID && s.startedAt >= dayStart)
      if (doneFull) continue
      const doneSince = (id: string) => opts.sessions.some((s) => s.templateId === id && s.startedAt >= dayStart)
      const remaining = SPLIT_IDS.filter((id) => !doneSince(id))
      const names = { upper_a: '上肢A', lower: '下肢' } as const
      if (remaining.length) {
        splitHint = `这周${WEEKDAY_NAME[i]}的全身没练成 → 拆成${remaining.map((id) => names[id]).join(' + ')}${remaining.length > 1 ? '，放在相邻两天' : ''}`
        splitPick = ok.find((t) => t.id === remaining[0]) ?? ok.find((t) => t.id === remaining[1])
      }
      break
    }
  }

  const reasons: string[] = []
  let pick: Template | undefined

  // 在外面：优先外面的卡
  const preferred = location === 'out' ? ok.filter((t) => t.location === 'out') : []
  const candidates = preferred.length ? preferred : ok
  if (location === 'out' && preferred.length) reasons.push('在外面，有单杠')

  const todays = todayPlanId ? candidates.find((t) => t.id === todayPlanId) : undefined
  if (todays) {
    pick = todays
    reasons.push(`今天排的是${todays.name}`)
  } else if (splitPick && candidates.includes(splitPick)) {
    pick = splitPick
    reasons.push('拆全身：先练这张')
  } else if (candidates.length) {
    // 最久没练的肌群
    const groups = [...new Set(candidates.flatMap(mainGroups))]
    groups.sort((a, b) => hoursSince(b) - hoursSince(a))
    const stalest = groups[0]
    let list = stalest ? candidates.filter((t) => mainGroups(t).includes(stalest)) : candidates
    if (list.length > 1) {
      const wantFull = parity === 'even'
      const pref = list.filter((t) => isFullBody(t) === wantFull)
      if (pref.length) list = pref
    }
    pick = list[0]
    if (stalest) reasons.push(`${GROUP_NAME[stalest]}${ago(hoursSince(stalest))}`)
    if (todayPlanId === undefined) reasons.push('今天没排训练')
    else {
      const planned = templates.find((t) => t.id === todayPlanId)
      if (planned && !candidates.includes(planned)) reasons.push(`今天排的${planned.name}现在不适合`)
    }
  }

  return { template: pick ?? null, reasons, blocked, splitHint }
}

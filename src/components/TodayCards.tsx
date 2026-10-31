import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { type Location } from '../data/types'
import { DAILY_ITEMS } from '../data/exercises'
import { weekdayIndex, ymd } from '../lib/dates'
import { toggleDaily, useDaily } from '../lib/daily'
import { db } from '../lib/db'
import { useLibrary } from '../lib/library'
import { estimateMinutes } from '../lib/plan'
import { lastTrained } from '../lib/progress'
import { recommend } from '../lib/recommend'
import { navigate } from '../lib/router'
import { useSchedule } from '../lib/schedule'
import { weekParity } from '../lib/week'
import { Button } from './ui'

const SEG = (on: boolean) =>
  `h-9 rounded-md px-3 text-[15px] font-semibold ${on ? 'bg-zinc-600 text-white' : 'text-zinc-300 active:text-white'}`

// 首页「今天练什么」
export function RecommendCard({ now }: { now: Date }) {
  const { templates } = useLibrary()
  const sched = useSchedule()
  const [location, setLocation] = useState<Location>(weekdayIndex(now) === 6 ? 'out' : 'home')
  const [short, setShort] = useState(false)
  const since = now.getTime() - 14 * 86_400_000
  const recentLogs = useLiveQuery(() => db.setLogs.where('doneAt').above(since).toArray(), [Math.floor(since / 3_600_000)])
  const recentSessions = useLiveQuery(() => db.sessions.where('startedAt').above(since).toArray(), [Math.floor(since / 3_600_000)])
  if (!recentLogs || !recentSessions || !sched.loaded) return null

  const rec = recommend({
    templates,
    location,
    now,
    parity: weekParity(now, sched.flip),
    todayPlanId: sched.dayPlan(now).id,
    planFor: (d) => sched.dayPlan(d).id,
    lastTrained: lastTrained(recentLogs),
    sessions: recentSessions,
  })
  const todayKey = ymd(now)
  const doneToday = recentSessions.filter((s) => s.status !== 'active' && ymd(new Date(s.startedAt)) === todayKey)
  const t = rec.template

  return (
    <section aria-label="今天练什么" className="rounded-2xl border border-zinc-700/60 bg-zinc-800/70 p-4">
      <div className="flex items-center justify-between">
        <span className="text-[17px] font-bold">今天练什么</span>
        <div className="flex rounded-lg bg-zinc-900 p-0.5">
          {(
            [
              ['home', '家'],
              ['out', '外面'],
            ] as const
          ).map(([v, label]) => (
            <button key={v} type="button" onClick={() => setLocation(v)} className={SEG(location === v)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {doneToday.length > 0 && (
        <div className="mt-2 rounded-lg bg-lime-400/15 px-3 py-1.5 text-[15px] text-lime-200">
          今天已经练过：{doneToday.map((s) => s.templateName).join('、')} ✓
        </div>
      )}

      {rec.splitHint && <div className="mt-2 rounded-lg bg-sky-400/15 px-3 py-1.5 text-[15px] text-sky-100">{rec.splitHint}</div>}

      {t ? (
        <>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="text-[24px] font-bold">{t.name}</span>
            <span className="text-[15px] text-zinc-300">约 {estimateMinutes(t.blocks, short)} 分</span>
          </div>
          <ul className="mt-1 space-y-0.5">
            {rec.reasons.map((r) => (
              <li key={r} className="text-[15px] text-zinc-300">
                · {r}
              </li>
            ))}
          </ul>
          <div className="mt-3 grid grid-cols-[1fr_1.4fr] gap-2">
            <div className="grid grid-cols-2 rounded-xl bg-zinc-900 p-1">
              {[
                [false, '完整'],
                [true, '精简'],
              ].map(([v, label]) => (
                <button
                  key={String(label)}
                  type="button"
                  onClick={() => setShort(v as boolean)}
                  className={`rounded-lg text-[15px] font-semibold ${short === v ? 'bg-zinc-600 text-white' : 'text-zinc-300'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Button variant="primary" onClick={() => navigate(`start/${t.id}${short ? '/short' : ''}`)}>
              开始 ›
            </Button>
          </div>
        </>
      ) : (
        <div className="mt-3 text-[17px] text-zinc-200">
          {location === 'home' && templates.every((x) => x.location === 'out') ? '在家能练的卡都没有' : '能练的卡 48 小时内都练过了，今天休息吧'}
        </div>
      )}

      {rec.blocked.length > 0 && (
        <div className="mt-3 border-t border-zinc-700/70 pt-2">
          <div className="text-[13px] text-zinc-400">不推荐（硬要练会进疲劳模式）：</div>
          {rec.blocked.map((b) => (
            <div key={b.template.id} className="text-[13px] text-zinc-300">
              {b.template.name}：{b.reason}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// 首页每日打卡：肌酸、吸腹
export function DailyCard({ now }: { now: Date }) {
  const d = useDaily(now)
  if (!d.loaded) return null
  return (
    <div className="grid grid-cols-2 gap-2">
      {DAILY_ITEMS.map((it) => {
        const on = d.today[it.id]
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => void toggleDaily(d.today.date, it.id)}
            className={`flex min-h-16 items-center gap-3 rounded-2xl border px-3 text-left ${
              on ? 'border-lime-400/60 bg-lime-400/10' : 'border-zinc-700/60 bg-zinc-800/70 active:bg-zinc-700'
            }`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-lg font-bold ${
                on ? 'border-lime-400 bg-lime-400 text-zinc-950' : 'border-zinc-400'
              }`}
            >
              {on ? '✓' : ''}
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold leading-tight">{it.name}</span>
              <span className="block text-[13px] text-zinc-400">
                本周 {d.week[it.id]}/{d.daysSoFar} 天
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

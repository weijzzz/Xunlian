import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { DayPlanSheet } from '../components/DayPlanSheet'
import { DailyCard, RecommendCard } from '../components/TodayCards'
import { Button, Chip, SectionTitle } from '../components/ui'
import { WeightCard } from '../components/WeightCard'
import { GROUP_NAME, type Session } from '../data/types'
import { addDays, longDate, mondayOf, shortDate, WEEKDAY_NAME } from '../lib/dates'
import { db } from '../lib/db'
import { blocksGroups, getTemplate, useLibrary } from '../lib/library'
import { buildPlan, estimateMinutes } from '../lib/plan'
import { navigate } from '../lib/router'
import { finishSession, useActiveSession } from '../lib/session'
import { useSettings } from '../lib/settings'
import { useSchedule } from '../lib/schedule'
import { isEarlyDay, LATE_HOUR, lateNightWarning, PARITY_NAME, weekParity } from '../lib/week'

function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export function TodayPage({ weighOpen = false }: { weighOpen?: boolean }) {
  const { parityFlip } = useSettings()
  const { templates } = useLibrary()
  const sched = useSchedule()
  const active = useActiveSession()
  const now = useNow()
  const parity = weekParity(now, parityFlip)
  const today = sched.dayPlan(now)
  const todayTplId = today.id
  const todayTpl = todayTplId ? getTemplate(todayTplId) : undefined
  const tomorrowEarly = isEarlyDay(addDays(now, 1), parityFlip)
  const late = lateNightWarning(now, parityFlip)
  const [weekOffset, setWeekOffset] = useState(0)
  const [editDay, setEditDay] = useState<Date | null>(null)
  const monday = addDays(mondayOf(now), weekOffset * 7)
  const shownParity = weekParity(monday, parityFlip)
  const todayKey = now.toDateString()

  return (
    <div>
      <header className="flex items-start justify-between">
        <div>
          <div className="text-[15px] text-zinc-300">{longDate(now)}</div>
          <h1 className="mt-0.5 text-[27px] font-bold">
            {today.overridden ? (todayTpl ? `今天改成：${todayTpl.name}` : '今天改成休息') : todayTpl ? `今天默认：${todayTpl.name}` : '今天默认休息'}
          </h1>
        </div>
        <Chip tone={parity === 'odd' ? 'sky' : 'amber'}>{PARITY_NAME[parity]}</Chip>
      </header>

      {active && <ResumeBanner session={active} />}

      <div className="mt-4">
        <WeightCard forceOpen={weighOpen} onSaved={weighOpen ? () => navigate('today') : undefined} />
      </div>

      <div className="mt-3">
        <RecommendCard now={now} />
      </div>

      <div className={`mt-3 rounded-xl px-4 py-2.5 text-[15px] ${late ? 'bg-amber-400/20 text-amber-200' : 'bg-zinc-800 text-zinc-200'}`}>
        {late
          ? `明天 7:00 起床，${LATE_HOUR} 点后不建议训练`
          : tomorrowEarly
            ? `明天要早起，今晚 ${LATE_HOUR} 点前练完`
            : '明天不用早起，今晚可以练'}
      </div>

      <div className="mt-3">
        <DailyCard now={now} />
      </div>

      {/* 开始训练 */}
      <SectionTitle hint="不按推荐，自己选">开始训练</SectionTitle>
      <div className="space-y-2">
        {templates.map((t) => {
          const isToday = t.id === todayTplId
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => navigate(`start/${t.id}`)}
              className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left active:bg-zinc-700 ${
                isToday ? 'border-lime-400/70 bg-zinc-800' : 'border-zinc-700/60 bg-zinc-800/70'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">{t.name}</span>
                  {isToday && <Chip tone="lime">今天</Chip>}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Chip tone={t.location === 'home' ? 'zinc' : 'sky'}>{t.location === 'home' ? '家' : '外面'}</Chip>
                  {blocksGroups(t.blocks).map((g) => (
                    <Chip key={g}>{GROUP_NAME[g]}</Chip>
                  ))}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[15px] text-zinc-200">约 {estimateMinutes(t.blocks, false)} 分</div>
                <div className="text-2xl leading-none text-zinc-400">›</div>
              </div>
            </button>
          )
        })}
      </div>

      {/* 本周 / 下周排法：点一天可以改 */}
      <div className="mb-2.5 mt-7 flex items-center justify-between px-1">
        <h2 className="text-[15px] font-bold text-zinc-200">
          排法 <span className="font-normal text-zinc-400">· {PARITY_NAME[shownParity]} · 点一天可以改</span>
        </h2>
        <div className="flex rounded-lg bg-zinc-800 p-0.5">
          {['本周', '下周'].map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setWeekOffset(i)}
              className={`h-8 rounded-md px-3 text-[13px] font-semibold ${weekOffset === i ? 'bg-zinc-600 text-white' : 'text-zinc-300'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAY_NAME.map((wd, i) => {
          const day = addDays(monday, i)
          const { id, overridden } = sched.dayPlan(day)
          const isToday = day.toDateString() === todayKey
          return (
            <button
              key={wd}
              type="button"
              aria-label={`改${shortDate(day)}`}
              onClick={() => setEditDay(day)}
              className={`flex flex-col items-center gap-0.5 rounded-xl py-2 active:bg-zinc-600 ${isToday ? 'bg-zinc-700 ring-2 ring-lime-400' : 'bg-zinc-800'}`}
            >
              <span className={`text-[13px] ${isToday ? 'font-bold text-lime-300' : 'text-zinc-300'}`}>{wd.slice(1)}</span>
              <span className="text-[13px] tabular-nums text-zinc-400">{day.getDate()}</span>
              <span className={`text-base font-bold ${id ? 'text-white' : 'text-zinc-500'}`}>{id ? (getTemplate(id)?.short ?? '?') : '·'}</span>
              <span className={`h-1.5 w-1.5 rounded-full ${overridden ? 'bg-lime-400' : 'bg-transparent'}`} />
            </button>
          )
        })}
      </div>
      <p className="mt-2 px-1 text-[13px] text-zinc-400">
        {shortDate(monday)}–{shortDate(addDays(monday, 6))} · 绿点 = 这一天单独改过
      </p>

      <DayPlanSheet date={editDay} onClose={() => setEditDay(null)} />
    </div>
  )
}

function ResumeBanner({ session }: { session: Session }) {
  const done = useLiveQuery(() => db.setLogs.where('sessionId').equals(session.id).count(), [session.id]) ?? 0
  const total = buildPlan(session.layout).length
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="mt-4 rounded-2xl border border-lime-400/60 bg-lime-400/10 p-4">
      <div className="text-[13px] text-lime-200">还有一次训练没练完</div>
      <div className="mt-0.5 text-lg font-bold">
        {session.templateName} · 已做 {done}/{total} 组
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {confirm ? (
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              不了
            </Button>
            <Button variant="danger" onClick={() => void finishSession(session.id)}>
              确认结束
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => setConfirm(true)}>结束</Button>
            <Button variant="primary" onClick={() => navigate('train')}>
              继续
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

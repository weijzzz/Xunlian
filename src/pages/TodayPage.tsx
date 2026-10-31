import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Button, Chip, SectionTitle } from '../components/ui'
import { WeightCard } from '../components/WeightCard'
import { GROUP_NAME, type Session } from '../data/types'
import { addDays, longDate, mondayOf, shortDate, weekdayIndex, WEEKDAY_NAME } from '../lib/dates'
import { db } from '../lib/db'
import { blocksGroups, getTemplate, useLibrary } from '../lib/library'
import { buildPlan, estimateMinutes } from '../lib/plan'
import { navigate } from '../lib/router'
import { finishSession, useActiveSession } from '../lib/session'
import { useSettings } from '../lib/settings'
import { DEFAULT_PLAN, defaultTemplateId, isEarlyDay, LATE_HOUR, lateNightWarning, PARITY_NAME, weekParity } from '../lib/week'

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
  const active = useActiveSession()
  const now = useNow()
  const parity = weekParity(now, parityFlip)
  const todayTplId = defaultTemplateId(now, parityFlip)
  const todayTpl = todayTplId ? getTemplate(todayTplId) : undefined
  const tomorrowEarly = isEarlyDay(addDays(now, 1), parityFlip)
  const late = lateNightWarning(now, parityFlip)
  const monday = mondayOf(now)
  const todayIdx = weekdayIndex(now)

  return (
    <div>
      <header className="flex items-start justify-between">
        <div>
          <div className="text-[15px] text-zinc-300">{longDate(now)}</div>
          <h1 className="mt-0.5 text-[27px] font-bold">{todayTpl ? `今天默认：${todayTpl.name}` : '今天默认休息'}</h1>
        </div>
        <Chip tone={parity === 'odd' ? 'sky' : 'amber'}>{PARITY_NAME[parity]}</Chip>
      </header>

      {active && <ResumeBanner session={active} />}

      <div className="mt-4">
        <WeightCard forceOpen={weighOpen} onSaved={weighOpen ? () => navigate('today') : undefined} />
      </div>

      <div className={`mt-3 rounded-xl px-4 py-2.5 text-[15px] ${late ? 'bg-amber-400/20 text-amber-200' : 'bg-zinc-800 text-zinc-200'}`}>
        {late
          ? `明天 7:00 起床，${LATE_HOUR} 点后不建议训练`
          : tomorrowEarly
            ? `明天要早起，今晚 ${LATE_HOUR} 点前练完`
            : '明天不用早起，今晚可以练'}
      </div>

      {/* 开始训练 */}
      <SectionTitle hint="先手动选卡">开始训练</SectionTitle>
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

      {/* 本周默认排法 */}
      <SectionTitle hint={`${shortDate(monday)}–${shortDate(addDays(monday, 6))}`}>本周默认排法</SectionTitle>
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAY_NAME.map((wd, i) => {
          const tplId = DEFAULT_PLAN[parity][i]
          const isToday = i === todayIdx
          return (
            <div
              key={wd}
              className={`flex flex-col items-center gap-1 rounded-xl py-2 ${isToday ? 'bg-zinc-700 ring-2 ring-lime-400' : 'bg-zinc-800'}`}
            >
              <span className={`text-[13px] ${isToday ? 'font-bold text-lime-300' : 'text-zinc-300'}`}>{wd.slice(1)}</span>
              <span className={`text-base font-bold ${tplId ? 'text-white' : 'text-zinc-500'}`}>
                {tplId ? (getTemplate(tplId)?.short ?? '?') : '·'}
              </span>
            </div>
          )
        })}
      </div>
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

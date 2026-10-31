import { useEffect, useState } from 'react'
import { longDate, WEEKDAY_NAME, weekdayIndex } from '../lib/dates'
import { getTemplate, useLibrary } from '../lib/library'
import { clearDay, dayWarnings, setDayOnly, setDefaultFor, useSchedule } from '../lib/schedule'
import { PARITY_NAME, weekParity } from '../lib/week'
import { Sheet } from './Sheet'
import { Button } from './ui'

const REST = '__rest__'

// 改某一天练什么：选卡 → 「只这一天」或「以后每个单/双周的这天都这样」
export function DayPlanSheet({ date, onClose }: { date: Date | null; onClose: () => void }) {
  const sched = useSchedule()
  const { templates } = useLibrary()
  const current = date ? sched.dayPlan(date) : { id: undefined, overridden: false }
  const [pick, setPick] = useState<string>(REST)

  useEffect(() => {
    if (date) setPick(current.id ?? REST)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date?.getTime()])

  if (!date) return null
  const parity = weekParity(date, sched.flip)
  const wdName = WEEKDAY_NAME[weekdayIndex(date)]
  const chosen = pick === REST ? null : pick
  const def = sched.defaultFor(date)
  const warnings = dayWarnings(date, chosen ?? undefined, sched)
  const nameOf = (id: string | undefined) => (id ? (getTemplate(id)?.name ?? '?') : '休息')

  const done = async (fn: () => Promise<void>) => {
    await fn()
    onClose()
  }

  return (
    <Sheet
      open={!!date}
      onClose={onClose}
      title={
        <span>
          {longDate(date)} <span className="text-[15px] font-normal text-zinc-400">· {PARITY_NAME[parity]}</span>
        </span>
      }
    >
      <div className="mb-3 text-[15px] text-zinc-300">
        现在：<span className="font-semibold text-zinc-50">{nameOf(current.id)}</span>
        {current.overridden ? `（这一天单独改过，默认是${nameOf(def)}）` : '（默认排法）'}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[...templates.map((t) => ({ id: t.id, name: t.name })), { id: REST, name: '休息' }].map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setPick(o.id)}
            className={`h-14 rounded-xl text-[17px] font-semibold ${
              pick === o.id ? 'bg-lime-400 text-zinc-950' : 'bg-zinc-700 text-zinc-100 active:bg-zinc-600'
            } ${o.id === REST ? 'col-span-2' : ''}`}
          >
            {o.name}
          </button>
        ))}
      </div>

      {warnings.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {warnings.map((w) => (
            <div key={w} className="rounded-xl bg-amber-400/15 px-3 py-2 text-[15px] text-amber-100">
              {w}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-2">
        <Button variant="primary" className="w-full" onClick={() => void done(() => setDayOnly(date, chosen))}>
          只改这一天
        </Button>
        <Button className="w-full" onClick={() => void done(() => setDefaultFor(date, sched.flip, sched.plan, chosen))}>
          以后每个{PARITY_NAME[parity]}的{wdName}都这样
        </Button>
        {current.overridden && (
          <Button variant="ghost" className="w-full text-[15px]" onClick={() => void done(() => clearDay(date))}>
            恢复默认（{nameOf(def)}）
          </Button>
        )}
      </div>
    </Sheet>
  )
}

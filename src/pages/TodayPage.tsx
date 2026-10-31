import { useEffect, useState } from 'react'
import { Card, Chip, SectionTitle } from '../components/ui'
import { getExercise, repText } from '../data/exercises'
import { getTemplate, REST, restDefault, TEMPLATES, templateGroups } from '../data/templates'
import { GROUP_NAME, type RestRange, type Slot, type Template } from '../data/types'
import { addDays, longDate, mondayOf, shortDate, weekdayIndex, WEEKDAY_NAME } from '../lib/dates'
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

export function TodayPage() {
  const { parityFlip } = useSettings()
  const now = useNow()
  const parity = weekParity(now, parityFlip)
  const todayTpl = defaultTemplateId(now, parityFlip)
  const tomorrowEarly = isEarlyDay(addDays(now, 1), parityFlip)
  const late = lateNightWarning(now, parityFlip)
  const monday = mondayOf(now)
  const todayIdx = weekdayIndex(now)

  return (
    <div>
      <header className="flex items-start justify-between">
        <div>
          <div className="text-sm text-zinc-500">{longDate(now)}</div>
          <h1 className="mt-0.5 text-2xl font-bold">
            {todayTpl ? `今天默认：${getTemplate(todayTpl).name}` : '今天默认休息'}
          </h1>
        </div>
        <Chip tone={parity === 'odd' ? 'sky' : 'amber'}>{PARITY_NAME[parity]}</Chip>
      </header>

      <div className={`mt-3 rounded-xl px-3 py-2 text-sm ${late ? 'bg-amber-400/10 text-amber-300' : 'bg-zinc-900 text-zinc-400'}`}>
        {late
          ? `明天 7:00 起床，${LATE_HOUR} 点后不建议训练`
          : tomorrowEarly
            ? `明天要早起，今晚 ${LATE_HOUR} 点前练完`
            : '明天不用早起，今晚可以练'}
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
              className={`flex flex-col items-center gap-1 rounded-xl py-2 ${isToday ? 'bg-zinc-800 ring-1 ring-lime-400/60' : 'bg-zinc-900'}`}
            >
              <span className={`text-[11px] ${isToday ? 'text-lime-300' : 'text-zinc-500'}`}>{wd.slice(1)}</span>
              <span className={`text-sm font-bold ${tplId ? 'text-zinc-100' : 'text-zinc-700'}`}>
                {tplId ? getTemplate(tplId).short : '·'}
              </span>
            </div>
          )
        })}
      </div>

      {/* 临时：核对训练卡数据 */}
      <SectionTitle hint="临时 · 核对用">训练卡</SectionTitle>
      <p className="mb-3 px-1 text-xs leading-relaxed text-zinc-500">
        下一步做训练模式后，这里会换成「今天练什么」。先帮我看看动作、组数、次数、休息有没有录错。
      </p>
      <div className="space-y-3">
        {TEMPLATES.map((t) => (
          <TemplateCard key={t.id} t={t} />
        ))}
      </div>
    </div>
  )
}

function restText(r: RestRange) {
  return `${r[0]}–${r[1]}s`
}

function SlotLine({ slot }: { slot: Slot }) {
  const ex = getExercise(slot.exerciseId)
  const alt = slot.altId ? getExercise(slot.altId) : null
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-semibold text-zinc-100">{ex.name}</span>
        <span className="text-sm tabular-nums text-lime-300">
          {slot.sets}×{repText(ex)}
          {ex.sided === 'LR' ? '/边' : ''}
        </span>
        <span className="text-xs text-zinc-500">{ex.loadLabel}</span>
      </div>
      <div className="mt-0.5 text-xs leading-relaxed text-zinc-500">{ex.cue}</div>
      {alt && (
        <div className="mt-1 text-xs text-sky-300">
          有矮杠换：{alt.name} {slot.sets}×{repText(alt)}
        </div>
      )}
    </div>
  )
}

function TemplateCard({ t }: { t: Template }) {
  const groups = templateGroups(t)
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-bold">{t.name}</h3>
        <div className="flex gap-1.5">
          <Chip tone={t.location === 'home' ? 'zinc' : 'sky'}>{t.location === 'home' ? '家' : '外面'}</Chip>
          {groups.map((g) => (
            <Chip key={g}>{GROUP_NAME[g]}</Chip>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        {t.pairs.map((p, i) => {
          const same = p.restAB[0] === p.restBA[0] && p.restAB[1] === p.restBA[1]
          return (
            <div key={i} className="flex gap-3">
              <div className="w-6 shrink-0 pt-0.5 text-center text-lg font-bold text-zinc-500">{'①②'[i]}</div>
              <div className="min-w-0 flex-1 space-y-2">
                <SlotLine slot={p.a} />
                <div className="text-xs text-zinc-600">⇄</div>
                <SlotLine slot={p.b} />
                <div className="rounded-lg bg-zinc-950/60 px-2 py-1 text-xs text-zinc-400">
                  {same
                    ? `两个动作之间休息 ${restText(p.restAB)}（默认 ${restDefault(p.restAB)}s）`
                    : `腿→核心 ${restText(p.restAB)} · 核心→腿 ${restText(p.restBA)}`}
                </div>
              </div>
            </div>
          )
        })}
        {t.finisher && (
          <div className="flex gap-3">
            <div className="w-6 shrink-0 pt-0.5 text-center text-lg font-bold text-zinc-500">③</div>
            <div className="min-w-0 flex-1 space-y-2">
              <SlotLine slot={t.finisher} />
              <div className="rounded-lg bg-zinc-950/60 px-2 py-1 text-xs text-zinc-400">组间 {t.finisher.rest}s</div>
            </div>
          </div>
        )}
      </div>
      <div className="mt-3 text-xs text-zinc-600">
        单边：左 → {restText(REST.sideSwitch)} → 右 · 换下一对 {REST.nextPair}s
      </div>
    </Card>
  )
}

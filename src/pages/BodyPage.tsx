import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { LineChart, SERIES_COLORS } from '../components/LineChart'
import { Stepper } from '../components/Stepper'
import { Button, Card, Divider, SectionTitle } from '../components/ui'
import { WeightCard } from '../components/WeightCard'
import type { BodyMetric, MetricType } from '../data/types'
import { CHEST_EVERY, computeAdvice, measureDue, strengthDecline, WAIST_EVERY, type AdviceLevel } from '../lib/advice'
import { fmtChange, fmtKg, saveMetric, useMetrics } from '../lib/body'
import { addDays, longDate, parseYmd, shortDate, ymd } from '../lib/dates'
import { db } from '../lib/db'
import { useSettings } from '../lib/settings'

const ts = (date: string) => parseYmd(date).getTime()

export function BodyPage() {
  const weights = useMetrics('weight')
  const waists = useMetrics('waist')
  const chests = useMetrics('chest')
  const { creatineStart } = useSettings()
  const sessions = useLiveQuery(() => db.sessions.toArray(), [])
  const logs = useLiveQuery(() => db.setLogs.toArray(), [])
  const [today] = useState(() => new Date())
  if (!weights || !waists || !chests || !sessions || !logs) return null

  const advice = computeAdvice({ weights, waists, creatineStart, today, strengthDown: strengthDecline(sessions, logs) })
  const recent = weights.slice(0, 14)

  return (
    <div>
      <h1 className="mb-4 text-[27px] font-bold">身体</h1>
      <WeightCard />

      <SectionTitle>趋势提示</SectionTitle>
      <AdviceCard level={advice.level} title={advice.title} reasons={advice.reasons} facts={advice.facts} />

      <SectionTitle>体重</SectionTitle>
      <WeightChart weights={weights} today={today} />

      <SectionTitle hint={`每 ${WAIST_EVERY} 天量一次 · 主要指标`}>腰围</SectionTitle>
      <MeasureCard type="waist" rows={waists} every={WAIST_EVERY} fallback={75} hint="肚脐那一圈，早上空腹、自然呼气时量" today={today} />

      <SectionTitle hint={`每 ${CHEST_EVERY} 天量一次`}>胸围</SectionTitle>
      <MeasureCard type="chest" rows={chests} every={CHEST_EVERY} fallback={90} hint="乳头那一圈，手臂自然下垂" today={today} />

      <SectionTitle hint={recent.length ? `最近 ${recent.length} 次` : undefined}>体重记录</SectionTitle>
      <Card className="py-1">
        {recent.length === 0 ? (
          <div className="py-3 text-[15px] text-zinc-300">还没有记录</div>
        ) : (
          recent.map((r, i) => {
            const prev = recent[i + 1]
            return (
              <div key={r.date}>
                {i > 0 && <Divider />}
                <div className="flex min-h-12 items-center justify-between py-2">
                  <span className="text-[15px] text-zinc-200">{longDate(parseYmd(r.date))}</span>
                  <span className="flex items-baseline gap-3">
                    {prev && <span className="text-[13px] tabular-nums text-zinc-400">{fmtChange(r.value - prev.value)}</span>}
                    <span className="text-[17px] font-semibold tabular-nums">{fmtKg(r.value)}</span>
                  </span>
                </div>
              </div>
            )
          })
        )}
      </Card>
    </div>
  )
}

const ADVICE_STYLE: Record<AdviceLevel, string> = {
  plus: 'border-sky-400/50 bg-sky-400/10 text-sky-100',
  minus: 'border-amber-400/50 bg-amber-400/10 text-amber-100',
  keep: 'border-lime-400/50 bg-lime-400/10 text-lime-100',
  normal: 'border-lime-400/50 bg-lime-400/10 text-lime-100',
  wait: 'border-zinc-600 bg-zinc-800/70 text-zinc-100',
  nodata: 'border-zinc-600 bg-zinc-800/70 text-zinc-100',
}
const ADVICE_ICON: Record<AdviceLevel, string> = { plus: '↑', minus: '↓', keep: '✓', normal: '✓', wait: '⏸', nodata: '…' }

function AdviceCard({ level, title, reasons, facts }: { level: AdviceLevel; title: string; reasons: string[]; facts: string[] }) {
  return (
    <section aria-label="趋势提示" className={`rounded-2xl border p-4 ${ADVICE_STYLE[level]}`}>
      <div className="flex items-center gap-2 text-[20px] font-bold text-white">
        <span aria-hidden>{ADVICE_ICON[level]}</span>
        {title}
      </div>
      <ul className="mt-1.5 space-y-0.5">
        {reasons.map((r) => (
          <li key={r} className="text-[15px]">
            {r}
          </li>
        ))}
      </ul>
      {facts.length > 0 && (
        <div className="mt-2 border-t border-white/10 pt-2">
          {facts.map((f) => (
            <div key={f} className="text-[13px] text-zinc-300">
              {f}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

const RANGES = [
  { label: '4 周', days: 28 },
  { label: '12 周', days: 84 },
  { label: '全部', days: 0 },
]

function WeightChart({ weights, today }: { weights: BodyMetric[]; today: Date }) {
  const [range, setRange] = useState(0)
  const days = RANGES[range].days
  const from = days ? ymd(addDays(today, -days + 1)) : ''
  const shown = weights.filter((w) => w.date >= from).sort((a, b) => (a.date < b.date ? -1 : 1))
  const byDate = new Map(weights.map((w) => [w.date, w.value]))
  // 每天的 7 日平均（7 天里至少 3 天有记录）
  const avg = shown
    .map((w) => {
      const d = parseYmd(w.date)
      const vals: number[] = []
      for (let i = 0; i < 7; i++) {
        const v = byDate.get(ymd(addDays(d, -i)))
        if (v !== undefined) vals.push(v)
      }
      return vals.length >= 3 ? { x: ts(w.date), y: +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2) } : null
    })
    .filter((p): p is { x: number; y: number } => p !== null)

  return (
    <Card>
      <div className="mb-2 flex justify-end">
        <div className="flex rounded-lg bg-zinc-900 p-0.5">
          {RANGES.map((r, i) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setRange(i)}
              className={`h-8 rounded-md px-3 text-[13px] font-semibold ${range === i ? 'bg-zinc-600 text-white' : 'text-zinc-300'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <div className="py-6 text-center text-[15px] text-zinc-300">这段时间没有体重记录</div>
      ) : (
        <LineChart
          unit="kg"
          series={[
            { name: '每天', color: '#a1a1aa', line: false, points: shown.map((w) => ({ x: ts(w.date), y: w.value })) },
            ...(avg.length ? [{ name: '7日均', color: SERIES_COLORS[0], dots: false, points: avg }] : []),
          ]}
        />
      )}
      {avg.length === 0 && shown.length > 0 && <p className="mt-1 px-1 text-[13px] text-zinc-400">7 天里记满 3 天就会出现平均线</p>}
    </Card>
  )
}

function MeasureCard({
  type,
  rows,
  every,
  fallback,
  hint,
  today,
}: {
  type: MetricType
  rows: BodyMetric[]
  every: number
  fallback: number
  hint: string
  today: Date
}) {
  const due = measureDue(rows, every, today)
  const [value, setValue] = useState(due.last?.value ?? fallback)
  const [saved, setSaved] = useState(false)
  const name = type === 'waist' ? '腰围' : '胸围'
  const todayStr = ymd(today)
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? -1 : 1))

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          {due.last ? (
            <>
              <div className="text-[26px] font-bold tabular-nums">
                {due.last.value.toFixed(1)}
                <span className="ml-1 text-[15px] text-zinc-300">cm</span>
              </div>
              <div className="text-[13px] text-zinc-400">
                {shortDate(parseYmd(due.last.date))} 量的 · {due.days === 0 ? '今天' : `${due.days} 天前`}
              </div>
            </>
          ) : (
            <div className="text-[17px] text-zinc-200">还没量过{name}</div>
          )}
        </div>
        {due.due ? (
          <span className="rounded-full bg-amber-400/20 px-2.5 py-1 text-[13px] font-semibold text-amber-200">该量了</span>
        ) : (
          <span className="rounded-full bg-zinc-700 px-2.5 py-1 text-[13px] text-zinc-200">
            {every - (due.days ?? 0)} 天后再量
          </span>
        )}
      </div>

      {sorted.length >= 2 && (
        <div className="mt-2">
          <LineChart unit="cm" height={140} series={[{ name, color: SERIES_COLORS[0], points: sorted.map((r) => ({ x: ts(r.date), y: r.value })) }]} />
        </div>
      )}

      <div className="mt-3">
        <Stepper label={name} value={value} onChange={(v) => { setValue(v); setSaved(false) }} step={0.5} min={40} max={160} unit="cm" size="md" />
        <Button
          variant={due.due ? 'primary' : 'secondary'}
          className="mt-2 w-full"
          onClick={() => void saveMetric(type, todayStr, value).then(() => setSaved(true))}
        >
          {saved ? '已记录 ✓' : rows.some((r) => r.date === todayStr) ? `更新今天的${name}` : `记录${name}`}
        </Button>
        <p className="mt-1.5 px-1 text-[13px] text-zinc-400">{hint}</p>
      </div>
    </Card>
  )
}

import { useState } from 'react'
import { parseYmd, shortDate, ymd } from '../lib/dates'
import {
  clampWeight,
  fmtChange,
  fmtKg,
  MIN_DAYS_FOR_AVG,
  parseWeight,
  saveMetric,
  useMetrics,
  WEIGHT_FALLBACK,
  WEIGHT_STEP,
  weightStats,
} from '../lib/body'
import { useHoldRepeat } from '../lib/useHoldRepeat'
import { Button, Card } from './ui'

// 首页 / 身体页顶部的体重卡
// - 今天没记：展开，预填上次的体重，按一下「记录」就完成
// - 今天记过：缩成一行，点一下可以改
export function WeightCard({ forceOpen = false, onSaved }: { forceOpen?: boolean; onSaved?: () => void }) {
  const rows = useMetrics('weight')
  const todayStr = ymd(new Date())
  const stats = weightStats(rows ?? [], todayStr)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<number | null>(null)
  const [typing, setTyping] = useState(false)
  const [text, setText] = useState('')

  const base = stats.today?.value ?? stats.last?.value ?? WEIGHT_FALLBACK
  const value = draft ?? base

  const minus = useHoldRepeat(() => setDraft((d) => clampWeight((d ?? base) - WEIGHT_STEP)))
  const plus = useHoldRepeat(() => setDraft((d) => clampWeight((d ?? base) + WEIGHT_STEP)))

  if (rows === undefined) return <Card className="h-[92px]">{null}</Card>

  const open = forceOpen || editing || !stats.today

  const commitTyping = (): number => {
    const v = parseWeight(text)
    setTyping(false)
    if (v === null) return value
    setDraft(v)
    return v
  }

  const save = async () => {
    const v = typing ? commitTyping() : value
    await saveMetric('weight', todayStr, v)
    setDraft(null)
    setEditing(false)
    onSaved?.()
  }

  if (!open && stats.today) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="block w-full text-left">
        <Card className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[13px] text-zinc-400">今天体重</div>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="text-[26px] font-bold tabular-nums">{fmtKg(stats.today.value)}</span>
              <span className="text-[15px] text-zinc-300">kg</span>
              <span className="ml-1 text-lg text-lime-400">✓</span>
            </div>
          </div>
          <div className="text-right">
            {stats.avg7 !== null ? (
              <>
                <div className="text-[15px] text-zinc-200">
                  7日均 <span className="font-semibold tabular-nums">{fmtKg(stats.avg7)}</span>
                </div>
                {stats.weekChange !== null && (
                  <div className="text-[13px] tabular-nums text-zinc-400">比上周 {fmtChange(stats.weekChange)}</div>
                )}
              </>
            ) : (
              <div className="text-[13px] text-zinc-400">
                再记 {MIN_DAYS_FOR_AVG - stats.count7} 天
                <br />
                显示 7 日平均
              </div>
            )}
            <div className="mt-0.5 text-[13px] text-zinc-400">点一下可以改</div>
          </div>
        </Card>
      </button>
    )
  }

  const diff = stats.last ? value - stats.last.value : null

  return (
    <Card className="border-lime-400/40">
      <div className="flex items-baseline justify-between">
        <div className="text-[17px] font-bold">今天体重</div>
        <div className="text-[13px] text-zinc-400">
          {stats.last ? `上次 ${fmtKg(stats.last.value)} · ${shortDate(parseYmd(stats.last.date))}` : '第一次记录'}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          aria-label="减 0.1"
          {...minus}
          className="h-16 w-16 shrink-0 rounded-2xl bg-zinc-600 text-4xl font-bold leading-none text-white active:bg-zinc-500"
        >
          −
        </button>

        {typing ? (
          <input
            autoFocus
            inputMode="decimal"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={commitTyping}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
            className="h-16 w-full min-w-0 rounded-2xl bg-zinc-900 text-center text-[40px] font-bold tabular-nums text-white outline-none ring-2 ring-lime-400"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setText(fmtKg(value))
              setTyping(true)
            }}
            className="flex h-16 min-w-0 flex-1 items-baseline justify-center gap-1 rounded-2xl active:bg-zinc-700"
          >
            <span className="text-[44px] font-bold leading-[64px] tabular-nums">{fmtKg(value)}</span>
            <span className="text-lg text-zinc-300">kg</span>
          </button>
        )}

        <button
          type="button"
          aria-label="加 0.1"
          {...plus}
          className="h-16 w-16 shrink-0 rounded-2xl bg-zinc-600 text-4xl font-bold leading-none text-white active:bg-zinc-500"
        >
          +
        </button>
      </div>

      <div className="mt-1.5 text-center text-[13px] text-zinc-400">
        {diff !== null ? `比上次 ${fmtChange(diff)} · ` : ''}点数字可直接输入 · 按住 −/+ 连续变
      </div>

      <Button variant="primary" onClick={() => void save()} className="mt-3 h-14 w-full text-xl">
        {stats.today ? '更新' : '记录'}
      </Button>

      {stats.today && !forceOpen && (
        <Button
          variant="ghost"
          onClick={() => {
            setDraft(null)
            setTyping(false)
            setEditing(false)
          }}
          className="mt-1 w-full text-[15px]"
        >
          取消
        </Button>
      )}
      {!stats.today && <div className="mt-2 text-center text-[13px] text-zinc-400">早上起床、上完厕所、空腹称</div>}
    </Card>
  )
}

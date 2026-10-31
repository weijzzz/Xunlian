import { useState } from 'react'
import { useHoldRepeat } from '../lib/useHoldRepeat'

function round(v: number, step: number) {
  const inv = 1 / step
  return Math.round(v * inv) / inv
}

// 大号 −/+ 数字框：按住连续变，点中间数字可以直接打字（支持逗号）
export function Stepper({
  value,
  onChange,
  step,
  min = 0,
  max = 999,
  unit,
  format = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1)),
  size = 'lg',
  label,
}: {
  value: number
  onChange: (v: number) => void
  step: number
  min?: number
  max?: number
  unit?: string
  format?: (v: number) => string
  size?: 'lg' | 'md'
  label?: string
}) {
  const [typing, setTyping] = useState(false)
  const [text, setText] = useState('')
  const clamp = (v: number) => Math.min(max, Math.max(min, round(v, step)))
  const minus = useHoldRepeat(() => onChange(clamp(value - step)))
  const plus = useHoldRepeat(() => onChange(clamp(value + step)))

  const btn =
    size === 'lg'
      ? 'h-16 w-16 rounded-2xl text-4xl'
      : 'h-13 w-13 rounded-xl text-3xl'
  const num = size === 'lg' ? 'text-[44px] leading-[64px]' : 'text-[34px] leading-[52px]'
  const h = size === 'lg' ? 'h-16' : 'h-13'

  const commit = () => {
    const v = Number(text.trim().replace(',', '.'))
    setTyping(false)
    if (Number.isFinite(v)) onChange(clamp(v))
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        aria-label={`${label ?? ''}减`}
        {...minus}
        className={`${btn} shrink-0 bg-zinc-600 font-bold leading-none text-white active:bg-zinc-500`}
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
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          className={`${h} w-full min-w-0 rounded-2xl bg-zinc-900 text-center text-[34px] font-bold tabular-nums text-white outline-none ring-2 ring-lime-400`}
        />
      ) : (
        <button
          type="button"
          aria-label={`${label ?? ''}数值`}
          onClick={() => {
            setText(format(value))
            setTyping(true)
          }}
          className={`flex ${h} min-w-0 flex-1 items-baseline justify-center gap-1 rounded-2xl active:bg-zinc-700`}
        >
          <span className={`${num} font-bold tabular-nums`}>{format(value)}</span>
          {unit && <span className="text-lg text-zinc-300">{unit}</span>}
        </button>
      )}
      <button
        type="button"
        aria-label={`${label ?? ''}加`}
        {...plus}
        className={`${btn} shrink-0 bg-zinc-600 font-bold leading-none text-white active:bg-zinc-500`}
      >
        +
      </button>
    </div>
  )
}

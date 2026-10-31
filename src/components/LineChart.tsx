import { useEffect, useRef, useState } from 'react'

// 折线图（深色主题）。配色是校验过的深色分类色（色弱可分、对深色卡片 ≥3:1），按固定顺序取，不循环
export const SERIES_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300']
const SURFACE = '#1e1e21'
const GRID = '#3f3f46'
const AXIS_TEXT = '#a1a1aa'
const FLAG = '#fab219' // 状态色（警示），只用来标「疲劳」，带图例文字

export interface ChartPoint {
  x: number // 时间戳
  y: number
  flag?: boolean // 疲劳模式那次
}

export interface ChartSeries {
  name: string
  color: string
  points: ChartPoint[]
  line?: boolean // 连线（默认是）
  dots?: boolean // 画点（默认是）
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(320)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.round(e.contentRect.width))))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || 1
  const raw = span / count
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? mag * 10
  const out: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(6))
  return out
}

const fmtDate = (t: number) => {
  const d = new Date(t)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
const fmtVal = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))

export function LineChart({
  series,
  height = 190,
  unit = '',
  flagLabel,
  yMin,
}: {
  series: ChartSeries[]
  height?: number
  unit?: string
  flagLabel?: string // 有疲劳点时，图例里怎么叫
  yMin?: number // 强制下限（比如次数从 0 开始）
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const all = series.flatMap((s) => s.points)
  if (!all.length) return null

  const pad = { l: 34, r: 12, t: 10, b: 24 }
  const xs = [...new Set(all.map((p) => p.x))].sort((a, b) => a - b)
  let x0 = xs[0]
  let x1 = xs[xs.length - 1]
  if (x0 === x1) {
    x0 -= 86_400_000
    x1 += 86_400_000
  }
  let y0 = Math.min(...all.map((p) => p.y))
  let y1 = Math.max(...all.map((p) => p.y))
  const span = y1 - y0 || Math.max(1, Math.abs(y1) * 0.05)
  y0 = yMin !== undefined ? Math.min(yMin, y0) : y0 - span * 0.15
  y1 = y1 + span * 0.15
  const ticks = niceTicks(y0, y1)
  y0 = Math.min(y0, ticks[0])
  y1 = Math.max(y1, ticks[ticks.length - 1])

  const W = width
  const H = height
  const sx = (x: number) => pad.l + ((x - x0) / (x1 - x0)) * (W - pad.l - pad.r)
  const sy = (y: number) => pad.t + (1 - (y - y0) / (y1 - y0)) * (H - pad.t - pad.b)

  // x 轴最多 4 个日期；离得太近（<40px）的跳过，最后一个日期优先保留
  const candidates = xs.length <= 4 ? xs : [0, 1, 2, 3].map((i) => xs[Math.round((i * (xs.length - 1)) / 3)])
  const xLabels: number[] = []
  for (const x of [...candidates].reverse()) {
    if (xLabels.every((k) => Math.abs(sx(k) - sx(x)) >= 40)) xLabels.unshift(x)
  }
  const hasFlag = all.some((p) => p.flag)
  const showLegend = series.length > 1 || hasFlag

  const onPointer = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left + pad.l
    let best = 0
    xs.forEach((x, i) => {
      if (Math.abs(sx(x) - px) < Math.abs(sx(xs[best]) - px)) best = i
    })
    setHover(best)
  }

  const hx = hover !== null ? xs[hover] : null
  const rows = hx !== null ? series.map((s) => ({ s, p: s.points.find((p) => p.x === hx) })).filter((r) => r.p) : []
  const tipLeft = hx !== null ? Math.min(Math.max(sx(hx) - 70, 0), W - 140) : 0

  return (
    <div ref={ref} className="relative w-full select-none">
      {showLegend && (
        <div className="mb-1.5 flex flex-wrap gap-x-3 gap-y-1 px-1">
          {series.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5 text-[13px] text-zinc-300">
              {s.line === false ? (
                <svg width="10" height="10">
                  <circle cx="5" cy="5" r="4" fill={s.color} />
                </svg>
              ) : (
                <svg width="16" height="10">
                  <line x1="0" y1="5" x2="16" y2="5" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              )}
              {s.name}
            </span>
          ))}
          {hasFlag && (
            <span className="flex items-center gap-1.5 text-[13px] text-zinc-300">
              <svg width="12" height="12">
                <circle cx="6" cy="6" r="4.5" fill="none" stroke={FLAG} strokeWidth="2" />
              </svg>
              {flagLabel ?? '标记'}
            </span>
          )}
        </div>
      )}
      <svg width={W} height={H} role="img" aria-label="趋势图" className="block">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} stroke={GRID} strokeWidth="1" />
            <text x={pad.l - 6} y={sy(t) + 4} textAnchor="end" fontSize="12" fill={AXIS_TEXT}>
              {fmtVal(t)}
            </text>
          </g>
        ))}
        {xLabels.map((x, i) => (
          <text
            key={x}
            x={sx(x)}
            y={H - 6}
            textAnchor={i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}
            fontSize="12"
            fill={AXIS_TEXT}
          >
            {fmtDate(x)}
          </text>
        ))}
        {series.map((s) => {
          const pts = [...s.points].sort((a, b) => a.x - b.x)
          return (
            <g key={s.name}>
              {s.line !== false && pts.length > 1 && (
                <polyline
                  points={pts.map((p) => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ')}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
              {s.dots !== false &&
                pts.map((p) => (
                  <circle
                    key={p.x}
                    cx={sx(p.x)}
                    cy={sy(p.y)}
                    r={p.flag ? 5 : 4}
                    fill={p.flag ? SURFACE : s.color}
                    stroke={p.flag ? FLAG : SURFACE}
                    strokeWidth="2"
                  />
                ))}
            </g>
          )
        })}
        {hx !== null && <line x1={sx(hx)} x2={sx(hx)} y1={pad.t} y2={H - pad.b} stroke="#d4d4d8" strokeWidth="1" strokeDasharray="3 3" />}
        <rect
          x={pad.l}
          y={0}
          width={W - pad.l - pad.r}
          height={H}
          fill="transparent"
          onPointerDown={onPointer}
          onPointerMove={onPointer}
          onPointerLeave={() => setHover(null)}
          style={{ touchAction: 'pan-y' }}
        />
      </svg>
      {hx !== null && rows.length > 0 && (
        <div
          className="pointer-events-none absolute z-10 w-[140px] rounded-xl border border-zinc-600 bg-zinc-900/95 px-3 py-2 shadow-lg"
          style={{ left: tipLeft, top: showLegend ? 30 : 4 }}
        >
          <div className="text-[13px] text-zinc-400">{fmtDate(hx)}</div>
          {rows.map(({ s, p }) => (
            <div key={s.name} className="flex items-center gap-1.5">
              <svg width="12" height="8">
                <line x1="0" y1="4" x2="12" y2="4" stroke={s.color} strokeWidth="2.5" />
              </svg>
              <span className="text-[15px] font-bold tabular-nums text-white">
                {fmtVal(p!.y)}
                {unit}
              </span>
              <span className="truncate text-[13px] text-zinc-400">{s.name}</span>
            </div>
          ))}
          {rows.some((r) => r.p!.flag) && <div className="text-[13px] text-amber-300">{flagLabel}</div>}
        </div>
      )}
    </div>
  )
}

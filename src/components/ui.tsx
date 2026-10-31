import type { ReactNode } from 'react'

// 字号/颜色约定（用户反馈：要大、要亮）
// 主文字 zinc-50 · 次要 zinc-300 · 提示 zinc-400 · 最小字号 text-sm(14px)

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-zinc-700/60 bg-zinc-800/70 p-4 ${className}`}>{children}</div>
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-2.5 mt-7 flex items-baseline justify-between px-1">
      <h2 className="text-base font-bold text-zinc-200">{children}</h2>
      {hint && <span className="text-sm text-zinc-400">{hint}</span>}
    </div>
  )
}

export function Chip({ children, tone = 'zinc' }: { children: ReactNode; tone?: 'zinc' | 'lime' | 'amber' | 'sky' }) {
  const tones = {
    zinc: 'bg-zinc-700 text-zinc-100',
    lime: 'bg-lime-400/20 text-lime-300',
    amber: 'bg-amber-400/20 text-amber-300',
    sky: 'bg-sky-400/20 text-sky-300',
  }
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-semibold ${tones[tone]}`}>{children}</span>
}

type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

export function Button({
  children,
  onClick,
  variant = 'secondary',
  disabled,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: BtnVariant
  disabled?: boolean
  className?: string
}) {
  const styles: Record<BtnVariant, string> = {
    primary: 'bg-lime-400 text-zinc-950 active:bg-lime-300',
    secondary: 'bg-zinc-600 text-white active:bg-zinc-500',
    danger: 'bg-red-500/25 text-red-200 active:bg-red-500/35',
    ghost: 'bg-transparent text-zinc-200 active:bg-zinc-700',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-13 rounded-xl px-4 text-lg font-semibold transition-colors disabled:opacity-40 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Row({ label, children, sub }: { label: ReactNode; children?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <div className="text-lg text-zinc-50">{label}</div>
        {sub && <div className="mt-0.5 text-sm leading-snug text-zinc-400">{sub}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}

export function Divider() {
  return <div className="h-px bg-zinc-700/70" />
}

export function Placeholder({ title, step, items }: { title: string; step: string; items: string[] }) {
  return (
    <div>
      <h1 className="mb-4 text-3xl font-bold">{title}</h1>
      <Card>
        <div className="mb-2 text-base text-zinc-300">{step}会做：</div>
        <ul className="space-y-2 text-lg text-zinc-100">
          {items.map((it) => (
            <li key={it} className="flex gap-2">
              <span className="text-zinc-400">·</span>
              {it}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

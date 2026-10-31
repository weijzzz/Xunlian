import type { ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-zinc-900 p-4 ${className}`}>{children}</div>
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-baseline justify-between px-1">
      <h2 className="text-sm font-semibold tracking-wide text-zinc-400">{children}</h2>
      {hint && <span className="text-xs text-zinc-500">{hint}</span>}
    </div>
  )
}

export function Chip({ children, tone = 'zinc' }: { children: ReactNode; tone?: 'zinc' | 'lime' | 'amber' | 'sky' }) {
  const tones = {
    zinc: 'bg-zinc-800 text-zinc-300',
    lime: 'bg-lime-400/15 text-lime-300',
    amber: 'bg-amber-400/15 text-amber-300',
    sky: 'bg-sky-400/15 text-sky-300',
  }
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>
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
    secondary: 'bg-zinc-800 text-zinc-100 active:bg-zinc-700',
    danger: 'bg-red-500/15 text-red-300 active:bg-red-500/25',
    ghost: 'bg-transparent text-zinc-300 active:bg-zinc-800',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-12 rounded-xl px-4 text-base font-semibold transition-colors disabled:opacity-40 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Row({ label, children, sub }: { label: ReactNode; children?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="text-base text-zinc-100">{label}</div>
        {sub && <div className="mt-0.5 text-xs text-zinc-500">{sub}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}

export function Divider() {
  return <div className="h-px bg-zinc-800" />
}

export function Placeholder({ title, step, items }: { title: string; step: string; items: string[] }) {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">{title}</h1>
      <Card>
        <div className="mb-2 text-sm text-zinc-400">{step}会做：</div>
        <ul className="space-y-1.5 text-zinc-300">
          {items.map((it) => (
            <li key={it} className="flex gap-2">
              <span className="text-zinc-600">·</span>
              {it}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

import type { ReactNode } from 'react'
import { navigate } from '../lib/router'

export type Tab = 'today' | 'history' | 'body' | 'settings'

const ICON_PROPS = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  {
    id: 'today',
    label: '今天',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
      </svg>
    ),
  },
  {
    id: 'history',
    label: '历史',
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    id: 'body',
    label: '身体',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M3 12h4l3-7 4 14 3-7h4" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: '设置',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
        <circle cx="15" cy="6" r="2" />
        <circle cx="9" cy="12" r="2" />
        <circle cx="17" cy="18" r="2" />
      </svg>
    ),
  },
]

export function BottomNav({ current }: { current: Tab }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-800 bg-zinc-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-md">
        {TABS.map((t) => {
          const active = t.id === current
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => navigate(t.id)}
              className={`flex h-16 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium ${
                active ? 'text-lime-400' : 'text-zinc-500 active:text-zinc-300'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

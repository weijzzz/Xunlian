import { useEffect, type ReactNode } from 'react'

// 从底部弹出的面板（单手好按）
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button type="button" aria-label="关闭" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div className="relative mx-auto max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-zinc-700 bg-zinc-800 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-zinc-600" />
        {title && <div className="mb-3 text-lg font-bold">{title}</div>}
        {children}
      </div>
    </div>
  )
}

export function SheetItem({
  children,
  onClick,
  tone = 'normal',
  sub,
}: {
  children: ReactNode
  onClick: () => void
  tone?: 'normal' | 'danger' | 'accent'
  sub?: ReactNode
}) {
  const color = tone === 'danger' ? 'text-red-300' : tone === 'accent' ? 'text-lime-300' : 'text-zinc-50'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-14 w-full flex-col justify-center rounded-xl px-3 py-2 text-left active:bg-zinc-700 ${color}`}
    >
      <span className="text-[17px] font-semibold">{children}</span>
      {sub && <span className="mt-0.5 text-[13px] font-normal text-zinc-400">{sub}</span>}
    </button>
  )
}

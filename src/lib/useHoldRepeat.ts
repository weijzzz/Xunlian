import { useEffect, useRef, type PointerEvent } from 'react'

// 按一下执行一次；按住不放 400ms 后开始连续执行
export function useHoldRepeat(fn: () => void, { delay = 400, interval = 70 } = {}) {
  const fnRef = useRef(fn)
  const timers = useRef<{ t?: number; i?: number }>({})

  useEffect(() => {
    fnRef.current = fn
  }, [fn])

  const stop = () => {
    window.clearTimeout(timers.current.t)
    window.clearInterval(timers.current.i)
    timers.current = {}
  }

  useEffect(() => stop, [])

  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      e.currentTarget.setPointerCapture?.(e.pointerId)
      stop()
      fnRef.current()
      timers.current.t = window.setTimeout(() => {
        timers.current.i = window.setInterval(() => fnRef.current(), interval)
      }, delay)
    },
    onPointerUp: stop,
    onPointerCancel: stop,
    onLostPointerCapture: stop,
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  }
}

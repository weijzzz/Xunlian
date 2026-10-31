import { useEffect, useState } from 'react'

export type WakeState = 'unsupported' | 'off' | 'on' | 'error'

export function wakeLockSupported(): boolean {
  return 'wakeLock' in navigator
}

// enabled = true 时保持屏幕常亮；切出去再回来会自动重新申请
export function useWakeLock(enabled: boolean): WakeState {
  const [state, setState] = useState<WakeState>(wakeLockSupported() ? 'off' : 'unsupported')

  useEffect(() => {
    if (!enabled || !wakeLockSupported()) return
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const acquire = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        sentinel = await navigator.wakeLock.request('screen')
        if (cancelled) {
          void sentinel.release()
          return
        }
        setState('on')
        sentinel.addEventListener('release', () => {
          if (!cancelled) setState('off')
        })
      } catch {
        if (!cancelled) setState('error')
      }
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      if (sentinel) void sentinel.release()
      setState('off')
    }
  }, [enabled])

  return enabled ? state : wakeLockSupported() ? 'off' : 'unsupported'
}

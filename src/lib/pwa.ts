import { useRegisterSW } from 'virtual:pwa-register/react'

let registration: ServiceWorkerRegistration | undefined

// 只在 App 里调用一次
export function usePWA() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, r) {
      registration = r
      if (!r) return
      // 每小时、以及每次切回 App 时检查一次更新
      setInterval(() => void r.update(), 60 * 60 * 1000)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void r.update()
      })
    },
  })

  return {
    needRefresh,
    offlineReady,
    update: () => updateServiceWorker(true),
    dismiss: () => {
      setNeedRefresh(false)
      setOfflineReady(false)
    },
  }
}

export async function checkForUpdate(): Promise<boolean> {
  if (!registration) return false
  await registration.update()
  return !!registration.waiting || !!registration.installing
}

declare const __BUILD_TIME__: string
export const BUILD_TIME: string = __BUILD_TIME__

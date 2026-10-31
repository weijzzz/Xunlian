import { useSyncExternalStore } from 'react'

// 极简 hash 路由：#/today、#/history/xxx …（GitHub Pages 上不会 404）
function getHash(): string {
  return window.location.hash.replace(/^#\/?/, '')
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export function useRoute(): string[] {
  const hash = useSyncExternalStore(subscribe, getHash, () => '')
  return hash.split('/').filter(Boolean)
}

// replace = 不留历史（比如开始训练后按返回键不该回到开始页）
export function navigate(path: string, opts: { replace?: boolean } = {}) {
  if (opts.replace) window.location.replace(`#/${path}`)
  else window.location.hash = `#/${path}`
}

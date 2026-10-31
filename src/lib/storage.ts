import { useCallback, useEffect, useState } from 'react'

export interface StorageInfo {
  supported: boolean
  persisted: boolean | null
  usageKB: number | null
}

// 申请"持久化存储"：浏览器清理空间时不会删掉这个 App 的数据
export async function requestPersist(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  try {
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export function useStorageInfo() {
  const [info, setInfo] = useState<StorageInfo>({ supported: !!navigator.storage, persisted: null, usageKB: null })

  const refresh = useCallback(async () => {
    if (!navigator.storage) return
    const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : null
    const est = navigator.storage.estimate ? await navigator.storage.estimate() : null
    setInfo({
      supported: true,
      persisted,
      usageKB: est?.usage != null ? Math.round(est.usage / 1024) : null,
    })
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { info, refresh }
}

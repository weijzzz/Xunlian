// 收提醒推送、点通知打开 App（被 workbox 生成的 sw.js 用 importScripts 引进来）
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || '训练记录', {
      body: data.body || '',
      tag: data.tag || 'xunlian',
      renotify: true,
      icon: 'pwa-192.png',
      badge: 'badge-96.png',
      data: { url: data.url || './' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || './', self.location.origin).href
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const c of all) {
        if (c.url.startsWith(self.registration.scope)) {
          await c.focus()
          if ('navigate' in c) await c.navigate(url)
          return
        }
      }
      await self.clients.openWindow(url)
    })(),
  )
})

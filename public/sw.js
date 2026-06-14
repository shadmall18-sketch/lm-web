// LM service worker — handles push notifications
self.addEventListener('push', function(event) {
  let data = {}
  try { data = event.data.json() } catch (e) { data = { title: 'LM', body: event.data?.text() ?? 'New message' } }

  const options = {
    body: data.body || 'New message',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'lm-message',
    data: { url: data.url || '/dashboard/messages' },
    vibrate: data.emergency ? [200, 100, 200, 100, 200] : [100],
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'LM', options)
  )
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()
  const url = event.notification.data?.url || '/dashboard/messages'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url.includes('/dashboard') && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  const title = typeof data.title === "string" ? data.title : "テスト通知";
  const options = {
    body: typeof data.body === "string" ? data.body : "表示テスト",
    tag: "notification",
    requireInteraction: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data || "/";
  event.waitUntil(clients.openWindow(url));
});

const CACHE_NAME = "china-trip-v1";

self.addEventListener("install", function (event) {
  event.waitUntil(self.caches.open(CACHE_NAME).then(function () {
    return self.skipWaiting();
  }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    self.caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return self.caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  event.respondWith(
    self.fetch(event.request).then(function (response) {
      if (response && response.status === 200 && response.type === "basic") {
        var clone = response.clone();
        self.caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, clone);
        });
      }
      return response;
    }).catch(function () {
      return self.caches.match(event.request).then(function (cached) {
        return cached || new Response("Offline", { status: 503, statusText: "Offline" });
      });
    })
  );
});

self.addEventListener("push", function (event) {
  if (!event.data) return;
  let payload = { title: "Reminder", body: "" };
  try {
    payload = event.data.json();
  } catch {
    payload.body = event.data.text();
  }
  const options = {
    body: payload.body,
    icon: "/icon-192x192.png",
    badge: "/icon-192x192.png",
    data: { url: payload.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(payload.title || "China Trip Planner", options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

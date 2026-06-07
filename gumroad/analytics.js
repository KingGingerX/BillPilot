(function () {
  const endpoint = window.TGB_ANALYTICS_ENDPOINT || "/api/events";
  const enabled = Boolean(window.TGB_ANALYTICS_ENDPOINT);

  function eventPayload(name, detail) {
    return JSON.stringify({
      name,
      detail: detail || {},
      path: window.location.pathname,
      referrer: document.referrer || "",
      timestamp: new Date().toISOString()
    });
  }

  function send(name, detail) {
    if (!enabled) return;
    const payload = eventPayload(name, detail);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([payload], { type: "application/json" }));
      return;
    }
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true
    }).catch(function () {});
  }

  document.addEventListener("click", function (event) {
    const target = event.target.closest("[data-track]");
    if (!target) return;
    send(target.getAttribute("data-track"), { href: target.getAttribute("href") || "" });
  });

  document.addEventListener("submit", function (event) {
    const target = event.target.closest("[data-track-submit]");
    if (!target) return;
    send(target.getAttribute("data-track-submit"), { form: target.getAttribute("name") || "" });
  });
})();

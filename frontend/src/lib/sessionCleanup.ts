import { BACKEND_URL } from "../config/backend";

/**
 * Tell the backend a call is over so it can tear down the Playwright browser.
 *
 * WHY THIS EXISTS: `start_session` already destroys leftover sessions, but only
 * LAZILY — on the *next* call. Ending a call used to do nothing but
 * `room.disconnect()`, so the previous run's Chromium stayed alive. noVNC
 * streams the whole X display, so the next demo opened showing the PREVIOUS
 * caller's last screen until the new page painted.
 *
 * Fire-and-forget by design: this runs while the page is navigating away or
 * unloading, and nothing in the UI should ever wait on it or fail because of it.
 *
 * `sendBeacon` is used first because a normal `fetch` is cancelled when the page
 * unloads — which is exactly the moment we need this to survive. It queues the
 * request at the browser level and outlives the document. `keepalive` fetch is
 * the fallback for the manual "end call" path, where the page is still alive.
 */
export function endFormSession(sessionId: string): void {
  if (!sessionId) return;

  const url = `${BACKEND_URL}/agent/session/end`;
  const payload = JSON.stringify({ session_id: sessionId });

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      // text/plain avoids a CORS preflight — a beacon that triggers one is
      // silently dropped during unload, which would defeat the whole point.
      // FastAPI reads the raw body, so the content type does not matter here.
      const blob = new Blob([payload], { type: "text/plain;charset=UTF-8" });
      if (navigator.sendBeacon(url, blob)) return;
    }
  } catch {
    /* fall through to fetch */
  }

  try {
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {
      /* cleanup is best-effort — the backend also self-heals on next start */
    });
  } catch {
    /* ignore — never let cleanup break the call-end path */
  }
}

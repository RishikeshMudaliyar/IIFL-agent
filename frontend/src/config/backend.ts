// Backend base (FastAPI + Playwright + noVNC). Same host that serves /agent/*, /nurix-proxy, /vnc.
export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ?? "https://iifl-backend-production.up.railway.app";

// Live view of the Playwright browser the agent drives, via the backend's noVNC stream.
// nginx proxies /vnc/ (viewer) and /websockify (VNC socket) to the headless Chromium display.
export const LIVE_VIEW_URL =
  `${BACKEND_URL}/vnc/vnc.html?autoconnect=true&reconnect=true&resize=scale&path=websockify&view_only=true`;

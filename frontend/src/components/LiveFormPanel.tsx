import { useState } from "react";
import { Monitor, ExternalLink } from "lucide-react";
import { LIVE_VIEW_URL } from "../config/backend";

const BRAND_COLOR = "#0071A9";

/**
 * Live view of the agent filling the form — embeds the backend's noVNC stream
 * of the headless Chromium that the Mozart fill-field/click-button flows drive.
 */
export default function LiveFormPanel() {
  // EVERY DEMO STARTS FRESH. The iframe src was a constant, so a second demo in
  // the same tab could reuse the cached noVNC document and paint the PREVIOUS
  // run's last screen until the new page loaded. A per-mount cache-buster forces
  // a brand-new connection. Minted once per mount so it stays stable across
  // re-renders (a changing src would reload the stream mid-call).
  const [viewUrl] = useState(
    () => `${LIVE_VIEW_URL}${LIVE_VIEW_URL.includes("?") ? "&" : "?"}t=${Date.now()}`,
  );

  return (
    <div className="flex flex-col h-full bg-[#0b1220]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2 text-white/90">
          <Monitor size={16} style={{ color: BRAND_COLOR }} />
          <span className="font-semibold text-sm">Live form filling</span>
        </div>
        <a
          href={LIVE_VIEW_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-white/60 hover:text-white/90 transition-colors"
        >
          <ExternalLink size={14} /> Pop out
        </a>
      </div>
      <div className="flex-1 relative bg-black min-h-0">
        <iframe
          title="Live form filling"
          src={viewUrl}
          className="absolute inset-0 w-full h-full border-0"
          allow="fullscreen"
        />
      </div>
    </div>
  );
}

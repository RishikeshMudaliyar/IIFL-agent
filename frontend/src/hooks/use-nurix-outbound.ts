import { useCallback, useEffect, useRef, useState } from "react";

// Outbound PHONE call flow: the AI agent (Ira) places a real call to the number
// the caller entered in the form. There is NO LiveKit room for the browser to
// join — the audio is on the person's phone. For a LIVE transcript we subscribe
// to the platform's call-listener WebSocket:
//
//   wss://<agentx-host>/voice/web/call/{call_id}/listen
//
// This route IS deployed on agentx-prod (a plain HTTP GET returns 404 because it
// is WebSocket-only, but the WS upgrade succeeds). It joins the call's live
// LiveKit room as a hidden read-only participant and relays frames as JSON
// envelopes: {type:"connected"} / {type:"data", ...} / {type:"disconnected"}.
// We parse the data frames into transcript turns.
//
// The post-call REST transcript (GET /voice/web/transcript/{id}) is kept as a
// FALLBACK — it only fills in after the call ends, so it backstops the final
// record if the live WS yields nothing.
//
// These endpoints live on agentx-prod (the platform host), NOT the api-in widget
// gateway. The browser talks to agentx-prod directly (it CORS-allows the origin).

export type OutboundConfig = {
  /** agentx platform base, e.g. https://agentx-prod.nurixlabs.tech */
  apiBase: string;
  workspaceId: string;
  agentId: string;
};

const DEFAULT_CONFIG: OutboundConfig = {
  apiBase:
    import.meta.env.VITE_NURIX_AGENTX_BASE ??
    "https://agentx-prod.nurixlabs.tech",
  workspaceId:
    import.meta.env.VITE_NURIX_WORKSPACE_ID ??
    "ed51dad4-783e-4adf-8ec0-1b14b8938a5d", // IIFL workspace
  agentId:
    import.meta.env.VITE_NURIX_VOICE_AGENT_ID ??
    "56dfd3b8-5426-44c3-b1ea-3db962638948", // IIFL voice agent "Ira"
};

// Call lifecycle: INITIATED -> CONNECTED -> COMPLETED | FAILED | VOICEMAIL
export type CallStatus =
  | "idle"
  | "dialing"
  | "INITIATED"
  | "CONNECTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "VOICEMAIL"
  | "RNR"
  | "error";

export type TranscriptTurn = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export interface UseNurixOutboundOptions {
  phone: string;
  dynamicVars?: Record<string, string>;
}

/** Normalize a 10-digit Indian mobile to E.164 (+91…). Leaves already-prefixed numbers alone. */
export function toE164India(raw: string): string {
  const digits = (raw || "").replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return digits ? `+${digits}` : "";
}

const TERMINAL: CallStatus[] = ["COMPLETED", "FAILED", "VOICEMAIL", "RNR", "error"];

export function useNurixOutbound(
  config: Partial<OutboundConfig> = {},
  options: UseNurixOutboundOptions,
) {
  const { apiBase, workspaceId, agentId } = { ...DEFAULT_CONFIG, ...config };
  const { phone, dynamicVars } = options;

  const [callId, setCallId] = useState<string | null>(null);
  const [status, setStatus] = useState<CallStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [liveTurns, setLiveTurns] = useState<TranscriptTurn[]>([]); // from listen WS
  const [pollTurns, setPollTurns] = useState<TranscriptTurn[]>([]); // post-call fallback

  const startedRef = useRef(false);
  const dynamicVarsRef = useRef<Record<string, string>>(dynamicVars ?? {});
  dynamicVarsRef.current = dynamicVars ?? {};

  const start = useCallback(async () => {
    const number = toE164India(phone);
    if (!number) {
      setStatus("error");
      setErrorMessage("No valid phone number to call.");
      return;
    }
    setStatus("dialing");
    setErrorMessage(null);
    try {
      const resp = await fetch(`${apiBase}/voice/outbound-call`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "workspace-id": workspaceId,
        },
        body: JSON.stringify({
          agent_id: agentId,
          number,
          custom_dynamic_variables_config: dynamicVarsRef.current,
          overide_previous_context: true,
        }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
      }
      const data = await resp.json();
      const id = data.call_id || data.callId;
      if (!id) throw new Error("Outbound call did not return a call_id");
      setCallId(id);
      setStatus("INITIATED");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to start the call");
    }
  }, [apiBase, workspaceId, agentId, phone]);

  // Trigger the call exactly once on mount.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    start();
  }, [start]);

  // LIVE transcript: subscribe to the call-listener WebSocket.
  useEffect(() => {
    if (!callId) return;
    const wsUrl = `${apiBase.replace(/^http/i, "ws")}/voice/web/call/${callId}/listen`;
    let ws: WebSocket | null = null;
    // Accumulate transcript segments by a stable id so interim updates replace in place.
    const segments = new Map<string, TranscriptTurn>();

    try {
      ws = new WebSocket(wsUrl);
    } catch {
      return; // browser refused; poll fallback still runs
    }

    ws.onmessage = (ev) => {
      let env: any;
      try {
        env = JSON.parse(typeof ev.data === "string" ? ev.data : "");
      } catch {
        return;
      }
      const type = String(env?.type ?? env?.event ?? "").toLowerCase();
      if (type === "connected" || type === "disconnected" || type === "error") return;
      // eslint-disable-next-line no-console
      if (import.meta.env.DEV) console.debug("[listen]", env);
      for (const turn of parseListenFrame(env)) segments.set(turn.id, turn);
      if (segments.size) setLiveTurns(Array.from(segments.values()));
    };
    ws.onerror = () => { /* keep the poll fallback */ };

    return () => {
      try { ws?.close(); } catch { /* noop */ }
    };
  }, [callId, apiBase]);

  // Poll call status (drives the UI state) + post-call transcript (fallback).
  useEffect(() => {
    if (!callId) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const r = await fetch(`${apiBase}/voice/call/${callId}`, {
          headers: { "workspace-id": workspaceId, accept: "application/json" },
        });
        if (r.ok) {
          const d = await r.json();
          let s = (d.status || "").toUpperCase();
          // Platform quirk: an answered call that has ENDED is reported as CONNECTED
          // (with call_end_reason/duration/end_time). IN_PROGRESS is the active state.
          // Treat CONNECTED / any end_reason as terminal COMPLETED (unless it's a failure).
          if ((s === "CONNECTED" || d.call_end_reason || d.end_time) && !["FAILED", "VOICEMAIL", "RNR"].includes(s)) {
            s = "COMPLETED";
          }
          if (!cancelled && ["INITIATED", "IN_PROGRESS", "COMPLETED", "FAILED", "VOICEMAIL", "RNR"].includes(s)) {
            setStatus(s as CallStatus);
          }
        }
      } catch { /* transient */ }

      try {
        const r = await fetch(`${apiBase}/voice/web/transcript/${callId}`, {
          headers: { accept: "application/json" },
        });
        if (r.ok) {
          const d = await r.json();
          const arr: any[] = Array.isArray(d?.transcript) ? d.transcript : [];
          if (!cancelled && arr.length) {
            setPollTurns(
              arr
                .map((t, i) => ({ id: `p${i}`, role: normalizeRole(t), text: String(t?.text ?? t?.content ?? t?.message ?? "").trim() }))
                .filter((t) => t.text && !looksEncrypted(t.text)),
            );
          }
        }
      } catch { /* transient */ }
    };

    poll();
    const iv = setInterval(() => {
      if (TERMINAL.includes(status)) { clearInterval(iv); return; }
      poll();
    }, 2000);

    return () => { cancelled = true; clearInterval(iv); };
  }, [callId, apiBase, workspaceId, status]);

  // Live WS wins; fall back to the post-call poll only if the WS produced nothing.
  const turns = liveTurns.length ? liveTurns : pollTurns;

  return { callId, status, errorMessage, turns, restart: start };
}

/** Best-effort parse of a listener `data` frame into transcript turns.
 *  The frame forwards the call's LiveKit transcription; shapes vary, so we probe
 *  the common ones (segment list, or a flat {text, role}). Raw frames are logged
 *  in DEV so the exact PSTN shape can be confirmed on a live call and tightened. */
function parseListenFrame(env: any): TranscriptTurn[] {
  let payload = env?.data ?? env?.payload ?? env?.transcription ?? env?.transcript ?? env;
  if (typeof payload === "string") {
    payload = tryJson(payload) ?? tryJson(b64ToStr(payload)) ?? { text: payload };
  }
  if (!payload || typeof payload !== "object") return [];

  const out: TranscriptTurn[] = [];
  const add = (id: any, role: "user" | "assistant", text: any) => {
    const t = String(text ?? "").trim();
    if (t) out.push({ id: String(id), role, text: t });
  };

  // LiveKit transcription: { segments:[{id,text,final}], participantIdentity }
  if (Array.isArray(payload.segments)) {
    const role = roleFrom(payload.participantIdentity ?? payload.participant ?? payload.role ?? payload.speaker);
    for (const s of payload.segments) add(s.id ?? s.segment_id ?? `${role}:${(s.text ?? "").slice(0, 12)}`, role, s.text ?? s.content);
    return out;
  }

  // Flat { text|content|message, role|speaker|participantIdentity }
  const text = payload.text ?? payload.content ?? payload.message ?? payload.transcript;
  if (text) {
    const role = roleFrom(payload.role ?? payload.speaker ?? payload.participantIdentity ?? payload.identity ?? payload.sender);
    add(payload.id ?? payload.segment_id ?? `${role}:${String(text).slice(0, 12)}`, role, text);
  }
  return out;
}

function roleFrom(raw: any): "user" | "assistant" {
  const s = String(raw ?? "").toLowerCase();
  if (s.includes("agent") || s.includes("assistant") || s.includes("bot") || s.includes("ira") || s.includes("ai")) {
    return "assistant";
  }
  return "user";
}

function normalizeRole(t: any): "user" | "assistant" {
  return roleFrom(t?.role ?? t?.speaker ?? t?.sender ?? t?.source);
}

/** When the workspace has transcript encryption on, the post-call endpoint returns
 *  base64 CIPHERTEXT (not decryptable in the browser). Detect that so we don't render
 *  blobs as transcript text — real utterances contain spaces/punctuation. */
function looksEncrypted(s: string): boolean {
  return s.length > 24 && !/\s/.test(s) && /^[A-Za-z0-9+/]+={0,2}$/.test(s);
}

function tryJson(s: string): any {
  try { return JSON.parse(s); } catch { return null; }
}
function b64ToStr(s: string): string {
  try { return typeof atob === "function" ? atob(s) : ""; } catch { return ""; }
}

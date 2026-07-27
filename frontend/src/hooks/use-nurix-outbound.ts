import { useCallback, useEffect, useRef, useState } from "react";

// Outbound PHONE call flow: the AI agent (Ira) places a real call to the number
// the caller entered in the form. Unlike the old web/mic call there is NO LiveKit
// room for the browser to join — the audio is on the person's phone. The page
// instead shows a near-live transcript (polled) + the live form-fill (noVNC).
//
// These endpoints live ONLY on agentx-prod (the platform host) — NOT the
// api-in widget gateway. The browser calls agentx-prod DIRECTLY: it CORS-allows
// the frontend origin (preflight + GET both return ACAO), and Railway's backend
// egress can't reach agentx-prod, so a server-side proxy would just time out.

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
  workspaceId: import.meta.env.VITE_NURIX_WORKSPACE_ID ?? "REPLACE_WITH_IIFL_WORKSPACE_ID",
  agentId: import.meta.env.VITE_NURIX_VOICE_AGENT_ID ?? "REPLACE_WITH_IIFL_VOICE_AGENT_ID",
};

// Call lifecycle: INITIATED -> CONNECTED -> COMPLETED | FAILED | VOICEMAIL
export type CallStatus =
  | "idle"
  | "dialing" // request sent, waiting for call_id
  | "INITIATED"
  | "CONNECTED"
  | "COMPLETED"
  | "FAILED"
  | "VOICEMAIL"
  | "error";

export type TranscriptTurn = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export interface UseNurixOutboundOptions {
  /** Caller's phone number as entered (10-digit Indian mobile or already E.164). */
  phone: string;
  /** Passed to the agent so its greeting already knows the caller. */
  dynamicVars?: Record<string, string>;
}

export { toE164India } from "../lib/phone";
import { toE164India } from "../lib/phone";

const TERMINAL: CallStatus[] = ["COMPLETED", "FAILED", "VOICEMAIL", "error"];

export function useNurixOutbound(
  config: Partial<OutboundConfig> = {},
  options: UseNurixOutboundOptions,
) {
  const { apiBase, workspaceId, agentId } = { ...DEFAULT_CONFIG, ...config };
  const { phone, dynamicVars } = options;

  const [callId, setCallId] = useState<string | null>(null);
  const [status, setStatus] = useState<CallStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);

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

  // Poll call status + transcript until the call reaches a terminal state.
  useEffect(() => {
    if (!callId) return;
    let cancelled = false;

    const poll = async () => {
      // Status
      try {
        const r = await fetch(`${apiBase}/voice/call/${callId}`, {
          headers: { "workspace-id": workspaceId, accept: "application/json" },
        });
        if (r.ok) {
          const d = await r.json();
          const s = (d.status || "").toUpperCase();
          if (!cancelled && ["INITIATED", "CONNECTED", "COMPLETED", "FAILED", "VOICEMAIL"].includes(s)) {
            setStatus(s as CallStatus);
          }
        }
      } catch {
        /* transient; keep polling */
      }

      // Transcript
      try {
        const r = await fetch(`${apiBase}/voice/web/transcript/${callId}`, {
          headers: { accept: "application/json" },
        });
        if (r.ok) {
          const d = await r.json();
          const arr: any[] = Array.isArray(d?.transcript) ? d.transcript : [];
          if (!cancelled && arr.length) {
            setTurns(
              arr.map((t, i) => ({
                id: `${i}`,
                role: normalizeRole(t),
                text: String(t?.text ?? t?.content ?? t?.message ?? "").trim(),
              })).filter((t) => t.text),
            );
          }
        }
      } catch {
        /* transient */
      }
    };

    poll();
    const iv = setInterval(() => {
      if (TERMINAL.includes(status)) {
        clearInterval(iv);
        return;
      }
      poll();
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [callId, apiBase, workspaceId, status]);

  return { callId, status, errorMessage, turns, restart: start };
}

function normalizeRole(t: any): "user" | "assistant" {
  const raw = String(t?.role ?? t?.speaker ?? t?.sender ?? t?.source ?? "").toLowerCase();
  if (raw.includes("agent") || raw.includes("assistant") || raw.includes("bot") || raw.includes("ai")) {
    return "assistant";
  }
  return "user";
}

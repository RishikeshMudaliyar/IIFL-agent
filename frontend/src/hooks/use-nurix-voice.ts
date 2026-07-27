import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceConnectionDetails = {
  serverUrl: string;
  participantToken: string;
  callId: string;
  roomName?: string;
  participantName?: string;
};

export type NurixVoiceConfig = {
  apiBase: string;
  agentId: string;
  gatewayApiKey: string;
};

// WEB-CALL (browser mic + LiveKit) path — the local/demo variant kept alongside
// the deployed outbound-phone flow. Auth uses agent_id + the account gateway key,
// NOT the channel-connection-id (that path is ORIGIN-SCOPED and 500s from
// localhost). agent_id + gateway key is origin-agnostic — verified working from
// http://localhost:3000. Points at agentx-prod directly so it works off-network too.
const DEFAULT_CONFIG: NurixVoiceConfig = {
  apiBase:
    import.meta.env.VITE_NURIX_AGENTX_BASE ??
    "https://agentx-prod.nurixlabs.tech",
  agentId: import.meta.env.VITE_NURIX_VOICE_AGENT_ID ?? "REPLACE_WITH_IIFL_VOICE_AGENT_ID",
  // gateway_api_key is account-shared (works for /voice/web/call cross-origin).
  gatewayApiKey:
    import.meta.env.VITE_NURIX_VOICE_GATEWAY_API_KEY ?? "REPLACE_WITH_IIFL_GATEWAY_API_KEY",
};

type Status = "idle" | "starting" | "ready" | "error";

export interface UseNurixVoiceOptions {
  /** Passed to the voice agent as custom_dynamic_variables so it greets the
   *  caller already knowing them (name / phone / pincode / loan_type). */
  dynamicVars?: Record<string, string>;
}

export function useNurixVoice(
  config: Partial<NurixVoiceConfig> = {},
  options: UseNurixVoiceOptions = {},
) {
  const { apiBase, agentId, gatewayApiKey } = { ...DEFAULT_CONFIG, ...config };
  const { dynamicVars } = options;
  const [details, setDetails] = useState<VoiceConnectionDetails | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userId] = useState(() => crypto.randomUUID());

  // Keep the latest vars in a ref so start() has a stable identity (won't
  // re-fire the auto-start effect every time the lead object changes).
  const dynamicVarsRef = useRef<Record<string, string>>(dynamicVars ?? {});
  dynamicVarsRef.current = dynamicVars ?? {};

  const start = useCallback(async () => {
    setStatus("starting");
    setErrorMessage(null);
    try {
      const resp = await fetch(`${apiBase}/voice/web/call`, {
        method: "POST",
        headers: {
          "accept": "application/json",
          "content-type": "application/json",
          "user-id": userId,
          "x-api-key": gatewayApiKey,
        },
        body: JSON.stringify({
          agent_id: agentId,
          overide_previous_context: true,
          custom_dynamic_variables_config: dynamicVarsRef.current,
        }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
      }
      const data = await resp.json();
      if (!data.serverUrl || !data.participantToken) {
        throw new Error("Response missing serverUrl/participantToken (call may be queued — not supported in this build)");
      }
      setDetails({
        serverUrl: data.serverUrl,
        participantToken: data.participantToken,
        callId: data.call_id,
        roomName: data.roomName,
        participantName: data.participantName,
      });
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to start voice call");
    }
  }, [apiBase, agentId, gatewayApiKey, userId]);

  // Auto-start on mount
  useEffect(() => { start(); }, [start]);

  return { details, status, errorMessage, userId, restart: start };
}

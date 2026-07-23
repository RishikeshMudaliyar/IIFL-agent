import { useCallback, useEffect, useState } from "react";

export type VoiceConnectionDetails = {
  serverUrl: string;
  participantToken: string;
  callId: string;
  roomName?: string;
  participantName?: string;
};

export type NurixVoiceConfig = {
  apiBase: string;
  channelConnectionId: string;
  apiKey: string;
  gatewayApiKey: string;
};

// Configure via VITE_NURIX_VOICE_* env vars (set on Railway / .env), or replace the placeholder
// defaults below. Values come from the IIFL voice agent's channel-connection.
// The agent_id is resolved server-side from channel-connection-id; we don't
// send it in the REST body.
const DEFAULT_CONFIG: NurixVoiceConfig = {
  apiBase:
    import.meta.env.VITE_NURIX_VOICE_API_BASE ??
    "https://iifl-backend-production.up.railway.app/nurix-proxy/agentx",
  channelConnectionId: import.meta.env.VITE_NURIX_VOICE_CHANNEL_CONNECTION_ID ?? "REPLACE_WITH_IIFL_VOICE_CHANNEL_CONNECTION_ID",
  apiKey: import.meta.env.VITE_NURIX_VOICE_API_KEY ?? "REPLACE_WITH_IIFL_VOICE_API_KEY",
  // gateway_api_key is account-shared (works for /voice/web/call); the voice widget key
  // does not work as the gateway key. Provide the IIFL account's gateway key.
  gatewayApiKey:
    import.meta.env.VITE_NURIX_VOICE_GATEWAY_API_KEY ?? "REPLACE_WITH_IIFL_GATEWAY_API_KEY",
};

type Status = "idle" | "starting" | "ready" | "error";

export function useNurixVoice(config: Partial<NurixVoiceConfig> = {}) {
  const { apiBase, channelConnectionId, apiKey, gatewayApiKey } = { ...DEFAULT_CONFIG, ...config };
  const [details, setDetails] = useState<VoiceConnectionDetails | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userId] = useState(() => crypto.randomUUID());

  const start = useCallback(async () => {
    setStatus("starting");
    setErrorMessage(null);
    try {
      const resp = await fetch(`${apiBase}/voice/web/call`, {
        method: "POST",
        headers: {
          "accept": "application/json",
          "content-type": "application/json",
          "api-key": apiKey,
          "channel-connection-id": channelConnectionId,
          "user-id": userId,
          "x-api-key": gatewayApiKey,
        },
        body: JSON.stringify({
          overide_previous_context: true,
          custom_dynamic_variables_config: {},
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
  }, [apiBase, channelConnectionId, apiKey, gatewayApiKey, userId]);

  // Auto-start on mount
  useEffect(() => { start(); }, [start]);

  return { details, status, errorMessage, userId, restart: start };
}

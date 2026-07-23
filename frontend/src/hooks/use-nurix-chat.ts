import { useCallback, useEffect, useRef, useState } from "react";

export type ChatMessage = {
  id: string;
  text: string;
  role: "user" | "assistant";
  timestamp: number;
};

export type NurixChatConfig = {
  host: string;
  accountId: string;
  apiKey: string;
  agentId?: string;
};

// Configure via VITE_NURIX_CHAT_* env vars (set on Railway / .env), or replace the placeholder
// defaults below. Values come from the IIFL chat agent's channel-connection:
//   - accountId, agentId, and a domain-scoped chat-widget api_key (minted per whitelisted domain).
const DEFAULT_CONFIG: NurixChatConfig = {
  host: import.meta.env.VITE_NURIX_CHAT_HOST ?? "chat-in.nurixlabs.tech",
  accountId: import.meta.env.VITE_NURIX_CHAT_ACCOUNT_ID ?? "REPLACE_WITH_IIFL_CHAT_ACCOUNT_ID",
  apiKey: import.meta.env.VITE_NURIX_CHAT_API_KEY ?? "REPLACE_WITH_IIFL_CHAT_API_KEY",
  agentId: import.meta.env.VITE_NURIX_CHAT_AGENT_ID ?? "REPLACE_WITH_IIFL_CHAT_AGENT_ID",
};

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export function useNurixChat(config: Partial<NurixChatConfig> = {}) {
  const { host, accountId, apiKey, agentId } = { ...DEFAULT_CONFIG, ...config };

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const userIdRef = useRef<string>(crypto.randomUUID());

  const appendMessage = useCallback((text: string, role: ChatMessage["role"]) => {
    setMessages((prev) => [...prev, { id: newId(), text, role, timestamp: Date.now() }]);
  }, []);

  useEffect(() => {
    const url =
      `wss://${host}/chat/CHAT_WIDGET/${accountId}/${sessionIdRef.current}` +
      `?user_id=${userIdRef.current}&api_key=${apiKey}` +
      (agentId ? `&agent_id=${agentId}` : "");

    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.onopen = () => setIsConnected(true);

    socket.onmessage = (event) => {
      let data: any;
      try { data = JSON.parse(event.data); } catch { return; }

      // Streaming / final text response
      if (data.response_type === "response" && typeof data.content === "string") {
        setIsLoading(false);
        appendMessage(data.content, "assistant");
        return;
      }

      // Audio-mode transcript shape (defensive — not expected in pure chat)
      if (data.interaction_type === "response_audio" && Array.isArray(data.transcript)) {
        const assistantTurn = data.transcript.find((t: any) => t.role === "assistant");
        if (assistantTurn?.content) {
          setIsLoading(false);
          appendMessage(assistantTurn.content, "assistant");
        }
        return;
      }

      // Server's ping_pong reply (we don't send pings; safe to ignore)
      if (data.response_type === "ping_pong") return;

      // Session metadata / chat-end — ignore quietly for now
    };

    socket.onclose = () => {
      setIsConnected(false);
      setIsLoading(false);
    };

    socket.onerror = () => {
      // Browser doesn't expose useful error info on WebSocket errors;
      // rely on onclose for state updates.
    };

    return () => socket.close();
  }, [host, accountId, apiKey, agentId, appendMessage]);

  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    appendMessage(trimmed, "user");
    setIsLoading(true);
    socket.send(JSON.stringify({
      interaction_type: "response_required",
      text: trimmed,
    }));
  }, [appendMessage]);

  return { messages, sendMessage, isConnected, isLoading };
}

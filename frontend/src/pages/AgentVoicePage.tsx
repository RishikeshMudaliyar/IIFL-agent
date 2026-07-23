import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/components-react";
import { Mic, MicOff, PhoneOff, Send, ChevronLeft, Loader2 } from "lucide-react";
import { CLIENT_NAME } from "../config/branding";
import { useNurixVoice } from "../hooks/use-nurix-voice";
import LiveFormPanel from "../components/LiveFormPanel";

const BRAND_COLOR = "#0071A9";
const BRAND_TEXT_COLOR = "#1f2937";
const DISCLAIMER = "This is an AI powered call";

type Bubble = {
  id: string;
  role: "user" | "assistant";
  text: string;
  interim: boolean;
};

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const AgentVoicePage = () => {
  const navigate = useNavigate();
  const { details, status, errorMessage, restart } = useNurixVoice();

  return (
    <div className="h-[100dvh] flex flex-col font-sans bg-gray-50">
      <header className="px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between border-b border-gray-100 bg-white">
        <button onClick={() => navigate("/chat")} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ChevronLeft size={20} />
          <span className="font-semibold text-sm">Back</span>
        </button>
        <div className="flex items-center gap-2">
          <Mic className="w-4 h-4" style={{ color: BRAND_COLOR }} />
          <span className="font-bold text-gray-900 text-sm sm:text-base">{CLIENT_NAME} Agent</span>
          <span
            className={`ml-2 inline-block w-2 h-2 rounded-full ${
              status === "ready" ? "bg-green-500" : status === "error" ? "bg-red-500" : "bg-gray-400"
            }`}
            title={status}
          />
        </div>
        <span className="text-xs text-gray-400 hidden sm:inline">{CLIENT_NAME}</span>
      </header>

      <div className="flex-1 min-h-0 flex">
      <div className="flex flex-col min-h-0 flex-1 lg:w-1/2 lg:flex-none border-r border-gray-100">
      {status === "starting" && (
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: BRAND_COLOR }} />
            <p className="text-sm">Connecting voice agent…</p>
          </div>
        </main>
      )}

      {status === "error" && (
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-md text-center">
            <p className="text-red-600 font-semibold mb-2">Could not start voice call</p>
            <p className="text-sm text-gray-600 mb-4 break-words">{errorMessage}</p>
            <button
              onClick={restart}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ backgroundColor: BRAND_COLOR, color: BRAND_TEXT_COLOR }}
            >
              Try again
            </button>
          </div>
        </main>
      )}

      {status === "ready" && details && (
        <LiveKitRoom
          token={details.participantToken}
          serverUrl={details.serverUrl}
          connect={true}
          audio={true}
          video={false}
          onDisconnected={() => navigate("/chat")}
          className="flex-1 flex flex-col"
        >
          <RoomAudioRenderer />
          <VoiceConversation />
        </LiveKitRoom>
      )}
      </div>
      <div className="hidden lg:block lg:w-1/2 h-full">
        <LiveFormPanel />
      </div>
      </div>
    </div>
  );
};

function VoiceConversation() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState("");
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  // Subscribe to live transcripts. STT (user) emits each interim transcript
  // as a separate stream (e.g. "7" -> "790" -> "790355" -> final). We collapse
  // those into one bubble that updates in place per utterance.
  //
  // TTS-aligned agent transcripts may stream chunks within a single sentence-
  // long stream and may not always emit a "final" marker per sentence. We give
  // each agent stream its own bubble so the chat stays chronological.
  const liveUserBubbleByIdentity = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    if (!room) return;
    const handler = async (reader: any, info: any) => {
      const isFinal = reader.info.attributes?.["lk.transcription_final"] !== "false";
      const isFromLocalParticipant = info.identity === room.localParticipant.identity;
      const role: "user" | "assistant" = isFromLocalParticipant ? "user" : "assistant";

      if (role === "user") {
        let text = "";
        try { text = await reader.readAll(); } catch { /* ignore */ }
        if (!text) return;
        const liveId = liveUserBubbleByIdentity.current.get(info.identity);
        if (liveId) {
          setBubbles((prev) =>
            prev.map((b) => (b.id === liveId ? { ...b, text, interim: !isFinal } : b))
          );
          if (isFinal) liveUserBubbleByIdentity.current.delete(info.identity);
        } else {
          const id = newId();
          setBubbles((prev) => [...prev, { id, role, text, interim: !isFinal }]);
          if (!isFinal) liveUserBubbleByIdentity.current.set(info.identity, id);
        }
        return;
      }

      // Agent: new bubble per stream, accumulate chunks live as TTS plays.
      const streamId = reader.info.id;
      setBubbles((prev) => [...prev, { id: streamId, role, text: "", interim: !isFinal }]);
      let acc = "";
      try {
        for await (const chunk of reader) {
          acc += chunk;
          setBubbles((prev) =>
            prev.map((b) => (b.id === streamId ? { ...b, text: acc } : b))
          );
        }
      } catch { /* ignore */ }
      setBubbles((prev) =>
        prev.map((b) => (b.id === streamId ? { ...b, interim: false } : b))
      );
    };
    try {
      room.registerTextStreamHandler("lk.transcription", handler);
    } catch (e) {
      console.warn("Failed to register transcription handler", e);
    }
    return () => {
      try { room.unregisterTextStreamHandler("lk.transcription"); } catch { /* noop */ }
      liveUserBubbleByIdentity.current.clear();
    };
  }, [room]);

  // Auto-scroll on new content
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [bubbles]);

  const toggleMic = useCallback(() => {
    const next = !isMicEnabled;
    localParticipant?.setMicrophoneEnabled(next);
    setIsMicEnabled(next);
  }, [isMicEnabled, localParticipant]);

  const endCall = useCallback(() => {
    room?.disconnect();
  }, [room]);

  const sendText = useCallback(async () => {
    const text = draft.trim();
    if (!text || !room) return;
    try {
      await room.localParticipant.sendText(text, { topic: "lk.chat" });
      setBubbles((prev) => [...prev, { id: newId(), role: "user", text, interim: false }]);
      setDraft("");
    } catch (e) {
      console.error("Failed to send text", e);
    }
  }, [draft, room]);

  return (
    <>
      <main ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <div className="max-w-2xl mx-auto flex flex-col gap-3">
          {bubbles.length === 0 && (
            <div className="self-start text-gray-400 text-sm italic px-3 py-2">
              Speak or type to begin…
            </div>
          )}
          {bubbles.map((b) => (
            <BubbleView key={b.id} role={b.role} text={b.text} interim={b.interim} />
          ))}
        </div>
      </main>

      <footer className="border-t border-gray-100 bg-white px-4 py-3 sm:px-6">
        <div className="max-w-2xl mx-auto flex items-end gap-2">
          <button
            onClick={toggleMic}
            className={`rounded-full p-3 transition-colors ${
              isMicEnabled ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-red-500 text-white"
            }`}
            aria-label={isMicEnabled ? "Mute" : "Unmute"}
            title={isMicEnabled ? "Mute microphone" : "Unmute microphone"}
          >
            {isMicEnabled ? <Mic size={20} /> : <MicOff size={20} />}
          </button>

          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendText();
              }
            }}
            placeholder="Or type to interrupt the agent…"
            rows={1}
            className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
          />

          <button
            onClick={sendText}
            disabled={!draft.trim()}
            className="rounded-lg p-2 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: BRAND_COLOR, color: BRAND_TEXT_COLOR }}
            aria-label="Send text"
          >
            <Send size={18} />
          </button>

          <button
            onClick={endCall}
            className="rounded-full p-3 bg-red-600 text-white hover:bg-red-700"
            aria-label="End call"
            title="End call"
          >
            <PhoneOff size={20} />
          </button>
        </div>
        <p className="mt-2 text-[11px] text-gray-400 text-center">{DISCLAIMER}</p>
      </footer>
    </>
  );
}

function BubbleView({ role, text, interim }: { role: "user" | "assistant"; text: string; interim: boolean }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
          isUser ? "rounded-br-md" : "rounded-bl-md bg-white text-gray-800"
        } ${interim ? "opacity-70 italic" : ""}`}
        style={isUser ? { backgroundColor: BRAND_COLOR, color: BRAND_TEXT_COLOR } : undefined}
      >
        {text || (interim ? "…" : "")}
      </div>
    </div>
  );
}

export default AgentVoicePage;

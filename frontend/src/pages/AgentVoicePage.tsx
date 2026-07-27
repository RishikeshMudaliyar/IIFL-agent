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
import { useLead, leadToDynamicVars, useFormSessionId, resetFormSessionId } from "../contexts/LeadContext";
import { endFormSession } from "../lib/sessionCleanup";
import LiveFormPanel from "../components/LiveFormPanel";

const BRAND_COLOR = "#F56E28";      // IIFL orange
const BRAND_TEXT_COLOR = "#ffffff";
const DISCLAIMER = "This is an AI powered call";

type Bubble = {
  id: string;
  role: "user" | "assistant";
  text: string;
  interim: boolean;
};

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

/**
 * Strip agent-internal machinery that a weak model (gemma) occasionally emits as
 * spoken text — so it never reaches the client-facing live transcript:
 *   - <derived-variable key="..." value="..."/>   (sigil capture rendered as a tag)
 *   - tool.fill_field(...) / functions.foo(...)   (tool-call syntax spoken literally)
 *   - // ... internal-step narration                (comment lines)
 * These are the platform's job to consume silently; they are not conversation.
 * Belt-and-braces alongside the prompt guardrail — the prompt reduces it, this guarantees it.
 */
function sanitizeTranscript(text: string): string {
  return text
    // <derived-variable .../> or any lone self-closing machine tag
    .replace(/<\s*derived-variable[^>]*\/?>/gi, "")
    .replace(/<\/?\s*(derived-variable|tool[-_]?call|function[-_]?call)[^>]*>/gi, "")
    // tool.name(...) or functions.name(...) call syntax
    .replace(/\b(?:tool|functions)\.\w+\s*\([^)]*\)/gi, "")
    // whole-line // comments the model narrated as speech
    .replace(/(^|\n)\s*\/\/[^\n]*/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

const AgentVoicePage = () => {
  const navigate = useNavigate();
  const { lead } = useLead();
  // One stable session id for this call — the Playwright fill tools key off it.
  const formSessionId = useFormSessionId();
  // Pass the four collected fields so the agent's greeting already knows them.
  const { details, status, errorMessage, restart } = useNurixVoice(
    {},
    { dynamicVars: leadToDynamicVars(lead, formSessionId) },
  );

  // EVERY CALL CLEANS UP AFTER ITSELF — BUT ONLY ON A REAL END.
  //
  // ⚠️ DO NOT CLEAN UP ON UNMOUNT. An earlier version did, and it destroyed the
  // browser of the call that was still in progress:
  //
  //   <React.StrictMode> (index.tsx) deliberately mounts -> unmounts -> remounts
  //   every component. The unmount cleanup fired the teardown beacon MID-CALL,
  //   the remount minted a fresh useFormSessionId(), and the call was left
  //   talking to a session whose browser no longer existed. Observed live on call
  //   f218771b: session web-6c978c49 started 12:17:25, a second session appeared
  //   at 12:19:17 unasked, and click_button scheme_max then failed with
  //   "Button 'scheme_max' not found". On screen: noVNC showed "Reconnecting…"
  //   and the demo jumped back to the branch hero.
  //
  // Unmount is NOT a reliable "the call ended" signal. Only two things are:
  // the user pressing hang up, and LiveKit reporting the room disconnected.
  // Both are wired below via cleanUp(). Leaving the page without either of those
  // is handled by the backend's own lazy teardown on the next start_session,
  // which is exactly what that safety net is for.
  //
  // Latched so the beacon fires at most once per call (endCall and
  // onDisconnected both fire on a normal hang-up).
  const cleanedUpRef = useRef(false);
  const cleanUp = useCallback(() => {
    if (cleanedUpRef.current) return;
    cleanedUpRef.current = true;
    endFormSession(formSessionId);
    // The call is genuinely over, so the next demo must mint a NEW session id
    // rather than reuse this one (which now has no browser behind it).
    resetFormSessionId();
  }, [formSessionId]);

  useEffect(() => {
    // pagehide = tab close / reload / navigating away for real. This one is safe
    // because StrictMode does not fire it — unlike unmount.
    window.addEventListener("pagehide", cleanUp);
    return () => {
      window.removeEventListener("pagehide", cleanUp);
      // NOTHING HERE. See the comment above: cleaning up on unmount kills a live
      // call under StrictMode.
    };
  }, [cleanUp]);

  return (
    <div className="h-[100dvh] flex flex-col font-sans bg-gray-50">
      <header className="px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between border-b border-gray-100 bg-white">
        <button onClick={() => navigate("/home")} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
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
          onDisconnected={() => {
            // Clear the browser the moment the call actually ends, rather than
            // waiting for unmount — the screen must be blank before the next demo.
            cleanUp();
            navigate("/home");
          }}
          className="flex-1 min-h-0 flex flex-col"
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
      // Sanitize before display so any machine tokens (<derived-variable/>, tool.*,
      // // comments) the model may emit never reach the client-facing transcript.
      const streamId = reader.info.id;
      setBubbles((prev) => [...prev, { id: streamId, role, text: "", interim: !isFinal }]);
      let acc = "";
      try {
        for await (const chunk of reader) {
          acc += chunk;
          const clean = sanitizeTranscript(acc);
          setBubbles((prev) =>
            prev.map((b) => (b.id === streamId ? { ...b, text: clean } : b))
          );
        }
      } catch { /* ignore */ }
      setBubbles((prev) =>
        prev
          .map((b) => (b.id === streamId ? { ...b, text: sanitizeTranscript(acc), interim: false } : b))
          // drop a bubble that sanitized down to nothing (a turn that was ONLY machine tokens)
          .filter((b) => !(b.id === streamId && b.text.trim() === ""))
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

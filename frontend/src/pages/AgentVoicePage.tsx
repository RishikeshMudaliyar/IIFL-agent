import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, PhoneOff, PhoneCall, ChevronLeft, Loader2 } from "lucide-react";
import { CLIENT_NAME } from "../config/branding";
import { useNurixOutbound, toE164India, TranscriptTurn, CallStatus } from "../hooks/use-nurix-outbound";
import { useLead, leadToDynamicVars } from "../contexts/LeadContext";
import LiveFormPanel from "../components/LiveFormPanel";

const BRAND_COLOR = "#F56E28"; // IIFL orange
const BRAND_TEXT_COLOR = "#ffffff";
const DISCLAIMER = "This is an AI powered call";

// Human-friendly status line for the phone-call flow.
function statusLabel(status: CallStatus, phone: string): { text: string; tone: "info" | "ok" | "bad" } {
  const pretty = phone ? toE164India(phone) : "your phone";
  switch (status) {
    case "dialing":
      return { text: "Placing the call…", tone: "info" };
    case "INITIATED":
      return { text: `Calling ${pretty} — please pick up…`, tone: "info" };
    case "CONNECTED":
    case "IN_PROGRESS":
      return { text: "Connected — talk to Ira on your phone", tone: "ok" };
    case "COMPLETED":
      return { text: "Call ended", tone: "info" };
    case "VOICEMAIL":
      return { text: "Reached voicemail — no answer", tone: "bad" };
    case "FAILED":
      return { text: "Call failed — please try again", tone: "bad" };
    case "error":
      return { text: "Could not start the call", tone: "bad" };
    default:
      return { text: "Preparing…", tone: "info" };
  }
}

const AgentVoicePage = () => {
  const navigate = useNavigate();
  const { lead } = useLead();

  const { status, errorMessage, turns, restart } = useNurixOutbound(
    {},
    { phone: lead.phone, dynamicVars: leadToDynamicVars(lead) },
  );

  const label = statusLabel(status, lead.phone);
  const dotColor =
    label.tone === "ok" ? "bg-green-500" : label.tone === "bad" ? "bg-red-500" : "bg-amber-400";

  return (
    <div className="h-[100dvh] flex flex-col font-sans bg-gray-50">
      <header className="px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between border-b border-gray-100 bg-white">
        <button onClick={() => navigate("/home")} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ChevronLeft size={20} />
          <span className="font-semibold text-sm">Back</span>
        </button>
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4" style={{ color: BRAND_COLOR }} />
          <span className="font-bold text-gray-900 text-sm sm:text-base">{CLIENT_NAME} Agent</span>
          <span className={`ml-2 inline-block w-2 h-2 rounded-full ${dotColor}`} title={status} />
        </div>
        <span className="text-xs text-gray-400 hidden sm:inline">{CLIENT_NAME}</span>
      </header>

      <div className="flex-1 min-h-0 flex">
        {/* Left: call status + live transcript */}
        <div className="flex flex-col min-h-0 flex-1 lg:w-1/2 lg:flex-none border-r border-gray-100">
          {/* Status banner */}
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6 bg-white border-b border-gray-100">
            <span
              className={`flex items-center justify-center w-9 h-9 rounded-full ${
                label.tone === "ok" ? "bg-green-50" : label.tone === "bad" ? "bg-red-50" : "bg-amber-50"
              }`}
            >
              {status === "CONNECTED" ? (
                <PhoneCall size={18} className="text-green-600" />
              ) : label.tone === "bad" ? (
                <PhoneOff size={18} className="text-red-600" />
              ) : (
                <Loader2 size={18} className="animate-spin text-amber-500" />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{label.text}</p>
              {status === "error" && errorMessage && (
                <p className="text-xs text-red-500 break-words">{errorMessage}</p>
              )}
            </div>
            {(label.tone === "bad") && (
              <button
                onClick={restart}
                className="ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ backgroundColor: BRAND_COLOR, color: BRAND_TEXT_COLOR }}
              >
                Retry call
              </button>
            )}
          </div>

          <TranscriptView turns={turns} connecting={status === "dialing" || status === "INITIATED"} />

          <footer className="border-t border-gray-100 bg-white px-4 py-3 sm:px-6">
            <p className="text-[12px] text-gray-500 text-center">
              🎙️ The conversation is happening on your phone. Speak naturally — Ira is listening.
            </p>
            <p className="mt-1 text-[11px] text-gray-400 text-center">{DISCLAIMER}</p>
          </footer>
        </div>

        {/* Right: live form-fill over noVNC */}
        <div className="hidden lg:block lg:w-1/2 h-full">
          <LiveFormPanel />
        </div>
      </div>
    </div>
  );
};

function TranscriptView({ turns, connecting }: { turns: TranscriptTurn[]; connecting: boolean }) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  return (
    <main ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
      <div className="max-w-2xl mx-auto flex flex-col gap-3">
        {turns.length === 0 && (
          <div className="self-start text-gray-400 text-sm italic px-3 py-2">
            {connecting ? "Waiting for the call to connect…" : "Transcript will appear here as you talk to Ira…"}
          </div>
        )}
        {turns.map((t) => (
          <BubbleView key={t.id} role={t.role} text={t.text} />
        ))}
      </div>
    </main>
  );
}

function BubbleView({ role, text }: { role: "user" | "assistant"; text: string }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
          isUser ? "rounded-br-md" : "rounded-bl-md bg-white text-gray-800"
        }`}
        style={isUser ? { backgroundColor: BRAND_COLOR, color: BRAND_TEXT_COLOR } : undefined}
      >
        {text}
      </div>
    </div>
  );
}

export default AgentVoicePage;

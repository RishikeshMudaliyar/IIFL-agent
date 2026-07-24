import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, MessageSquare, Phone, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { CLIENT_NAME } from "../config/branding";
import { useNurixChat } from "../hooks/use-nurix-chat";
import { useLead } from "../contexts/LeadContext";
import { parseLeadMarker } from "../lib/leadMarker";
import LiveFormPanel from "../components/LiveFormPanel";

const DISCLAIMER = "This is an AI-powered assistant. Verify key details with an IIFL representative.";
const BRAND_COLOR = "#F56E28";      // IIFL orange
const BRAND_TEXT_COLOR = "#ffffff";

const AgentChatPage = () => {
  const navigate = useNavigate();
  const { messages, sendMessage, isConnected, isLoading } = useNurixChat();
  const { setLead } = useLead();
  const [draft, setDraft] = useState("");
  const [dots, setDots] = useState("");
  const [leadReady, setLeadReady] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Scan assistant messages for the LEAD_COMPLETE marker. When found, populate
  // the shared lead context and flip the inline "Call Now" button on. We also
  // strip the marker from what the user sees (see displayMessages below).
  useEffect(() => {
    for (const m of messages) {
      if (m.role !== "assistant") continue;
      const parsed = parseLeadMarker(m.text);
      if (parsed) {
        setLead(parsed.lead);
        setLeadReady(true);
        break;
      }
    }
  }, [messages, setLead]);

  // Displayed messages have the marker stripped so it never shows in the chat.
  const displayMessages = useMemo(
    () =>
      messages
        .map((m) => {
          if (m.role !== "assistant") return m;
          const parsed = parseLeadMarker(m.text);
          return parsed ? { ...m, text: parsed.cleanedText } : m;
        })
        // Drop any message that became empty after stripping the marker.
        .filter((m) => m.text.trim().length > 0),
    [messages],
  );

  // Auto-scroll on new message or while typing indicator is visible
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [displayMessages, isLoading, leadReady]);

  // Animate the "Typing" trailing dots: "" → "." → ".." → "..." → repeat
  useEffect(() => {
    if (!isLoading) { setDots(""); return; }
    const t = setInterval(() => setDots((d) => (d.length >= 3 ? "" : d + ".")), 400);
    return () => clearInterval(t);
  }, [isLoading]);

  const handleSend = () => {
    if (!draft.trim() || !isConnected) return;
    sendMessage(draft);
    setDraft("");
  };

  const startCall = () => navigate("/agent/voice");

  return (
    <div className="h-[100dvh] flex flex-col font-sans bg-gray-50">
      <header className="px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between border-b border-gray-100 bg-white">
        <button
          onClick={() => navigate("/home")}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ChevronLeft size={20} />
          <span className="font-semibold text-sm">Back</span>
        </button>
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4" style={{ color: BRAND_COLOR }} />
          <span className="font-bold text-gray-900 text-sm sm:text-base">{CLIENT_NAME} Agent</span>
          <span
            className={`ml-2 inline-block w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-gray-400"}`}
            title={isConnected ? "Connected" : "Connecting…"}
          />
        </div>
        <span className="text-xs text-gray-400 hidden sm:inline">{CLIENT_NAME}</span>
      </header>

      <div className="flex-1 min-h-0 flex">
      <div className="flex flex-col min-h-0 flex-1 lg:w-1/2 lg:flex-none border-r border-gray-100">
      <main ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 sm:px-6">
        <div className="max-w-2xl mx-auto flex flex-col gap-3">
          {!isConnected && messages.length === 0 && (
            <div className="self-start text-gray-400 text-sm italic px-3 py-2">Connecting…</div>
          )}

          {displayMessages.map((m) => (
            <Bubble key={m.id} role={m.role} text={m.text} />
          ))}

          {isLoading && (
            <div className="self-start flex items-center gap-2 text-gray-500 text-sm italic px-3 py-2">
              <span className="inline-block w-2 h-2 rounded-full bg-gray-400 animate-pulse" />
              Typing{dots}
            </div>
          )}

          {/* Inline Call Now — appears once the agent has collected all 4 fields
              (LEAD_COMPLETE marker). Click starts the voice call with the context. */}
          {leadReady && (
            <div className="self-stretch mt-1 rounded-2xl border border-iifl-orange/30 bg-iifl-cream p-4 flex flex-col sm:flex-row sm:items-center gap-3 animate-fade-up">
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-800">All set — ready to connect you</p>
                <p className="text-xs text-gray-500">Our IIFL loan specialist will take it from here on a quick call.</p>
              </div>
              <button
                onClick={startCall}
                className="inline-flex items-center justify-center gap-2 bg-iifl-orange hover:bg-iifl-orange-dark text-white font-bold px-5 py-3 rounded-full shadow-md transition-colors text-sm shrink-0"
              >
                <Phone size={16} />
                Call Now
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-gray-100 bg-white px-4 py-3 sm:px-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={isConnected ? "Type your message…" : "Connecting…"}
              rows={1}
              className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
              disabled={!isConnected}
            />
            <button
              onClick={handleSend}
              disabled={!isConnected || !draft.trim()}
              className="rounded-lg p-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: BRAND_COLOR, color: BRAND_TEXT_COLOR }}
              aria-label="Send"
            >
              <Send size={18} />
            </button>
          </div>
          <p className="mt-2 text-[11px] text-gray-400 text-center">{DISCLAIMER}</p>
        </div>
      </footer>
      </div>
      <div className="hidden lg:block lg:w-1/2 h-full">
        <LiveFormPanel />
      </div>
      </div>
    </div>
  );
};

function Bubble({ role, text }: { role: "user" | "assistant"; text: string }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed shadow-sm ${
          isUser ? "rounded-br-md" : "rounded-bl-md bg-white text-gray-800"
        } chat-markdown`}
        style={isUser ? { backgroundColor: BRAND_COLOR, color: BRAND_TEXT_COLOR } : undefined}
      >
        <ReactMarkdown
          components={{
            p: ({ children }) => <p className="m-0 whitespace-pre-wrap">{children}</p>,
            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
            em: ({ children }) => <em className="italic">{children}</em>,
            ul: ({ children }) => <ul className="my-1 pl-4 list-disc">{children}</ul>,
            ol: ({ children }) => <ol className="my-1 pl-4 list-decimal">{children}</ol>,
            li: ({ children }) => <li className="my-0.5">{children}</li>,
            code: ({ children }) => (
              <code className="px-1 rounded bg-black/5 font-mono text-[0.85em]">{children}</code>
            ),
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noopener noreferrer" className="underline">
                {children}
              </a>
            ),
          }}
        >
          {text}
        </ReactMarkdown>
      </div>
    </div>
  );
}

export default AgentChatPage;

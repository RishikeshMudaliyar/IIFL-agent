import { ReactNode, useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Wifi, Signal, BatteryFull } from "lucide-react";
import { CLIENT_NAME } from "../config/branding";

const BRAND_COLOR = "#F56E28";

/** The voice agent's name. Must match the SOP persona and the opening_dialogue
 *  the caller hears — if these disagree, the caller is greeted by one name and
 *  sees another on screen. Rendered as an initial in the avatar circles below,
 *  so the layout holds regardless of how long the name is. */
export const AGENT_NAME = "Meera";

/** IIFL's published customer-care number — shown as the incoming caller ID.
 *  Public information; safe to display in the demo. */
export const IIFL_CALLER_NUMBER = "1860 267 3000";

/** How long the phone rings before it auto-answers (Option A).
 *  Long enough to register on a projector, short enough not to stall the demo. */
export const RING_DURATION_MS = 5000;

type Mode = "ringing" | "in-call";

/**
 * A smartphone mockup that wraps the voice-call UI so the demo reads as a real
 * phone call: it rings first ("incoming call from IIFL Finance"), then opens
 * into the live transcript.
 *
 * Purely presentational. It owns NO call state — the parent decides when the
 * mode flips, because mounting/unmounting the LiveKit room is what actually
 * starts and ends audio. See the teardown warning in AgentVoicePage.
 */
export default function PhoneCallFrame({
  mode,
  onAnswer,
  onDecline,
  children,
}: {
  mode: Mode;
  /** Called when the ring elapses (auto) or the green button is tapped. */
  onAnswer?: () => void;
  /** Called when the red button is tapped while ringing. */
  onDecline?: () => void;
  /** The in-call content — the live transcript + composer. */
  children?: ReactNode;
}) {
  return (
    <div className="flex-1 min-h-0 flex items-center justify-center p-3 sm:p-6 bg-gradient-to-b from-gray-100 to-gray-200">
      {/* Device chassis. max-h keeps the whole phone on screen on short laptops;
          the in-call transcript scrolls inside it rather than growing the frame. */}
      <div
        className={`relative w-full max-w-[400px] h-full max-h-[820px] rounded-[2.75rem] bg-gray-900 p-2.5 shadow-2xl ring-1 ring-black/10 ${
          mode === "ringing" ? "animate-[phoneShake_1.4s_ease-in-out_infinite]" : ""
        }`}
      >
        {/* Screen */}
        <div className="relative h-full w-full overflow-hidden rounded-[2.25rem] bg-white flex flex-col">
          <StatusBar dark={mode === "ringing"} />
          {mode === "ringing" ? (
            <RingingScreen onAnswer={onAnswer} onDecline={onDecline} />
          ) : (
            <InCallScreen>{children}</InCallScreen>
          )}
        </div>

        {/* Notch — drawn over the screen, like the real thing */}
        <div className="pointer-events-none absolute left-1/2 top-2.5 h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-gray-900" />
      </div>

      {/* Keyframes are declared here so the component is self-contained and
          needs no tailwind.config change. */}
      <style>{`
        @keyframes phoneShake {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          25%      { transform: translateX(-3px) rotate(-0.6deg); }
          75%      { transform: translateX(3px)  rotate(0.6deg); }
        }
        @keyframes ringPulse {
          0%   { transform: scale(1);   opacity: 0.55; }
          70%  { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/** Fake iOS-ish status bar. The clock is real so it never looks frozen. */
function StatusBar({ dark }: { dark: boolean }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const time = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <div
      className={`relative z-10 flex items-center justify-between px-7 pt-3 pb-1 text-[11px] font-semibold ${
        dark ? "text-white/90" : "text-gray-700"
      }`}
    >
      <span className="tabular-nums">{time}</span>
      <div className="flex items-center gap-1.5 opacity-90">
        <Signal size={12} />
        <Wifi size={12} />
        <BatteryFull size={14} />
      </div>
    </div>
  );
}

function RingingScreen({ onAnswer, onDecline }: { onAnswer?: () => void; onDecline?: () => void }) {
  // Auto-answer. The timer is the ONLY thing that advances the call in the
  // default demo flow; the green button is a manual shortcut for the same path.
  const answerRef = useRef(onAnswer);
  answerRef.current = onAnswer;
  useEffect(() => {
    const t = setTimeout(() => answerRef.current?.(), RING_DURATION_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-between bg-gradient-to-b from-gray-800 via-gray-900 to-black px-8 pb-10 pt-20 text-white">
      <div className="flex flex-col items-center">
        <p className="text-sm tracking-wide text-white/60">Incoming call</p>

        <div className="relative mt-10 flex h-28 w-28 items-center justify-center">
          {/* Two offset pulse rings so the ring reads as continuous */}
          <span
            className="absolute inset-0 rounded-full"
            style={{ backgroundColor: BRAND_COLOR, animation: "ringPulse 1.8s ease-out infinite" }}
          />
          <span
            className="absolute inset-0 rounded-full"
            style={{ backgroundColor: BRAND_COLOR, animation: "ringPulse 1.8s ease-out infinite 0.9s" }}
          />
          <div
            className="relative flex h-28 w-28 items-center justify-center rounded-full text-4xl font-bold shadow-lg"
            style={{ backgroundColor: BRAND_COLOR }}
          >
            {AGENT_NAME.charAt(0)}
          </div>
        </div>

        <h2 className="mt-8 text-2xl font-semibold">{CLIENT_NAME}</h2>
        <p className="mt-1.5 text-base tabular-nums text-white/70">{IIFL_CALLER_NUMBER}</p>
        <p className="mt-6 text-xs text-white/40">{AGENT_NAME} · Gold Loan · Mumbai</p>
      </div>

      <div className="flex w-full max-w-[240px] items-center justify-between">
        <CallButton
          onClick={onDecline}
          className="bg-red-500 hover:bg-red-600"
          label="Decline"
          icon={<PhoneOff size={26} />}
        />
        <CallButton
          onClick={onAnswer}
          className="bg-green-500 hover:bg-green-600 animate-bounce"
          label="Answer"
          icon={<Phone size={26} />}
        />
      </div>
    </div>
  );
}

function CallButton({
  onClick,
  className,
  label,
  icon,
}: {
  onClick?: () => void;
  className: string;
  label: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={onClick}
        aria-label={label}
        className={`flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg transition-colors ${className}`}
      >
        {icon}
      </button>
      <span className="text-[11px] text-white/60">{label}</span>
    </div>
  );
}

function InCallScreen({ children }: { children?: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Connected-call header: who's on the line + a live duration timer */}
      <div className="flex items-center gap-3 border-b border-gray-100 px-5 pb-3 pt-1">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: BRAND_COLOR }}
        >
          {AGENT_NAME.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">{AGENT_NAME} · {CLIENT_NAME}</p>
          <p className="truncate text-[11px] tabular-nums text-gray-400">{IIFL_CALLER_NUMBER}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
          <CallTimer />
        </div>
      </div>

      {/* The real call UI — transcript + composer — unchanged, just scoped
          inside the phone screen. */}
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

/** MM:SS since the call was answered. */
function CallTimer() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return <span className="text-xs font-medium tabular-nums text-gray-500">{`${mm}:${ss}`}</span>;
}

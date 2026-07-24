# Live transcript for the OUTBOUND phone call — engineer handoff

**For:** satyala.srikanth@nurix.ai
**Context:** IIFL demo. Agent "Ira" (voice agent id `56dfd3b8-5426-44c3-b1ea-3db962638948`, workspace `ed51dad4-783e-4adf-8ec0-1b14b8938a5d`) on `agentx-prod.nurixlabs.tech`.

## ✅ Update — live source found & wired

The listen WebSocket **is deployed** on `agentx-prod` after all. The earlier "all 404" was an artifact of probing with **HTTP GET** — the route is **WebSocket-only**, so a plain GET returns 404 while the **WS upgrade succeeds**:

```
wss://agentx-prod.nurixlabs.tech/voice/web/call/{call_id}/listen
  HTTP GET      -> 404   (misleading — no upgrade header)
  WS handshake  -> OPEN  (closes immediately only because the call_id was a dummy)
```

`frontend/src/hooks/use-nurix-outbound.ts` now subscribes to it and parses the `connected` / `data` / `disconnected` frames into transcript turns, with the post-call REST poll kept as a fallback. The hook's public interface is unchanged, so `AgentVoicePage` needs no edit. IIFL workspace/agent IDs are filled in from the context above.

### Verified on a live PSTN call (2026-07-24)

Drove a real call (`call_id a1dad2f3-…`, `room_id "sip-room-…"`, `livekit_instance "secondary"`, `direction "outbound"`) and captured the listener WS from the browser during an **answered, `IN_PROGRESS`** call:

```
+141ms   [open]
+1369ms  {"type":"connected","call_id":"a1dad2f3-…","room":"sip-room-a1dad2f3-…","listener_identity":"listener_…","ts_ms":…}
+16832ms [error] → [close code=1006]     # no data frames in 25s, then abnormal close
```

So on PSTN the listener sends **only `connected`, then zero transcript `data` frames** (and drops at ~17s). The transcript is NOT on the relayed LiveKit data channel — it rides the `lk.transcription` **text-stream** (the same one the web-call browser reads). Post-call poll also returns `{"transcript":[],"error":"Transcript not available yet …"}` until the call ends.

**→ This is now confirmed platform-side.** To give the browser a live PSTN transcript, `VoiceCallListenerService` must forward the room's `lk.transcription` text-stream over the WS (option A), **or** expose a subscribe-only LiveKit token for `room_id` so the browser reads it directly (option B). The frontend hook already connects to the listener WS and will parse `data` frames the moment they carry text — no further client change needed for the transcript itself.

**Post-call transcript is ALSO encrypted.** After hangup, `GET /voice/web/transcript/{id}` returns items, but `content` is base64 **ciphertext** (the call's `is_encrypted` flag) — it base64-decodes to non-UTF8 binary, and there's no client key or `?decrypt` param, so it can't be shown in the browser. So even the fallback can't render readable text; naively rendering it showed base64 blobs on the page. **To display the transcript at all: disable transcript encryption for this demo workspace, or add a server-side decrypt path.** The client now filters these blobs out (heuristic in `looksEncrypted`) so the panel stays clean.

**Fixed in this branch (client-side):**
- Call status: mapped `IN_PROGRESS`; then collapsed `INITIATED`/`CONNECTED`/`IN_PROGRESS` to one stable "Calling … pick up and talk to Ira" line (the `/voice/call` status is eventually-consistent and lagged a phase, showing "please pick up" during the call and "Connected" after hangup). Added `RNR` (no-answer) as terminal.
- Transcript: subscribe to the listener WS (ready for live `data` frames); post-call poll fallback now filters out encrypted base64 blobs.

**Still needs platform/config (to actually show a transcript):** (a) forward `lk.transcription` over the listener WS for the *live* transcript, and (b) disable transcript encryption OR expose a decrypt path for the *post-call* transcript.

---

## The two variants in this repo

| Branch | Call type | Live transcript? | Where it runs |
|---|---|---|---|
| `main` | **Outbound PHONE call** — agent dials the number in the form (Plivo outbound trunk `ST_aGf9DfQ4w48v`) | ❌ **This is the problem** | Deployed on Railway |
| `webcall-local` | **Web call** — browser mic + LiveKit | ✅ works (reference) | localhost only |

Both share: single "Talk to AI Agent" landing, warm transfer to the expert **+91 95124 98277** (agent-side `warm_transfer` tool, STATIC routing), and live form-fill over noVNC. Only the call transport + transcript differ.

## The problem

On the **phone-call** flow (`main`) we cannot show a live transcript on the web page during the call. The page polls `GET https://agentx-prod.nurixlabs.tech/voice/web/transcript/{call_id}` every 2s, but it stays empty/"loading" for the whole call and only fills in **after** the call ends.

## What we found (verified against agentX/voiceX source on `stage`)

1. **`GET /voice/web/transcript/{call_id}` is post-call only.**
   - Handler: `agentX/src/routes/voice/voice_web_router.py` → `get_call_transcript`.
   - Service: `agentX/src/services/voice/voice_web_service.py::get_transcript` reads `transcript.json` from **S3**, which `voicex-agent` writes **after the call ends**. Until then it returns `200 {"transcript": [], "error": "Transcript not available yet ..."}`. (Post-call item fields are `speaker` + `content`.)
   - The sibling endpoints (`/voice/web/events/{id}`, `/instrumentation/{id}`, etc.) are the same post-call S3 artifacts — no live text.

2. **There IS a live route in source, but it is NOT deployed on `agentx-prod`.**
   - `agentX/src/routes/voice/voice_web_router.py` → `@router.websocket("/call/{call_id}/listen")` → `VoiceCallListenerService.stream()` (`src/services/voice/voice_call_listener_service.py`). It joins the live LiveKit room (`call.room_id`, e.g. `voicex_call_{call_id}`) as a **hidden read-only participant** and relays frames to the browser. **No auth.** Envelopes: `connected` / `data` / `disconnected`.
   - We probed `wss://agentx-prod.nurixlabs.tech/{web,voice/web,voice,''}/call/{id}/listen` — **all 404**. So this route is not mounted on the prod build the demo uses.
   - Caveat: its `data` frames forward **raw LiveKit data-channel bytes**, not parsed transcript — unverified whether the transcript text actually rides that channel for a PSTN call (vs. the LiveKit `lk.transcription` text-stream, which the web-call path below uses).

3. **How the WEB call gets live transcript (the working reference on `webcall-local`).**
   - `POST /voice/web/call` returns `serverUrl` + `participantToken` + `roomName`; the browser joins the LiveKit room as a real participant and reads `room.registerTextStreamHandler("lk.transcription", ...)`.
   - See `frontend/src/pages/AgentVoicePage.tsx` (`VoiceConversation`) + `frontend/src/hooks/use-nurix-voice.ts` on this branch.
   - This does NOT apply to a phone call because the browser is not in the call's room.

## What we need help with

For the **outbound phone call**, give the browser a live transcript. Likely options (your call which is right):

- **(A)** Deploy/enable the `WS /web/call/{call_id}/listen` route on `agentx-prod`, and confirm its `data` frames actually carry the transcript text for a PSTN call (or extend it to forward the `lk.transcription` text-stream, the way the web-call browser path receives it).
- **(B)** Expose a **listen-only LiveKit token + room name** for an active call so the browser can subscribe to the room's `lk.transcription` streams directly (same mechanism the web call uses), without being an audio participant.
- **(C)** Any existing internal endpoint/WS the `zero` console uses to render a live call transcript that we can point the browser at.

The room name for a call is on the call record (`GET /voice/call/{call_id}` → `room_id`); web calls use `voicex_call_{call_id}`. Confirm what outbound/PSTN calls set for `room_id` + `livekit_instance`.

## Where the frontend hook lives (what to wire once a live source exists)

`frontend/src/hooks/use-nurix-outbound.ts` on `main` — it triggers the call and currently polls the post-call transcript endpoint. Swap that poll for the live source (WS or LiveKit observer token).

# Live transcript for the OUTBOUND phone call — engineer handoff

**For:** satyala.srikanth@nurix.ai
**Context:** IIFL demo. Agent "Ira" (voice agent id `56dfd3b8-5426-44c3-b1ea-3db962638948`, workspace `ed51dad4-783e-4adf-8ec0-1b14b8938a5d`) on `agentx-prod.nurixlabs.tech`.

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

"""
Gemini Live API WebSocket Server with Form-Filling Automation

A FastAPI server that provides real-time audio/video chat
with Google's Gemini Live API using WebSocket connections,
integrated with Playwright for automated form filling.

Features:
- Real-time bidirectional audio streaming
- Video frame capture and processing  
- Voice Activity Detection (VAD)
- Playwright-based form automation tools
- Session-based browser control
"""

import asyncio
import json
import os
import logging
import base64
from typing import Dict, Any
from pathlib import Path
from contextlib import asynccontextmanager
import uuid

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from websockets.exceptions import ConnectionClosed, ConnectionClosedOK
from google import genai
from google.genai import types as gtypes
from google.genai.types import (
    LiveConnectConfig, SpeechConfig, VoiceConfig, Blob,
    StartSensitivity, EndSensitivity, MediaResolution,
    ActivityHandling, FunctionDeclaration, Tool,
    GenerateContentConfig,
)
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import configuration module
from config import config

# Import Playwright service
from playwright_service import playwright_service, test_playwright_service

# Import database and loan routes
from database import init_db, close_db
from loan_routes import loan_router
from agent_routes import agent_router
from proxy_routes import proxy_router, agentx_router

# Configure logging using config module
logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(config.LOG_FILE, mode='a')
    ]
)
logging.getLogger('google_genai.types').setLevel(logging.ERROR)
logger = logging.getLogger(__name__)

def read_system_prompt() -> str:
    """
    Read the system prompt from the text file.
    
    Returns:
        str: The content of the system prompt file
    """
    try:
        with open('system_prompt.txt', 'r', encoding='utf-8') as file:
            return file.read().strip()
    except FileNotFoundError:
        logger.error("system_prompt.txt file not found")
        return "You are a helpful AI assistant."
    except Exception as e:
        logger.error(f"Error reading system prompt: {e}")
        return "You are a helpful AI assistant."


# Get form URL from environment variable
def get_form_url() -> str:
    """Get the URL of the form to fill from FORM_URL environment variable."""
    form_url = os.getenv("FORM_URL")
    if not form_url:
        raise ValueError("FORM_URL environment variable is not set")
    return form_url


# Define Gemini function declarations for form automation tools
FORM_AUTOMATION_TOOLS = Tool(
    function_declarations=[
        # FunctionDeclaration(
        #     name="start_browser",
        #     description="Launch a browser and open the loan application form. Call this before filling any fields. Returns a session_id for subsequent operations.",
        #     parameters={
        #         "type": "object",
        #         "properties": {},
        #         "required": []
        #     }
        # ),
        FunctionDeclaration(
            name="fill_field",
            description="Fill a field in the loan application form based on user's answer. Field names include: mobile, terms, otp, pan, full_name, consent1, consent2, email, dob, income, building, road, pincode, city, state, gender, employment",
            parameters={
                "type": "object",
                "properties": {
                    "field_name": {
                        "type": "string",
                        "description": "The name of the field to fill. One out of - mobile, terms, otp, pan, full_name, consent1, consent2, email, dob, income, building, road, pincode, city, state, gender, employment"
                    },
                    "value": {
                        "type": "string",
                        "description": "The value to fill in the field based on user's answer. 1. for 'mobile' field, the value is a 10-digit string. 2. for 'terms' field, share 'true' if the user agrees to the terms and conditions, otherwise share 'false'. 3. for 'otp' field, share the 6-digit OTP string. 4. for 'pan' field, share the 10-digit PAN number. 5. for 'full_name' field, share the full name string. 6. for 'consent1' field, share 'true' if the user agrees to the credit bureau terms and conditions, otherwise share 'false'. 7. for 'consent2' field, share 'true' if the user agrees to the regulatory income declaration terms and conditions, otherwise share 'false'. 8. for 'email' field, share the email address string. 9. for 'dob' field, share the date of birth in the format YYYY-MM-DD. 10. for 'income' field, share the monthly income. 11. for 'building' field, provide the house number and building name. 12. for 'road' field, provide the road name, area or colony you live in. 13. for 'pincode' field, share the pincode string. 14. for 'city' field, share the city name. 15. for 'state' field, share the Indian state name. 16. for 'gender' field, provide values one out of - male, female, other. 17. for 'employment' field, provide values one out of - salaried, self-employed."
                    }
                },
                "required": ["field_name", "value"]
            }
        ),
        FunctionDeclaration(
            name="click_button",
            description="Submit the form or press a button. Button names include: apply_now, continue, verify_continue, get_loan_offer, back_to_step4",
            parameters={
                "type": "object",
                "properties": {
                    "button": {
                        "type": "string",
                        "description": "Name of the button to click based on completion of a step: 'apply_now' for initial mobile number submission, 'verify_continue' for verifying the OTP, 'continue' for submitting name and PAN, 'get_loan_offer' for getting the loan offers after all details are filled, 'back_to_step4' for going back to step 4 from step 5",
                        "enum": ["apply_now", "continue", "verify_continue", "get_loan_offer", "back_to_step4"]
                    }
                },
                "required": ["button"]
            }
        )
        # FunctionDeclaration(
        #     name="close_session",
        #     description="Close the browser session. Call this after the application is complete or if user wants to cancel.",
        #     parameters={
        #         "type": "object",
        #         "properties": {
        #             "session_id": {
        #                 "type": "string",
        #                 "description": "The session ID to close"
        #             }
        #         },
        #         "required": ["session_id"]
        #     }
        # )
    ]
)


async def handle_tool_call(session_id: str, function_name: str, function_args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle tool calls from Gemini by executing the corresponding Playwright actions.
    
    Args:
        function_name: Name of the tool being called
        function_args: Arguments for the tool
        
    Returns:
        Dict with the result of the tool execution
    """
    logger.info(f"Handling tool call: {function_name} with args: {function_args}")
    
    try:
        if function_name == "start_browser":
            form_url = get_form_url()
            result = await playwright_service.start_session(form_url)
            return result
            
        elif function_name == "fill_field":
            field_name = function_args.get("field_name")
            value = function_args.get("value")
            
            if not all([session_id, field_name, value]):
                return {"success": False, "error": "Missing required parameters: session_id, field_name, and value are required"}
            
            result = await playwright_service.fill_field(session_id, field_name, value)
            return result
            
        elif function_name == "click_button":
            button = function_args.get("button", "send_otp")
            
            if not session_id:
                return {"success": False, "error": "Missing required parameter: session_id"}
            
            result = await playwright_service.click_button(session_id, button)
            return result
            
        elif function_name == "close_session":
            
            if not session_id:
                return {"success": False, "error": "Missing required parameter: session_id"}
            
            result = await playwright_service.destroy_session(session_id)
            return result
            
        else:
            return {"success": False, "error": f"Unknown function: {function_name}"}
            
    except Exception as e:
        logger.error(f"Tool execution error: {e}")
        return {"success": False, "error": str(e)}


# Use configuration values (backward compatible)
PROJECT = config.PROJECT or os.getenv("GOOGLE_CLOUD_PROJECT")
LOC = config.LOCATION

# Load models and voices from configuration (backward compatible with env vars)
MODELS = config.MODELS
VOICES = config.VOICES

# Log configuration status
logger.info(f"Loaded {len(MODELS)} models and {len(VOICES)} voices from configuration")
if config.DEBUG_MODE:
    logger.debug(f"Available models: {list(MODELS.keys())}")
    logger.debug(f"Available voices: {list(VOICES.keys())}")

# Initialize client based on authentication configuration.
# NOTE: this Gemini/Vertex client only powers the legacy local /ws agent path.
# The hosted-Nurix demo (Meera) uses /agent/* (Playwright) + /nurix-proxy instead and
# never touches this client. So a missing-credentials failure here must NOT crash the
# whole app — guard it so /health, /agent/*, /vnc, /nurix-proxy stay up on Railway
# even without GCP/Vertex creds. (Matches the documented "the /ws Gemini agent needs
# GCP creds; doesn't affect the Mozart flow or widgets" behavior.)
client = None
try:
    if config.USE_VERTEX_AI:
        logger.info("Using Vertex AI authentication")
        client = genai.Client(vertexai=True, project=PROJECT, location=LOC)
    else:
        logger.info("Using API key authentication")
        client = genai.Client(api_key=config.GEMINI_API_KEY)
except Exception as e:
    logger.warning(
        f"Gemini/Vertex client init failed ({e}); the local /ws Gemini agent is "
        f"DISABLED, but /agent/*, /vnc, /nurix-proxy and /health remain available."
    )
    client = None

# Reap Playwright sessions idle for more than this many seconds.
IDLE_SESSION_TIMEOUT_SECONDS = 3600  # 1 hour
# How often the reaper runs.
IDLE_SESSION_CLEANUP_INTERVAL_SECONDS = 600  # 10 minutes


async def _periodic_session_cleanup():
    """Background task: every 10 minutes, kill any Playwright session that
    has been idle (no fill_field / click_button) for more than 1 hour. Each
    reaped session frees its Chromium child process (~200-500 MB)."""
    while True:
        try:
            await asyncio.sleep(IDLE_SESSION_CLEANUP_INTERVAL_SECONDS)
            reaped = await playwright_service.cleanup_idle_sessions(
                idle_seconds=IDLE_SESSION_TIMEOUT_SECONDS,
            )
            if reaped:
                logger.info(f"Idle-session cleanup: destroyed {reaped} session(s)")
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Periodic session cleanup error: {e}")


# Lifespan event handler
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events"""
    # Startup: Initialize database
    logger.info("Initializing database...")
    try:
        await init_db()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
    cleanup_task = asyncio.create_task(_periodic_session_cleanup())
    yield
    # Shutdown: clean up resources
    logger.info("Shutting down services...")
    cleanup_task.cancel()
    await close_db()
    await playwright_service.shutdown()

app = FastAPI(title="Gemini Live API Server", lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include loan routes
app.include_router(loan_router)
app.include_router(agent_router)
app.include_router(proxy_router)
app.include_router(agentx_router)

@app.get("/api/config")
async def get_config() -> Dict[str, Any]:
    """
    Get current backend configuration (read-only).
    
    Returns:
        Dictionary containing current backend configuration
    """
    logger.info("Serving backend configuration")
    return {
        "model": config.DEFAULT_MODEL,
        "voice": config.DEFAULT_VOICE,
        "features": {
            "outputMode": config.DEFAULT_OUTPUT_MODE,
            "enableVAD": config.DEFAULT_ENABLE_VAD,
            "enableInterruption": config.DEFAULT_ENABLE_INTERRUPTION,
            "inputTranscription": config.DEFAULT_INPUT_TRANSCRIPTION,
            "outputTranscription": config.DEFAULT_OUTPUT_TRANSCRIPTION,
            "enableVideo": config.DEFAULT_ENABLE_VIDEO
        }
    }

@app.get("/health")
async def health_check() -> Dict[str, str]:
    """
    Health check endpoint for Cloud Run.
    
    Returns:
        Dictionary with health status
    """
    return {"status": "healthy", "service": "form-filling-ai-backend"}


async def handle_chat_websocket(ws: WebSocket, session_state: dict):
    """Handle chat mode using generate_content with manual history for reliable function calling."""
    model_id = config.TEXT_CHAT_MODEL
    system_instruction = read_system_prompt()
    history: list = []

    await ws.send_json({
        "type": "connected",
        "model": model_id,
        "mode": "chat",
        "features": {"outputMode": "text", "formAutomation": True},
    })

    async def do_turn(user_text: str):
        history.append({"role": "user", "parts": [{"text": user_text}]})
        stall_retries = 0  # reset only on real tool calls, not on nudges

        while True:
            last = history[-1]
            last_role = last.get('role') if isinstance(last, dict) else getattr(last, 'role', '?')
            logger.info(f"Calling generate_content, history length={len(history)}, last role={last_role}")
            try:
                response = await asyncio.wait_for(
                    client.aio.models.generate_content(
                        model=model_id,
                        contents=history,
                        config=GenerateContentConfig(
                            system_instruction=system_instruction,
                            tools=[FORM_AUTOMATION_TOOLS],
                        ),
                    ),
                    timeout=30.0,
                )
            except asyncio.TimeoutError:
                logger.error("Chat API timed out after 30s")
                await ws.send_json({"type": "error", "message": "Response timed out"})
                return
            except Exception as e:
                if "429" in str(e):
                    logger.warning(f"Rate limited (429), waiting 10s before retry")
                    await asyncio.sleep(10)
                    continue  # retry the same call
                logger.error(f"Chat API error: {e}")
                await ws.send_json({"type": "error", "message": str(e)})
                return

            logger.info(f"generate_content returned, candidates={len(response.candidates) if response.candidates else 0}")

            # Add model response to history as the native Content object (not a dict)
            # Converting to dict loses proto metadata and causes empty responses after tool calls
            if response.candidates:
                history.append(response.candidates[0].content)

            fn_calls = response.function_calls or []
            logger.info(f"Function calls in response: {[fc.name for fc in fn_calls]}")
            if fn_calls:
                fn_parts = []
                for fc in fn_calls:
                    args = dict(fc.args) if fc.args else {}
                    result = await handle_tool_call(session_state["session_id"], fc.name, args)
                    result = json.loads(json.dumps(result, default=str))
                    await ws.send_json({"type": "toolResult", "function": fc.name, "result": result})
                    fc_id = getattr(fc, 'id', None)
                    fn_parts.append(gtypes.Part(
                        function_response=gtypes.FunctionResponse(
                            id=fc_id,
                            name=fc.name,
                            response=result,
                        )
                    ))
                history.append(gtypes.Content(role="user", parts=fn_parts))
                stall_retries = 0  # real tool call — reset counter
                logger.info(f"Added function responses, looping again")
            else:
                text = (response.text or "").strip()
                logger.info(f"No function calls, text={text[:80] if text else '(empty)'}")

                # Retry whenever Gemini returns empty text, regardless of whether a tool
                # call just happened. The stall_retries counter resets only on real tool
                # calls so consecutive nudge attempts are bounded correctly.
                is_stalled = not text

                if is_stalled and stall_retries < 2:
                    stall_retries += 1
                    logger.warning(f"Stalled empty response (retry {stall_retries}/2)")
                    await asyncio.sleep(1.5)
                    history.append({"role": "user", "parts": [{"text": "Please continue with the next step in the loan application and ask the user for the next required piece of information."}]})
                else:
                    if text:
                        await ws.send_json({"type": "text", "content": text})
                    await ws.send_json({"type": "turnComplete"})
                    return

    await do_turn("Start the conversation.")
    while True:
        try:
            msg = await ws.receive()
        except (WebSocketDisconnect, ConnectionClosed, ConnectionClosedOK):
            break
        if msg.get("type") == "websocket.disconnect":
            break
        if "text" in msg:
            try:
                data = json.loads(msg["text"])
                if data.get("type") == "text":
                    await do_turn(data["text"])
            except json.JSONDecodeError:
                pass


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    """
    Main WebSocket endpoint for Gemini Live API communication.
    
    Supports two modes via query parameter:
    - mode=chat: Text-only mode (AI responds with text, no audio)
    - mode=talk: Voice+Text mode (AI responds with audio + text transcription)
    
    Example: ws://localhost:8000/ws?mode=chat
    """
    client_ip = ws.client.host if ws.client else "unknown"

    # Session state container to track browser session for this WebSocket
    # This allows cleanup of the correct session on disconnect
    session_id = str(uuid.uuid4())
    session_state = {"session_id": session_id}
    form_url = get_form_url()
    asyncio.create_task(playwright_service.start_session(form_url, session_id))
    logger.info(f"Started session for {session_id}")
    
    # Get mode from query parameters (default to 'talk' for backward compatibility)
    mode = ws.query_params.get("mode", "talk").lower()
    if mode not in ["chat", "talk"]:
        mode = "talk"  # Default to talk if invalid mode
    
    logger.info(f"New WebSocket connection from {client_ip} - Mode: {mode}")

    await ws.accept()

    if mode == "chat":
        try:
            await handle_chat_websocket(ws, session_state)
        except (WebSocketDisconnect, ConnectionClosed, ConnectionClosedOK):
            logger.info("Chat client disconnected")
        except Exception as e:
            logger.error(f"Chat error: {e}")
            try:
                await ws.send_json({"type": "error", "message": str(e)})
            except Exception:
                pass
        finally:
            if session_state.get("session_id"):
                try:
                    await playwright_service.destroy_session(session_state["session_id"])
                except Exception as cleanup_error:
                    logger.debug(f"Cleanup note: {cleanup_error}")
        return

    try:
        # Select model based on mode
        # Native audio models (like gemini-live-2.5-flash-native-audio) ONLY support audio output
        voice = config.DEFAULT_VOICE

        # Talk mode: Use native audio model for best audio quality
        model_id = config.DEFAULT_MODEL
        output_mode = "audio"
        response_modalities = ['AUDIO']

        logger.info(f"Using configuration: model={model_id}, voice={voice}, mode={mode}")

        # Use backend-defined feature settings only
        enable_vad = config.DEFAULT_ENABLE_VAD
        enable_interruption = config.DEFAULT_ENABLE_INTERRUPTION
        input_transcription = config.DEFAULT_INPUT_TRANSCRIPTION
        output_transcription = config.DEFAULT_OUTPUT_TRANSCRIPTION
        enable_video = config.DEFAULT_ENABLE_VIDEO

        logger.info(f"Features: output_mode={output_mode}, VAD={enable_vad}, interruption={enable_interruption}, "
                   f"input_transcription={input_transcription}, output_transcription={output_transcription}, video={enable_video}")

        # Build configuration with tools
        config_dict = {
            "response_modalities": response_modalities,
            "system_instruction": {
                "parts": [
                    {
                        "text": read_system_prompt()
                    }
                ]
            },
            "tools": [FORM_AUTOMATION_TOOLS]
        }

        # Always add speech config (both chat and talk use AUDIO modality)
        config_dict["speech_config"] = SpeechConfig(
            voice_config=VoiceConfig(prebuilt_voice_config={"voice_name": voice})
        )
        # Add transcription if enabled
        if input_transcription:
            config_dict["input_audio_transcription"] = {}
        # For chat mode, always enable output transcription so text reaches the frontend
        if output_transcription or mode == "chat":
            config_dict["output_audio_transcription"] = {}
            
        # Add video support if requested
        if enable_video:
            config_dict["media_resolution"] = MediaResolution.MEDIA_RESOLUTION_MEDIUM
            
        # Log the complete configuration for debugging
        logger.info(f"Live config: {config_dict}")
        
        try:
            live_cfg = LiveConnectConfig(**config_dict)
            logger.info(f"LiveConnectConfig created successfully")
        except Exception as e:
            logger.error(f"Failed to create LiveConnectConfig: {e}")
            await ws.send_json({"type": "error", "message": f"Configuration error: {e}"})
            return
        
        try:
            async with client.aio.live.connect(model=model_id, config=live_cfg) as sess:
                logger.info(f"Connected to {model_id} with voice {voice}")
                
                # Send silent initial prompt - AI will call start_browser then greet after tool returns
                initial_prompt = "Start the conversation."
                await sess.send_realtime_input(text=initial_prompt)
                logger.info("Sent initial prompt to trigger browser start")
                
                # Send connection success with backend configuration
                connection_response = {
                    "type": "connected",
                    "model": model_id,
                    "voice": voice,
                    "mode": mode,  # chat or talk
                    "features": {
                        "outputMode": output_mode,
                        "vad": enable_vad,
                        "interruption": enable_interruption,
                        "inputTranscription": input_transcription,
                        "outputTranscription": output_transcription,
                        "video": enable_video,
                        "formAutomation": True
                    }
                }
                
                await ws.send_json(connection_response)
                
                # Start forwarding tasks - pass output_mode to control audio forwarding
                recv_task = asyncio.create_task(forward_model(sess, ws, session_state, output_mode))
                send_task = asyncio.create_task(forward_browser(sess, ws))
                keep_alive_task = asyncio.create_task(keep_alive(sess))
                keep_alive_ws_task = asyncio.create_task(keep_alive_ws(ws))
                all_tasks = [recv_task, send_task, keep_alive_task, keep_alive_ws_task]

                try:
                    logger.info("Starting task gathering...")
                    await asyncio.gather(*all_tasks)
                    logger.info("All tasks completed normally")
                except asyncio.CancelledError:
                    logger.info("Tasks cancelled - cleaning up")
                    for t in all_tasks:
                        t.cancel()
                    raise
                except (WebSocketDisconnect, ConnectionClosed, ConnectionClosedOK) as e:
                    logger.info(f"Connection closed during task execution: {type(e).__name__}")
                    for t in all_tasks:
                        t.cancel()
                    raise
                except Exception as e:
                    logger.error(f"Unexpected error in task gathering: {e}")
                    for t in all_tasks:
                        t.cancel()
                    raise
        except (WebSocketDisconnect, ConnectionClosed, ConnectionClosedOK):
            # Connection closed - cleanup will happen in finally block
            raise
        except Exception as e:
            logger.error(f"Connection error: {e}")
            # Only try to send error if websocket is still open
            try:
                await ws.send_json({"type": "error", "message": f"Connection failed: {e}"})
            except:
                pass  # Websocket already closed
            # Note: cleanup will happen in finally block
            
    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except ConnectionClosedOK:
        logger.info("WebSocket connection closed normally")
    except ConnectionClosed as e:
        if e.code == 1000:
            logger.info("WebSocket connection closed normally")
        elif e.code in [1001, 1006]:
            logger.info(f"WebSocket connection closed: {e.reason or 'Client disconnected'}")
        else:
            logger.warning(f"WebSocket connection closed with code {e.code}: {e.reason}")
    except Exception as e:
        if "The operation was cancelled" in str(e) and "1000 (OK)" in str(e):
            logger.info("WebSocket operation cancelled normally")
        else:
            logger.error(f"Error: {e}")
            try:
                await ws.send_json({"type": "error", "message": str(e)})
            except:
                pass
    finally:
        # Cleanup session - this always executes regardless of how the connection ended
        if session_state.get("session_id"):
            logger.info(f"Cleaning up session {session_state['session_id']}")
            try:
                await playwright_service.destroy_session(session_state["session_id"])
            except Exception as cleanup_error:
                # Session might already be destroyed - that's fine
                logger.debug(f"Cleanup note: {cleanup_error}")

async def forward_browser(sess, ws):
    """Forward messages from browser to Gemini"""
    try:
        while True:
            msg = await ws.receive()
            
            if msg["type"] == "websocket.disconnect":
                code = msg.get("code", "?")
                logger.info(f"Client disconnected in forward_browser (close code: {code})")
                raise WebSocketDisconnect()
                
            if "bytes" in msg:
                # Binary audio data
                audio_bytes = msg["bytes"]
                if len(audio_bytes) > 0:
                    logger.info(f"Received audio data: {len(audio_bytes)} bytes")
                    audio_blob = Blob(data=audio_bytes, mime_type="audio/pcm;rate=16000")
                    await sess.send_realtime_input(audio=audio_blob)
                
            elif "text" in msg:
                # JSON message
                try:
                    msg_json = json.loads(msg["text"])
                    
                    if msg_json.get('type') == 'heartbeat':
                        logger.info("Received heartbeat from client")

                    elif msg_json.get('type') == 'text':
                        # Text input
                        await sess.send_realtime_input(text=msg_json['text'])

                    elif msg_json.get('type') == 'video':
                        # Video frame (base64 encoded)
                        try:
                            video_data = base64.b64decode(msg_json['data'])
                            video_blob = Blob(data=video_data, mime_type=msg_json.get('mimeType', 'image/jpeg'))
                            logger.info(f"Sending video frame: {len(video_data)} bytes")
                            await sess.send_realtime_input(video=video_blob)
                        except Exception as e:
                            logger.error(f"Video processing error: {e}")
                        
                except json.JSONDecodeError:
                    logger.error(f"Invalid JSON: {msg['text']}")
                    
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected in forward_browser - re-raising")
        raise  # Re-raise to trigger main handler
    except ConnectionClosedOK:
        logger.info("WebSocket connection closed normally in forward_browser - re-raising")
        raise  # Re-raise to trigger main handler
    except ConnectionClosed as e:
        if e.code == 1000:
            logger.info("WebSocket connection closed normally in forward_browser - re-raising")
        elif e.code in [1001, 1006]:
            logger.info(f"WebSocket connection closed in forward_browser: {e.reason or 'Client disconnected'} - re-raising")
        else:
            logger.warning(f"WebSocket connection closed with code {e.code}: {e.reason} - re-raising")
        raise  # Re-raise to trigger main handler
    except Exception as e:
        if "The operation was cancelled" in str(e) and "1000 (OK)" in str(e):
            logger.info("WebSocket operation cancelled normally in forward_browser")
        else:
            logger.error(f"Forward browser error: {e}")
        raise  # Re-raise to trigger main handler

async def keep_alive_ws(ws):
    """Send periodic pings to the client WebSocket to prevent proxy idle-timeout."""
    try:
        while True:
            await asyncio.sleep(15)
            await ws.send_json({"type": "ping"})
            logger.debug("Sent WebSocket keep-alive ping")
    except (WebSocketDisconnect, ConnectionClosed, ConnectionClosedOK):
        raise
    except asyncio.CancelledError:
        raise
    except Exception as e:
        logger.error(f"WebSocket keep-alive error: {e}")
        raise


async def keep_alive(sess):
    """Send periodic keep-alive messages to maintain session"""
    try:
        while True:
            await asyncio.sleep(30)
            silence = b'\x00' * 160
            audio_blob = Blob(data=silence, mime_type="audio/pcm;rate=16000")
            await sess.send_realtime_input(audio=audio_blob)
            logger.debug("Sent keep-alive audio")
    except ConnectionClosedOK:
        logger.debug("Keep-alive stopped - connection closed normally - re-raising")
        raise  # Re-raise to trigger main handler
    except ConnectionClosed as e:
        if e.code == 1000:
            logger.debug("Keep-alive stopped - connection closed normally - re-raising")
        else:
            logger.debug(f"Keep-alive stopped - connection closed with code {e.code} - re-raising")
        raise  # Re-raise to trigger main handler
    except asyncio.CancelledError:
        logger.debug("Keep-alive task cancelled")
        raise  # This is expected when other tasks fail
    except Exception as e:
        if "The operation was cancelled" in str(e) and "1000 (OK)" in str(e):
            logger.debug("Keep-alive cancelled normally")
        else:
            logger.error(f"Keep-alive error: {e}")
        raise  # Re-raise to trigger main handler

async def forward_model(sess, ws, session_state, output_mode="audio"):
    """Forward responses from Gemini to browser, handling tool calls.
    
    Args:
        sess: Gemini session
        ws: WebSocket connection
        session_state: Mutable dict to track browser session_id for cleanup
        output_mode: 'audio' or 'text' - controls if audio data is forwarded
    """
    try:
        logger.info("Starting to receive from model")
        response_count = 0
        turn_count = 0
        
        # Buffer for accumulating text chunks
        text_buffer = ""
        
        while True:
            try:
                async for rsp in sess.receive():
                    response_count += 1
                    logger.debug(f"Received response #{response_count}")
                    
                    # Handle text responses - BUFFER instead of sending immediately
                    if rsp.text is not None:
                        logger.info(f"Text chunk: {rsp.text}")
                        text_buffer += rsp.text
                    
                    # Handle audio data - only forward in audio mode (talk mode)
                    if rsp.data is not None:
                        if output_mode == "audio":
                            logger.debug(f"Audio: {len(rsp.data)} bytes")
                            await ws.send_bytes(rsp.data)
                        # In text mode, drop audio data silently
                    
                    # Handle tool calls
                    if hasattr(rsp, 'tool_call') and rsp.tool_call:
                        tool_call = rsp.tool_call
                        logger.info(f"Tool call received: {tool_call}")
                        
                        # Process each function call
                        for fc in tool_call.function_calls:
                            function_name = fc.name
                            function_args = dict(fc.args) if fc.args else {}
                            
                            logger.info(f"Executing function: {function_name} with args: {function_args}")
                            
                            # Execute the tool
                            result = await  handle_tool_call(session_state["session_id"], function_name, function_args)
                            
                            logger.info(f"Tool result: {result}")
                            
                            # Send result back to Gemini
                            await sess.send_tool_response(
                                function_responses=[{
                                    "id": fc.id,
                                    "name": function_name,
                                    "response": result
                                }]
                            )
                            
                            # Also notify the client about tool execution
                            await ws.send_json({
                                "type": "toolResult",
                                "function": function_name,
                                "result": result
                            })
                    
                    # Handle server content
                    if hasattr(rsp, 'server_content') and rsp.server_content:
                        server_content = rsp.server_content
                        
                        # Input transcription
                        if hasattr(server_content, 'input_transcription') and server_content.input_transcription:
                            logger.debug(f"Input: {server_content.input_transcription.text}")
                            await ws.send_json({
                                "type": "inputTranscription",
                                "text": server_content.input_transcription.text
                            })
                        
                        # Output transcription - Buffer it, DON'T send partial to frontend
                        # We buffer the text and send complete message on generation_complete
                        if hasattr(server_content, 'output_transcription') and server_content.output_transcription:
                            transcription_text = server_content.output_transcription.text
                            if transcription_text:
                                logger.debug(f"Output transcription: {transcription_text}")
                                # Add to buffer (this is important for audio mode!)
                                text_buffer += transcription_text
                        
                        # Generation completed - just log, don't send text here (we send on turn_complete)
                        if hasattr(server_content, 'generation_complete') and server_content.generation_complete:
                            logger.info("Generation complete")
                            # Don't send text here - wait for turn_complete to avoid duplicates
                            await ws.send_json({
                                "type": "generationComplete"
                            })
                        
                        # Interruption detected
                        if hasattr(server_content, 'interrupted') and server_content.interrupted:
                            logger.info("Interrupted")
                            # Clear buffer on interruption
                            text_buffer = ""
                            await ws.send_json({
                                "type": "interrupted"
                            })
                        
                        # Turn completed - SEND BUFFERED TEXT NOW
                        if hasattr(server_content, 'turn_complete') and server_content.turn_complete:
                            turn_count += 1
                            logger.info(f"Turn #{turn_count} complete")
                            
                            # Send the complete buffered text as one message
                            if text_buffer.strip():
                                logger.info(f"Sending complete text: {text_buffer}")
                                await ws.send_json({
                                    "type": "text",
                                    "content": text_buffer.strip()
                                })
                                text_buffer = ""  # Clear buffer
                            
                            await ws.send_json({
                                "type": "turnComplete"
                            })
                
                logger.info(f"Session receive loop ended after {response_count} responses, continuing...")
                await asyncio.sleep(0.1)
                
            except StopAsyncIteration:
                logger.info("StopAsyncIteration - continuing to listen for next turn")
                await asyncio.sleep(0.1)
            except ConnectionClosedOK:
                logger.info("WebSocket connection closed normally")
                break
            except ConnectionClosed as e:
                if e.code == 1000:
                    logger.info("WebSocket connection closed normally")
                elif e.code in [1001, 1006]:
                    logger.info(f"WebSocket connection closed: {e.reason or 'Client disconnected'}")
                else:
                    logger.warning(f"WebSocket connection closed with code {e.code}: {e.reason}")
                break
            except Exception as e:
                if "The operation was cancelled" in str(e) and "1000 (OK)" in str(e):
                    logger.info("WebSocket operation cancelled normally")
                    break
                else:
                    logger.error(f"Error in receive loop: {e}")
                    await asyncio.sleep(0.5)
                    
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected in forward_model - re-raising")
        raise  # Re-raise to trigger main handler
    except asyncio.CancelledError:
        logger.info("forward_model task cancelled")
        raise
    except Exception as e:
        logger.error(f"Forward model error: {e} - re-raising", exc_info=True)
        raise  # Re-raise to trigger main handler




if __name__ == "__main__":
    import uvicorn
    # Use PORT environment variable for Cloud Run compatibility, fallback to config
    port = int(os.getenv("PORT", config.BACKEND_PORT))
    host = config.BACKEND_HOST
    logger.info(f"Starting server on {host}:{port}")
    uvicorn.run(app, host=host, port=port)
    # asyncio.run(test_playwright_service())
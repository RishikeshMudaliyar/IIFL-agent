/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { EventEmitter } from "eventemitter3";
import { LiveClientOptions, StreamingLog } from "../types";


// Custom types for backend communication (no longer using GenAI SDK types)
export interface Part {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export interface Content {
  parts: Part[];
}

export interface LiveServerContent {
  modelTurn?: Content;
  interrupted?: boolean;
  turnComplete?: boolean;
}

export interface LiveServerToolCall {
  functionCalls?: Array<{
    id: string;
    name: string;
    args: any;
  }>;
}

export interface LiveServerToolCallCancellation {
  ids: string[];
}

export interface LiveClientToolResponse {
  functionResponses?: Array<{
    id: string;
    name: string;
    response: any;
  }>;
}

export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

// Type enum for function parameter types
export enum Type {
  STRING = "string",
  NUMBER = "number",
  INTEGER = "integer",
  BOOLEAN = "boolean",
  ARRAY = "array",
  OBJECT = "object"
}

// Backend configuration is handled internally by the backend - no config sent from frontend

// Frontend configuration interface - simplified for backend use
export interface LiveConnectConfig {
  // Response settings
  responseModalities?: ("AUDIO" | "TEXT")[];

  // Voice and speech settings
  speechConfig?: {
    voiceConfig?: {
      prebuiltVoiceConfig?: {
        voiceName: string;
      };
    };
  };

  // Input settings
  realtimeInputConfig?: {
    automaticActivityDetection?: {
      disabled?: boolean;
    };
    activityHandling?: "START_OF_ACTIVITY_INTERRUPTS" | "NO_INTERRUPTION";
  };

  // System instructions are handled by the backend via read_system_prompt()
  // No need to send them from frontend

  // Transcription settings
  inputAudioTranscription?: {};
  outputAudioTranscription?: {};

  // Video settings
  mediaResolution?: "MEDIA_RESOLUTION_MEDIUM" | "MEDIA_RESOLUTION_HIGH";

  // Tools and system instructions for settings dialog compatibility
  // These are not sent to the backend but kept for frontend UI
  tools?: Array<{
    googleSearch?: {};
    functionDeclarations?: FunctionDeclaration[];
  }>;

  // System instruction for settings dialog compatibility
  // Not sent to backend (handled by backend's system_prompt.txt)
  systemInstruction?: string | {
    parts: Array<{ text: string }>;
  } | Array<{ text: string }> | Array<string>;
}

/**
 * Event types that can be emitted by the MultimodalLiveClient.
 * Each event corresponds to a specific message from GenAI or client state change.
 */
export interface LiveClientEventTypes {
  // Emitted when audio data is received
  audio: (data: ArrayBuffer) => void;
  // Emitted when the connection closes
  close: (event: CloseEvent) => void;
  // Emitted when content is received from the server
  content: (data: LiveServerContent) => void;
  // Emitted when an error occurs
  error: (error: ErrorEvent) => void;
  // Emitted when the server interrupts the current generation
  interrupted: () => void;
  // Emitted for logging events
  log: (log: StreamingLog) => void;
  // Emitted when the connection opens
  open: () => void;
  // Emitted when the initial setup is complete
  setupcomplete: () => void;
  // Emitted when a tool call is received
  toolcall: (toolCall: LiveServerToolCall) => void;
  // Emitted when a tool call is cancelled
  toolcallcancellation: (
    toolcallCancellation: LiveServerToolCallCancellation
  ) => void;
  // Emitted when the current turn is complete
  turncomplete: () => void;
  // Emitted when input transcription is received
  inputTranscription: (text: string) => void;
  // Emitted when output transcription is received
  outputTranscription: (text: string) => void;
}

// Backend message types
interface BackendMessage {
  type: string;
  content?: string;
  text?: string;
  isPartial?: boolean;
  model?: string;
  voice?: string;
  features?: any;
  modelSwitched?: any;
}

/**
 * A event-emitting class that manages the connection to the FastAPI WebSocket backend
 * and emits events to the rest of the application.
 * Maintains the same interface as the original GenAILiveClient for compatibility.
 */
export class GenAILiveClient extends EventEmitter<LiveClientEventTypes> {
  private _status: "connected" | "disconnected" | "connecting" = "disconnected";
  public get status() {
    return this._status;
  }

  private _websocket: WebSocket | null = null;
  private _heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  public get session() {
    // Return a mock session object for compatibility
    return this._websocket ? {} : null;
  }

  private _model: string | null = null;
  public get model() {
    return this._model;
  }

  protected config: LiveConnectConfig | null = null;
  protected backendUrl: string;

  public getConfig() {
    return { ...this.config };
  }

  constructor(options: LiveClientOptions) {
    super();
    // Use backend URL from options, environment, or default to localhost
    this.backendUrl = options.backendUrl || import.meta.env.VITE_BACKEND_WS_URL || "ws://localhost:8000/ws";
    this.send = this.send.bind(this);
    this.onopen = this.onopen.bind(this);
    this.onerror = this.onerror.bind(this);
    this.onclose = this.onclose.bind(this);
    this.onmessage = this.onmessage.bind(this);
  }

  /**
   * Get the current backend configuration
   */
  async getBackendConfig(): Promise<any> {
    const httpUrl = this.backendUrl.replace('ws://', 'http://').replace('wss://', 'https://');
    const baseUrl = httpUrl.replace('/ws', '');
    try {
      const response = await fetch(`${baseUrl}/api/config`);
      return await response.json();
    } catch (error) {
      console.error("Failed to fetch backend config:", error);
      return null;
    }
  }

  protected log(type: string, message: StreamingLog["message"]) {
    const log: StreamingLog = {
      date: new Date(),
      type,
      message,
    };
    this.emit("log", log);
  }

  // Configuration mapping removed - backend handles all configuration internally

  async connect(model: string, config: LiveConnectConfig, mode: 'chat' | 'talk' = 'talk'): Promise<boolean> {
    if (this._status === "connected" || this._status === "connecting") {
      return false;
    }

    this._status = "connecting";
    // Store config and model for compatibility, but backend ignores them
    this.config = config;
    this._model = model;

    try {
      // Append mode as query parameter to WebSocket URL
      const wsUrl = new URL(this.backendUrl);
      wsUrl.searchParams.set('mode', mode);
      this._websocket = new WebSocket(wsUrl.toString());

      // Set binary type to handle audio data properly
      this._websocket.binaryType = "arraybuffer";

      this._websocket.onopen = this.onopen;
      this._websocket.onerror = this.onerror;
      this._websocket.onclose = this.onclose;
      this._websocket.onmessage = this.onmessage;

      // Wait for connection to open
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Connection timeout"));
        }, 10000);

        if (this._websocket) {
          this._websocket.onopen = (_e) => {
            clearTimeout(timeout);
            this.onopen();
            resolve();
          };
          this._websocket.onerror = (_e) => {
            clearTimeout(timeout);
            reject(new Error("WebSocket connection failed"));
          };
        }
      });

      // Backend handles all configuration internally - no config needed from frontend

      this._status = "connected";

      // Send a heartbeat every 10s so the Railway proxy never sees an idle
      // client→server connection (proxy only tracks one direction).
      this._heartbeatInterval = setInterval(() => {
        if (this._websocket?.readyState === WebSocket.OPEN) {
          this._websocket.send(JSON.stringify({ type: "heartbeat" }));
        }
      }, 10000);

      return true;
    } catch (e) {
      console.error("Error connecting to backend:", e);
      this._status = "disconnected";
      this._websocket = null;
      return false;
    }
  }

  public disconnect() {
    if (this._heartbeatInterval !== null) {
      clearInterval(this._heartbeatInterval);
      this._heartbeatInterval = null;
    }
    if (!this._websocket) {
      return false;
    }
    this._websocket.close();
    this._websocket = null;
    this._status = "disconnected";

    this.log("client.close", `Disconnected`);
    return true;
  }

  protected onopen() {
    this.log("client.open", "Connected");
    this.emit("open");
  }

  protected onerror(_e: Event) {
    const errorEvent = new ErrorEvent("WebSocket Error", {
      message: "WebSocket connection error"
    });
    this.log("server.error", errorEvent.message);
    this.emit("error", errorEvent);
  }

  protected onclose(e: CloseEvent) {
    this.log(
      `server.close`,
      `disconnected ${e.reason ? `with reason: ${e.reason}` : ``}`
    );
    this.emit("close", e);
    this._status = "disconnected";
  }

  protected onmessage(event: MessageEvent) {
    try {
      // Handle binary data (audio) - can be ArrayBuffer or Blob
      if (event.data instanceof ArrayBuffer) {
        this.emit("audio", event.data);
        this.log(`server.audio`, `ArrayBuffer (${event.data.byteLength} bytes)`);
        return;
      }

      if (event.data instanceof Blob) {
        // Convert Blob to ArrayBuffer
        event.data.arrayBuffer().then((arrayBuffer: ArrayBuffer) => {
          this.emit("audio", arrayBuffer);
          this.log(`server.audio`, `Blob->ArrayBuffer (${arrayBuffer.byteLength} bytes)`);
        });
        return;
      }

      // Handle text messages
      const message: BackendMessage = JSON.parse(event.data);

      switch (message.type) {
        case "connected":
          this.log("server.send", "setupComplete");
          this.emit("setupcomplete");
          break;

        case "text":
          if (message.content) {
            const content: LiveServerContent = {
              modelTurn: {
                parts: [{ text: message.content }]
              }
            };
            this.emit("content", content);
            this.log(`server.content`, `text: ${message.content}`);
          }
          break;

        case "inputTranscription":
          // Emit input transcription event
          if (message.text) {
            this.emit("inputTranscription", message.text);
            this.log("server.inputTranscription", message.text);
          }
          break;

        case "outputTranscription":
          // Emit output transcription event
          if (message.text) {
            this.emit("outputTranscription", message.text);
            this.log("server.outputTranscription", message.text);
          }
          break;

        case "interrupted":
          this.log("server.content", "interrupted");
          this.emit("interrupted");
          break;

        case "turnComplete":
          this.log("server.content", "turnComplete");
          this.emit("turncomplete");
          break;

        case "generationComplete":
          this.log("server.content", "generationComplete");
          break;

        case "error":
          const errorEvent = new ErrorEvent("Backend Error", {
            message: message.content || "Unknown error"
          });
          this.log("server.error", errorEvent.message);
          this.emit("error", errorEvent);
          break;

        default:
          console.log("received unmatched message", message);
      }
    } catch (error) {
      console.error("Error parsing message:", error);
    }
  }

  /**
   * send realtimeInput, this is base64 chunks of "audio/pcm" and/or "image/jpg"
   */
  sendRealtimeInput(chunks: Array<{ mimeType: string; data: string }>) {
    if (!this._websocket) return;

    let hasAudio = false;
    let hasVideo = false;

    for (const ch of chunks) {
      if (ch.mimeType.includes("audio")) {
        // Send audio data as binary
        const audioData = atob(ch.data);
        const uint8Array = new Uint8Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          uint8Array[i] = audioData.charCodeAt(i);
        }
        this._websocket.send(uint8Array.buffer);
        hasAudio = true;
      } else if (ch.mimeType.includes("image")) {
        // Send video frame as JSON
        this._websocket.send(JSON.stringify({
          type: "video",
          data: ch.data,
          mimeType: ch.mimeType
        }));
        hasVideo = true;
      }
    }

    const message =
      hasAudio && hasVideo
        ? "audio + video"
        : hasAudio
          ? "audio"
          : hasVideo
            ? "video"
            : "unknown";
    this.log(`client.realtimeInput`, message);
  }

  /**
   *  send a response to a function call and provide the id of the functions you are responding to
   */
  sendToolResponse(toolResponse: LiveClientToolResponse) {
    if (!this._websocket) return;

    if (
      toolResponse.functionResponses &&
      toolResponse.functionResponses.length
    ) {
      // Send tool response to backend
      this._websocket.send(JSON.stringify({
        type: "toolResponse",
        functionResponses: toolResponse.functionResponses
      }));
      this.log(`client.toolResponse`, toolResponse);
    }
  }

  /**
   * send normal content parts such as { text }
   */
  send(parts: Part | Part[], turnComplete: boolean = true) {
    if (!this._websocket) return;

    const partsArray = Array.isArray(parts) ? parts : [parts];

    for (const part of partsArray) {
      if (part.text) {
        this._websocket.send(JSON.stringify({
          type: "text",
          text: part.text
        }));
      }
    }

    this.log(`client.send`, {
      turns: partsArray,
      turnComplete,
    });
  }
}

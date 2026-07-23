export interface LiveClientOptions {
  backendUrl?: string;
}

/** Part interface for content */
export interface Part {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

/** Tool response interface */
export interface LiveClientToolResponse {
  functionResponses?: Array<{
    id: string;
    name: string;
    response: any;
  }>;
}

/** Client content log for debugging */
export interface ClientContentLog {
  turns: Part[];
  turnComplete: boolean;
}

/** Log types for debugging and monitoring */
export type StreamingLog = {
  date: Date;
  type: string;
  count?: number;
  message:
    | string
    | ClientContentLog
    | LiveClientToolResponse
    | any; // Allow any for backend-specific messages
};

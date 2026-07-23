/// &lt;reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_GEMINI_API_KEY: string
    readonly VITE_BACKEND_WS_URL: string
    readonly VITE_BACKEND_URL?: string
    readonly VITE_NURIX_CHAT_HOST?: string
    readonly VITE_NURIX_CHAT_ACCOUNT_ID?: string
    readonly VITE_NURIX_CHAT_API_KEY?: string
    readonly VITE_NURIX_CHAT_AGENT_ID?: string
    readonly VITE_NURIX_VOICE_API_BASE?: string
    readonly VITE_NURIX_VOICE_CHANNEL_CONNECTION_ID?: string
    readonly VITE_NURIX_VOICE_API_KEY?: string
    readonly VITE_NURIX_VOICE_GATEWAY_API_KEY?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_BACKEND_WS_URL=wss://iifl-backend-production.up.railway.app/ws
ENV VITE_BACKEND_WS_URL=$VITE_BACKEND_WS_URL
ARG VITE_BACKEND_URL=https://iifl-backend-production.up.railway.app
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
# Nurix agent wiring — chat channel (cc 255) + voice channel (cc 256 -> Ira).
# Real values injected as Railway build vars (never committed). Vite inlines
# these at build time, so they MUST be present during `npm run build`.
ARG VITE_NURIX_CHAT_ACCOUNT_ID
ENV VITE_NURIX_CHAT_ACCOUNT_ID=$VITE_NURIX_CHAT_ACCOUNT_ID
ARG VITE_NURIX_CHAT_API_KEY
ENV VITE_NURIX_CHAT_API_KEY=$VITE_NURIX_CHAT_API_KEY
ARG VITE_NURIX_CHAT_AGENT_ID
ENV VITE_NURIX_CHAT_AGENT_ID=$VITE_NURIX_CHAT_AGENT_ID
ARG VITE_NURIX_VOICE_CHANNEL_CONNECTION_ID
ENV VITE_NURIX_VOICE_CHANNEL_CONNECTION_ID=$VITE_NURIX_VOICE_CHANNEL_CONNECTION_ID
ARG VITE_NURIX_VOICE_API_KEY
ENV VITE_NURIX_VOICE_API_KEY=$VITE_NURIX_VOICE_API_KEY
ARG VITE_NURIX_VOICE_GATEWAY_API_KEY
ENV VITE_NURIX_VOICE_GATEWAY_API_KEY=$VITE_NURIX_VOICE_GATEWAY_API_KEY
# Outbound PHONE call flow — agent dials the number in the form. Trigger +
# transcript live on agentx-prod (proxied via backend /agentx-proxy).
ARG VITE_NURIX_AGENTX_BASE=https://agentx-prod.nurixlabs.tech
ENV VITE_NURIX_AGENTX_BASE=$VITE_NURIX_AGENTX_BASE
ARG VITE_NURIX_WORKSPACE_ID
ENV VITE_NURIX_WORKSPACE_ID=$VITE_NURIX_WORKSPACE_ID
ARG VITE_NURIX_VOICE_AGENT_ID
ENV VITE_NURIX_VOICE_AGENT_ID=$VITE_NURIX_VOICE_AGENT_ID
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist ./dist
EXPOSE 8080
CMD ["/bin/sh", "-c", "serve -s dist -l $PORT"] 
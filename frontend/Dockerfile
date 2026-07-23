FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_BACKEND_WS_URL=wss://abcd-form-filling-agent-backend-243639129998.asia-south1.run.app/ws
ENV VITE_BACKEND_WS_URL=$VITE_BACKEND_WS_URL
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist ./dist
EXPOSE 8080
CMD ["/bin/sh", "-c", "serve -s dist -l $PORT"] 
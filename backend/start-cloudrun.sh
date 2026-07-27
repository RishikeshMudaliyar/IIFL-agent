#!/bin/bash
set -e

echo "=========================================="
echo "Starting Form-Filling AI Backend"
echo "=========================================="

# Start Xvfb (virtual framebuffer)
echo "[1/6] Starting Xvfb..."
Xvfb :99 -screen 0 1920x1080x24 &
XVFB_PID=$!

# Wait for Xvfb to be ready (max 15 seconds)
for i in {1..75}; do
    if xdpyinfo -display :99 >/dev/null 2>&1; then
        echo "Xvfb ready"
        break
    fi
    sleep 0.2
done

# Start window manager (suppress verbose config warnings)
echo "[2/6] Starting Fluxbox window manager..."
DISPLAY=:99 fluxbox >/dev/null 2>&1 &

# Start x11vnc (non-blocking, will be ready when VNC is accessed)
echo "[3/6] Starting x11vnc..."
x11vnc -display :99 -forever -shared -nopw -rfbport 5900 >/dev/null 2>&1 &

# Start noVNC/websockify (non-blocking)
# --heartbeat 10: sends a WebSocket ping every 10s. The container is healthy
# during form fills but there are 5-25s idle gaps between Playwright actions
# (LLM thinking, user typing) when zero bytes flow. Without a frequent-enough
# heartbeat, the Railway edge proxy idle-closes the VNC WebSocket and noVNC
# drops back to the connect screen ("Reconnecting…", progress appears lost).
# 30s was too slow — Railway's idle timeout fired first during a long gemma
# thinking gap. 10s stays well under any reasonable edge idle window.
echo "[4/6] Starting noVNC on internal port 6080..."
websockify --heartbeat 10 --web=/usr/share/novnc/ 6080 localhost:5900 >/dev/null 2>&1 &

# Configure Nginx early to listen on the correct PORT (Cloud Run requirement)
PORT=${PORT:-8080}
echo "[5/6] Configuring Nginx to listen on port $PORT..."
sed -i "s/listen 8080;/listen $PORT;/g" /etc/nginx/nginx.conf

# Start FastAPI on internal port 8000, with a watchdog that respawns uvicorn
# if it dies (e.g. Chromium OOM bringing down the whole Python process).
# Without this, the container stays "alive" via nginx but every /agent/* and
# /nurix-proxy/* request 502s because nothing answers on 127.0.0.1:8000.
echo "[6/6] Starting FastAPI (app.py) on internal port 8000 with watchdog..."
(
    fail_count=0
    while true; do
        start_ts=$(date +%s)
        echo "[watchdog] Launching uvicorn (consecutive fast-fails: $fail_count)"
        DISPLAY=:99 python -m uvicorn app:app --host 127.0.0.1 --port 8000 2>&1
        exit_code=$?
        end_ts=$(date +%s)
        runtime=$((end_ts - start_ts))
        echo "[watchdog] uvicorn exited code=$exit_code after ${runtime}s"
        if [ "$runtime" -lt 10 ]; then
            fail_count=$((fail_count + 1))
            if [ "$fail_count" -ge 5 ]; then
                echo "[watchdog] 5 consecutive fast failures — exiting so Railway can recycle the container"
                exit 1
            fi
        else
            fail_count=0
        fi
        sleep 2
    done
) &
FASTAPI_PID=$!

# Wait for FastAPI to be ready (max 10 seconds with proper health check)
echo "Waiting for FastAPI to be ready..."
for i in {1..50}; do
    if curl -f http://127.0.0.1:8000/health >/dev/null 2>&1; then
        echo "FastAPI ready"
        break
    fi
    sleep 0.2
done

# Verify FastAPI is still running
if ! kill -0 $FASTAPI_PID 2>/dev/null; then
    echo "ERROR: FastAPI failed to start!"
    echo "Check the logs above for Python errors"
    exit 1
fi

echo ""
echo "=========================================="
echo "All services started!"
echo ""
echo "Access URLs (replace with your Cloud Run URL):"
echo "  - WebSocket:    wss://YOUR_CLOUD_RUN_URL/ws"
echo "  - noVNC Viewer: https://YOUR_CLOUD_RUN_URL/vnc/vnc.html"
echo "  - API Config:   https://YOUR_CLOUD_RUN_URL/api/config"
echo "  - Health:       https://YOUR_CLOUD_RUN_URL/health"
echo "=========================================="

# Run nginx in foreground (keeps container alive)
exec nginx -g 'daemon off;'

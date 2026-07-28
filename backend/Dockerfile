# Cloud Run compatible Dockerfile with Playwright for Form-Filling AI
FROM python:3.12-slim

# Install system dependencies with retry logic for network issues
RUN apt-get update --fix-missing && \
    apt-get install -y --no-install-recommends \
    xvfb \
    x11vnc \
    x11-utils \
    novnc \
    websockify \
    nginx \
    curl \
    fonts-liberation \
    fonts-noto-color-emoji \
    fonts-unifont \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-tlwg-loma-otf \
    fonts-freefont-ttf \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libatspi2.0-0 \
    libgtk-3-0 \
    libgdk-pixbuf-2.0-0 \
    libx11-xcb1 \
    libxcb-dri3-0 \
    libxshmfence1 \
    libglu1-mesa \
    fluxbox \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright Chromium browser with dependencies
RUN playwright install chromium && playwright install-deps chromium

# Copy ALL application files
COPY app.py .
COPY config.py .
COPY playwright_service.py .
COPY database.py .
COPY loan_routes.py .
COPY agent_routes.py .
COPY proxy_routes.py .
COPY models.py .
COPY sms_service.py .
COPY email_service.py .
COPY system_prompt.txt .
COPY run-env.yaml .

# Copy dummy site for testing (optional)
COPY dummy_site/ ./dummy_site/

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy minimal Fluxbox config to suppress warnings
RUN mkdir -p /root/.fluxbox
COPY fluxbox-init /root/.fluxbox/init

# Copy startup script and fix Windows line endings (CRLF to LF)
COPY start-cloudrun.sh /start.sh
RUN sed -i 's/\r$//' /start.sh && chmod +x /start.sh

# Environment variables
ENV DISPLAY=:99
ENV PORT=8080

# Cloud Run uses PORT env variable (default 8080)
EXPOSE 8080

# Start all services
CMD ["/start.sh"]

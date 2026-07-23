# 🤖 AI Form-Filling Agent Backend

A production-ready FastAPI backend that combines **Google Gemini Live API** with **Playwright browser automation** to create an intelligent, voice-enabled form-filling assistant.

## ✨ Features

### 🎙️ Conversational AI
- **Real-time voice chat** with Gemini Live API
- **Multi-language support** (Hindi, Tamil, Telugu, and more)
- **Smart input handling** - auto-corrects misspellings, converts amounts/dates
- **Text fallback** for non-audio environments

### 🌐 Browser Automation
- **Automated form filling** using Playwright
- **Session-based browser control**
- **Real-time field validation**
- **OTP handling** and form submission

### 🧠 Intelligent Processing
- Converts "1 lakh" → 100000
- Converts "31 july 2003" → 2003-07-31
- Auto-corrects "Madhaya Pradesh" → "Madhya Pradesh"
- Validates PAN, phone, email formats

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Google Cloud Project (for Vertex AI) OR Gemini API Key
- Node.js (for Playwright)

### Installation

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd form-filling-agent-backend
```

2. **Install dependencies**
```bash
pip install -r requirements.txt
playwright install chromium
```

3. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. **Run the server**
```bash
python main.py
```

Server runs on `http://localhost:8000`

---

## ⚙️ Configuration

### Environment Variables (`.env`)

```env
# Authentication (choose one)
USE_VERTEX_AI=true
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1

# OR use API key
USE_VERTEX_AI=false
GEMINI_API_KEY=your-api-key

# Model & Voice
GEMINI_DEFAULT_MODEL=gemini-live-2.5-flash
GEMINI_DEFAULT_VOICE=Leda

# Form URL
FORM_URL=https://your-frontend.com/loan-form

# Features
DEFAULT_OUTPUT_MODE=audio  # or 'text'
DEFAULT_ENABLE_VAD=true
DEFAULT_INPUT_TRANSCRIPTION=true
```

---

## 📡 API Endpoints

### WebSocket: `/ws`
Main endpoint for real-time communication with Gemini.

**Send Messages:**
```javascript
// Text message
ws.send(JSON.stringify({ type: 'text', text: 'Hello' }));

// Audio (PCM, 16kHz, 16-bit, mono)
ws.send(pcmAudioBuffer);
```

**Receive Messages:**
```javascript
ws.onmessage = (event) => {
  if (event.data instanceof Blob) {
    // Audio response
  } else {
    const data = JSON.parse(event.data);
    // Handle: text, toolResult, turnComplete, etc.
  }
};
```

### REST: `/api/config`
Get current backend configuration.

```bash
curl http://localhost:8000/api/config
```

---

## 🛠️ Available Tools

Gemini can call these tools to automate form filling:

| Tool | Description | Parameters |
|------|-------------|------------|
| `start_browser` | Opens browser and navigates to form | None |
| `fill_field` | Fills a form field | `session_id`, `field_name`, `value` |
| `submit_form` | Clicks submit/OTP button | `session_id`, `button` |
| `close_session` | Closes browser session | `session_id` |

---

## 📋 Form Field Requirements

Your frontend form must have these field IDs/names:

| Field | ID/Name | Type |
|-------|---------|------|
| Full Name | `name` | text |
| PAN Number | `pan` | text |
| Date of Birth | `dob` | date |
| Phone | `phone` | text |
| Email | `email` | email |
| Marital Status | `marital_status` | select |
| Gender | `gender` | select |
| Occupation | `occupation` | select |
| Address | `address` | textarea |
| City | `city` | text |
| State | `state` | select |
| Pin Code | `pin_code` | text |
| Loan Purpose | `purpose` | select |
| Amount | `amount` | number |
| Tenure | `tenure` | select |
| OTP | `otp` | text |

---

## 🧪 Testing

### Text-based Testing
```bash
python test_client.py
```

### Audio Testing
Connect your frontend with microphone support to `ws://localhost:8000/ws`

---

## 🐳 Docker Deployment

### Build Image
```bash
docker build -t form-filling-backend .
```

### Run Container
```bash
docker run -p 8000:8000 \
  -e GOOGLE_CLOUD_PROJECT=your-project \
  -e FORM_URL=https://your-form.com \
  form-filling-backend
```

---

## ☁️ Google Cloud Run Deployment

### Using Artifact Registry

```bash
# 1. Set variables
export PROJECT_ID="your-gcp-project-id"
export REGION="us-central1"
export REPOSITORY_NAME="form-filling-backend"
export IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY_NAME}/backend:latest"

# 2. Set active project
gcloud config set project $PROJECT_ID

# 3. Create Artifact Registry repository (first time only)
gcloud artifacts repositories create $REPOSITORY_NAME \
  --repository-format=docker \
  --location=$REGION

# 4. Configure Docker authentication
gcloud auth configure-docker ${REGION}-docker.pkg.dev

# 5. Build and tag image
docker build --platform linux/amd64 -t $IMAGE_NAME .

# 6. Push to Artifact Registry
docker push $IMAGE_NAME

# 7. Deploy to Cloud Run
gcloud run deploy form-filling-backend \
  --image $IMAGE_NAME \
  --platform managed \
  --allow-unauthenticated \
  --region $REGION \
  --port 8000 \
  --memory 1Gi \
  --cpu 2 \
  --max-instances 10 \
  --set-env-vars GOOGLE_CLOUD_PROJECT=$PROJECT_ID,FORM_URL=https://your-form.com
```

---

## 📁 Project Structure

```
form-filling-agent-backend/
├── main.py                 # FastAPI server & WebSocket handler
├── config.py              # Configuration management
├── playwright_service.py  # Browser automation service
├── system_prompt.txt      # AI behavior instructions
├── test_client.py         # Testing utility
├── requirements.txt       # Python dependencies
├── .env.example          # Environment template
├── Dockerfile            # Container configuration
└── dummy_site/           # Test form (for development)
    └── index.html
```

---

## 🎯 System Prompt Features

The AI assistant (`system_prompt.txt`) is configured to:

- ✅ Validate all inputs before filling
- ✅ Auto-correct common misspellings
- ✅ Convert amounts: "5 lakh" → 500000
- ✅ Convert dates: "31 july 2003" → 2003-07-31
- ✅ Support multiple languages
- ✅ Provide helpful error messages
- ✅ Guide users step-by-step

---

## 🔧 Customization

### Change System Behavior
Edit `system_prompt.txt` to modify:
- Conversation flow
- Validation rules
- Error messages
- Language support

### Add New Form Fields
1. Update `FORM_AUTOMATION_TOOLS` in `main.py`
2. Add field mapping in `playwright_service.py`
3. Update system prompt with new field instructions

---

## 🐛 Troubleshooting

### Browser doesn't open
```bash
# Reinstall Playwright browsers
playwright install chromium
playwright install-deps
```

### WebSocket connection fails
- Check if server is running on correct port
- Verify CORS settings in `main.py`
- Check firewall/network settings

### Audio not working
- Ensure `DEFAULT_OUTPUT_MODE=audio` in `.env`
- Verify frontend sends PCM audio (16kHz, 16-bit)
- Check browser microphone permissions

---

## 📝 License

MIT License - feel free to use in your projects!

---

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

---

## 📞 Support

For issues and questions, please open a GitHub issue.

---

**Built with ❤️ using Google Gemini Live API and Playwright**
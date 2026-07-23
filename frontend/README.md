# Aditya Birla Capital Digital - AI-Powered Loan Journey (Demo)

**Project Objective:**
The objective of this engagement is to extend the existing conversational AI–assisted form filling demo to closely mirror Aditya Birla Capital Digital’s actual personal loan app journey, using UI mocks derived from real app screenshots instead of a generic dummy website.

The demo will showcase how an AI agent (text + voice) can:
- **Assist customers** through each step of Bank’s loan journey
- **Read and react** to on-screen UI states and errors
- **Fill customer details contextually** without replacing decision-making logic
- **Improve completion and clarity** while preserving the original app structure

*This remains a demo-grade, non-production prototype intended for stakeholder walkthroughs and sales discussions.*

## 🛠️ Tech Stack

- **Framework**: React 18 + Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Communication**: Native WebSockets

## 📦 Development

### Prerequisites

- Node.js 20+
- npm

### Setup

1. Install dependencies:
```bash
npm install
```

2. Configure backend URL (optional):
Create a `.env` file:
```env
VITE_WS_URL=ws://localhost:8000/ws
```

3. Start the development server:
```bash
npm run dev
```

The app will be available at [http://localhost:5173](http://localhost:5173).

### Build

Build the production bundle:
```bash
npm run build
```

## 🐳 Docker Deployment

### Build & Push to GCP Artifact Registry

```bash
# Build Docker image
docker build -t asia-south1-docker.pkg.dev/gcp-training-57193/nurix-artifacts-repository/abcd-form-filling-agent-frontend:latest .

# Push to Artifact Registry
docker push asia-south1-docker.pkg.dev/gcp-training-57193/nurix-artifacts-repository/abcd-form-filling-agent-frontend:latest
```

### Deploy to Cloud Run

```bash
gcloud run deploy abcd-form-filling-agent-frontend --image asia-south1-docker.pkg.dev/gcp-training-57193/nurix-artifacts-repository/abcd-form-filling-agent-frontend:latest --platform managed --region asia-south1 --allow-unauthenticated --port 8080 --memory 1Gi --max-instances 1 --cpu 1
```

## 🔗 Live Demo

**Frontend**: [https://abcd-form-filling-agent-frontend-243639129998.asia-south1.run.app]

**Backend**: [https://abcd-form-filling-agent-backend-243639129998.asia-south1.run.app]
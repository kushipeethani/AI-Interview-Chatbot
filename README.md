# AI Interview Assistant — Full Stack

## Stack
- **Frontend**: React + Vite
- **Backend**: Python + FastAPI
- **AI**: Groq (llama-3.3-70b-versatile)

## Project Structure
```
ai-interview-app/
├── backend/
│   ├── main.py          ← FastAPI server
│   ├── requirements.txt ← Python dependencies
│   └── .env             ← Your Groq API key
└── frontend/
    ├── src/
    │   ├── App.jsx      ← React app
    │   └── main.jsx     ← Entry point
    ├── index.html
    ├── package.json
    └── vite.config.js
```

---

## Setup — Backend (Python)

### Step 1 — Open terminal and go to backend folder
```bash
cd backend
```

### Step 2 — Create a virtual environment
```bash
python -m venv venv
```

### Step 3 — Activate virtual environment
**Windows:**
```bash
venv\Scripts\activate
```
**Mac/Linux:**
```bash
source venv/bin/activate
```

### Step 4 — Install dependencies
```bash
pip install -r requirements.txt
```

### Step 5 — Add your Groq API key
Open `.env` and replace the placeholder:
```
GROQ_API_KEY=gsk_YourActualKeyHere
```

### Step 6 — Start the backend server
```bash
uvicorn main:app --reload
```

Backend runs at: http://localhost:8000
API docs at: http://localhost:8000/docs

---

## Setup — Frontend (React)

### Step 1 — Open a NEW terminal and go to frontend folder
```bash
cd frontend
```

### Step 2 — Install dependencies
```bash
npm install
```

### Step 3 — Start the frontend
```bash
npm run dev
```

Frontend runs at: http://localhost:5173

---

## Running Both Together

You need TWO terminal windows open at the same time:

| Terminal 1 (Backend) | Terminal 2 (Frontend) |
|---|---|
| `cd backend` | `cd frontend` |
| `venv\Scripts\activate` | `npm install` |
| `uvicorn main:app --reload` | `npm run dev` |

Then open http://localhost:5173 in Chrome.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Health check |
| GET | `/health` | Server status |
| GET | `/rag-kb` | Get knowledge base |
| POST | `/generate-questions` | Generate interview questions |
| POST | `/evaluate-answer` | Score answer with 5 metrics |
| POST | `/generate-report` | Full recruiter report |
| POST | `/analyze-code` | AI code review |
| POST | `/run-code` | Simulate code execution |
| POST | `/rag-search` | Semantic question search |
| POST | `/ask-recruiter` | HR AI assistant |

---

## Features
- Voice interview with speech-to-text
- Weighted evaluation (5 metrics)
- Anti-cheat proctoring (webcam + tab detection)
- RAG knowledge base with semantic search
- Coding interview with AI analysis
- Recruiter dashboard

---

## Deploy on Render

This repo now includes a root `render.yaml` blueprint for:
- `ai-interview-backend` as a Python web service
- `ai-interview-frontend` as a Render static site (`type: web`, `runtime: static`)

### Before deploy

Set these backend environment variables in Render:
- `GROQ_API_KEY`
- `GMAIL_API_CLIENT_ID`
- `GMAIL_API_CLIENT_SECRET`
- `GMAIL_API_REFRESH_TOKEN`
- `GMAIL_API_FROM_EMAIL`
- `GMAIL_API_FROM_NAME`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL`
- `SMTP_FROM_NAME`
- `SMTP_USE_TLS`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_FROM_NAME`
- `RESEND_API_URL`
- `ALLOW_INSECURE_OTP_RESPONSE`

OTP email uses Gmail API first when Gmail API variables are configured. That works on Render Free because it uses HTTPS instead of blocked SMTP ports. If Gmail API is not configured, it falls back to SMTP, then Resend over HTTPS. In Render, open the backend service, go to **Environment**, add or update the variables above, then redeploy the service. If no email provider is configured, OTP requests will return: `OTP email delivery is not configured on the server`.

For a no-card Render Free setup with your Gmail account, enable the Gmail API in Google Cloud, create OAuth credentials, authorize the `https://www.googleapis.com/auth/gmail.send` scope once, and set:
```env
GMAIL_API_CLIENT_ID=your_google_oauth_client_id
GMAIL_API_CLIENT_SECRET=your_google_oauth_client_secret
GMAIL_API_REFRESH_TOKEN=your_google_oauth_refresh_token
GMAIL_API_FROM_EMAIL=yourgmail@gmail.com
GMAIL_API_FROM_NAME=AI Interview
```

For a free Gmail SMTP demo, enable 2-Step Verification on the Gmail account, create a Gmail App Password, then set:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=yourgmail@gmail.com
SMTP_PASSWORD=your_gmail_app_password
SMTP_FROM_EMAIL=yourgmail@gmail.com
SMTP_FROM_NAME=AI Interview
SMTP_USE_TLS=true
```

For a quick Resend test, you can use `RESEND_FROM_EMAIL=onboarding@resend.dev`. For real users, verify a domain in Resend and use an address from that domain.

You can also apply the backend `.env` values with Render's API:
```powershell
$env:RENDER_API_KEY="your_render_api_key"
.\scripts\set-render-email-env.ps1
```

Set this frontend environment variable in Render:
- `VITE_API_BASE_URL`

Use your backend Render URL as the value, for example:
```bash
VITE_API_BASE_URL=https://your-backend-name.onrender.com
```

### Deploy steps

1. Push this repository to GitHub.
2. In Render, choose `New +` → `Blueprint`.
3. Connect the GitHub repository.
4. Render will detect `render.yaml` and create both services.
5. Add the required environment variables before the first production use.
6. Open the frontend Render URL after both services finish deploying.

## Deploy Backend on Koyeb

Use Koyeb for the backend if you want Gmail SMTP on a free service. Koyeb blocks port `25`, but their docs say to use encrypted SMTP on port `587`.

1. Go to https://app.koyeb.com and create a **Web Service**.
2. Select **GitHub** and choose this repository.
3. Set the branch to `main`.
4. Set the project/root directory to `backend`.
5. Choose **Buildpack**.
6. If Koyeb asks for a run command, use:
```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```
7. Add backend environment variables:
```env
GROQ_API_KEY=your_groq_api_key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=yourgmail@gmail.com
SMTP_PASSWORD=your_gmail_app_password
SMTP_FROM_EMAIL=yourgmail@gmail.com
SMTP_FROM_NAME=AI Interview
SMTP_USE_TLS=true
ALLOW_INSECURE_OTP_RESPONSE=false
```
8. Deploy and copy the generated `.koyeb.app` backend URL.
9. In the frontend host, set:
```env
VITE_API_BASE_URL=https://your-koyeb-backend-url.koyeb.app
```
10. Redeploy the frontend.

### Local env files

Templates are included here:
- `backend/.env.example`
- `frontend/.env.example`

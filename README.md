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
- `ai-interview-frontend` as a static site

### Before deploy

Set these backend environment variables in Render:
- `GROQ_API_KEY`
- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=587`
- `SMTP_USER=<your Gmail address>`
- `SMTP_PASSWORD=<your Gmail app password>`
- `SMTP_FROM_EMAIL=<the same Gmail address>`
- `SMTP_FROM_NAME`
- `SMTP_USE_TLS`
- `SMTP_USE_SSL`
- `ALLOW_INSECURE_OTP_RESPONSE`

For Gmail SMTP, `SMTP_PASSWORD` must be a Google app password, not the normal account password. In Render, open the backend service, go to **Environment**, add or update the variables above, then redeploy the service. If `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, or `SMTP_FROM_EMAIL` are missing, OTP requests will return: `OTP email delivery is not configured on the server`.

You can also apply the backend `.env` values with Render's API:
```powershell
$env:RENDER_API_KEY="your_render_api_key"
.\scripts\set-render-smtp-env.ps1
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

### Local env files

Templates are included here:
- `backend/.env.example`
- `frontend/.env.example`

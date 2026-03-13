# 🤖 AI Interview Bot - Render Deployment Guide

## 📁 Project Files
```
AI Chatbot/
├── app.py              ← Flask backend
├── requirements.txt    ← Python packages
├── render.yaml         ← Render config
├── Procfile            ← How to start app
├── README.md           ← This file
└── templates/
    └── index.html      ← Frontend
```

---

## 🚀 Deploy to Render.com (Free, Step by Step)

### Step 1 — Create GitHub Account & Repo
1. Go to https://github.com → Sign up free
2. Click green **New** button
3. Name it: `ai-interview-bot`
4. Select **Public**
5. Click **Create repository**

### Step 2 — Upload your files to GitHub
1. In your new repo click **uploading an existing file**
2. Drag and drop ALL files:
   - app.py
   - requirements.txt
   - render.yaml
   - Procfile
3. Also upload the **templates** folder with index.html inside
4. Click **Commit changes**

### Step 3 — Create Render Account
1. Go to https://render.com
2. Click **Get Started for Free**
3. Sign up with GitHub (easiest!)

### Step 4 — Create Web Service on Render
1. Click **New +** → **Web Service**
2. Click **Connect** next to your `ai-interview-bot` repo
3. Fill in settings:
   - Name: `ai-interview-bot`
   - Region: pick closest to you
   - Branch: `main`
   - Runtime: `Python 3`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn app:app`
4. Select **Free** plan
5. Click **Create Web Service**

### Step 5 — Add API Key
1. Go to your service → **Environment** tab
2. Click **Add Environment Variable**
3. Enter:
   ```
   Key:   GROQ_API_KEY
   Value: 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
   ```
4. Click **Save Changes** → app will redeploy automatically

### Step 6 — Open your live app!
Your app will be live at:
```
https://ai-interview-bot.onrender.com
```
Share this link with anyone — works on mobile too! 📱

---

## ⚠️ Important Free Tier Notes
- App sleeps after 15 min inactivity → first visit takes ~30 sec to wake up
- SQLite database resets when Render restarts the app
- Recordings folder also resets on restart

---

## 💻 Run Locally
```powershell
$env:GROQ_API_KEY = "your-key"
python app.py
```
Open: http://127.0.0.1:5000

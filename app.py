# ================================================
# AI Interview Chatbot - Complete System
# Features:
#   - Login / Signup with SQLite database
#   - Groq AI questions per role (FREE FOREVER!)
#   - Voice questions (text-to-speech in browser)
#   - Video recording saved to server + database
#   - AI scoring and answer analysis
#   - All interviews saved to SQLite database
# ================================================
# HOW TO RUN:
#   1. pip install flask groq
#   2. $env:GROQ_API_KEY = "your-key-here"
#   3. python app.py
#   4. Open http://127.0.0.1:5000
# ================================================

from flask import Flask, request, jsonify, render_template, session, send_from_directory
from groq import Groq
import os
import json
import sqlite3
import hashlib
import datetime
import base64

app = Flask(__name__)
app.secret_key = "interview_bot_secret_123"

# ------------------------------------------------
# GROQ AI SETUP - Free Forever!
# Get key at: https://console.groq.com
# ------------------------------------------------
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
if not GROQ_API_KEY:
    print("=" * 55)
    print("  WARNING: GROQ_API_KEY not set!")
    print("  Run this first:")
    print('  $env:GROQ_API_KEY = "your-key-here"')
    print("  Get FREE key: https://console.groq.com")
    print("=" * 55)
else:
    print(f"  Groq API key loaded: {GROQ_API_KEY[:12]}...")

client = Groq(api_key=GROQ_API_KEY)

# ------------------------------------------------
# RECORDINGS FOLDER
# All interview videos saved here on the server
# ------------------------------------------------
RECORDINGS_FOLDER = "recordings"
os.makedirs(RECORDINGS_FOLDER, exist_ok=True)
print(f"  Recordings folder: {RECORDINGS_FOLDER}/")

# ------------------------------------------------
# DATABASE SETUP - SQLite
# ------------------------------------------------
DB_FILE = "interview.db"

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    # Users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT NOT NULL,
            email      TEXT UNIQUE NOT NULL,
            password   TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Interviews table - now includes recording_file column!
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS interviews (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id        INTEGER NOT NULL,
            job_role       TEXT NOT NULL,
            interview_type TEXT NOT NULL,
            total_score    INTEGER DEFAULT 0,
            recording_file TEXT,
            started_at     TEXT DEFAULT CURRENT_TIMESTAMP,
            completed_at   TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    # Add recording_file column if it doesn't exist (for existing databases)
    try:
        cursor.execute("ALTER TABLE interviews ADD COLUMN recording_file TEXT")
        conn.commit()
        print("  Added recording_file column to interviews table")
    except:
        pass  # Column already exists, that's fine

    # Answers table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS answers (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            interview_id INTEGER NOT NULL,
            question_num INTEGER NOT NULL,
            question     TEXT NOT NULL,
            answer       TEXT NOT NULL,
            feedback     TEXT,
            score        INTEGER DEFAULT 0,
            FOREIGN KEY (interview_id) REFERENCES interviews(id)
        )
    """)

    # Demo user
    demo_password = hash_password("demo123")
    cursor.execute("""
        INSERT OR IGNORE INTO users (name, email, password)
        VALUES (?, ?, ?)
    """, ("Demo User", "demo@gmail.com", demo_password))

    conn.commit()
    conn.close()
    print(f"  Database ready: {DB_FILE}")


def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()


init_db()


# ------------------------------------------------
# HELPER: Call Groq AI
# ------------------------------------------------
def ask_groq(prompt):
    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1000
    )
    return response.choices[0].message.content.strip()


# ------------------------------------------------
# ROUTE: Home page
# ------------------------------------------------
@app.route("/")
def home():
    return render_template("index.html")


# ------------------------------------------------
# ROUTE: Serve recorded videos
# GET /recordings/<filename>
# ------------------------------------------------
@app.route("/recordings/<filename>")
def serve_recording(filename):
    return send_from_directory(RECORDINGS_FOLDER, filename)


# ------------------------------------------------
# ROUTE: Upload video recording from browser
# POST /api/save-recording
# ------------------------------------------------
@app.route("/api/save-recording", methods=["POST"])
def save_recording():
    data = request.get_json()
    interview_id = data.get("interview_id")
    video_data = data.get("video_data", "")  # base64 encoded video

    if not interview_id or not video_data:
        return jsonify({"success": False, "error": "Missing data."}), 400

    try:
        # Decode base64 video data
        video_bytes = base64.b64decode(video_data.split(",")[-1])

        # Create unique filename
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"interview_{interview_id}_{timestamp}.webm"
        filepath = os.path.join(RECORDINGS_FOLDER, filename)

        # Save video file to recordings/ folder
        with open(filepath, "wb") as f:
            f.write(video_bytes)

        file_size_mb = round(len(video_bytes) / (1024 * 1024), 2)
        print(f"  Recording saved: {filename} ({file_size_mb} MB)")

        # Save filename to database
        conn = get_db()
        conn.execute(
            "UPDATE interviews SET recording_file = ? WHERE id = ?",
            (filename, interview_id)
        )
        conn.commit()
        conn.close()

        return jsonify({
            "success": True,
            "filename": filename,
            "size_mb": file_size_mb,
            "url": f"/recordings/{filename}"
        })

    except Exception as e:
        print(f"  Error saving recording: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# ------------------------------------------------
# ROUTE: Login
# ------------------------------------------------
@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email", "").strip()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"success": False, "error": "Please fill in all fields."}), 400

    conn = get_db()
    user = conn.execute(
        "SELECT * FROM users WHERE email = ? AND password = ?",
        (email, hash_password(password))
    ).fetchone()
    conn.close()

    if user:
        session["user_id"] = user["id"]
        session["user_name"] = user["name"]
        session["user_email"] = user["email"]
        return jsonify({
            "success": True,
            "user": {"id": user["id"], "name": user["name"], "email": user["email"]}
        })
    else:
        return jsonify({"success": False, "error": "Wrong email or password!"}), 401


# ------------------------------------------------
# ROUTE: Signup
# ------------------------------------------------
@app.route("/api/signup", methods=["POST"])
def signup():
    data = request.get_json()
    name = data.get("name", "").strip()
    email = data.get("email", "").strip()
    password = data.get("password", "")
    confirm = data.get("confirm", "")

    if not name or not email or not password or not confirm:
        return jsonify({"success": False, "error": "Please fill in all fields."}), 400
    if "@" not in email:
        return jsonify({"success": False, "error": "Invalid email address."}), 400
    if len(password) < 6:
        return jsonify({"success": False, "error": "Password must be at least 6 characters."}), 400
    if password != confirm:
        return jsonify({"success": False, "error": "Passwords do not match!"}), 400

    try:
        conn = get_db()
        conn.execute(
            "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
            (name, email, hash_password(password))
        )
        conn.commit()
        conn.close()
        print(f"  New user: {name} ({email})")
        return jsonify({"success": True, "message": "Account created! You can now login."})
    except sqlite3.IntegrityError:
        return jsonify({"success": False, "error": "Email already exists."}), 400


# ------------------------------------------------
# ROUTE: Logout
# ------------------------------------------------
@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"success": True})


# ------------------------------------------------
# ROUTE: Generate AI questions
# ------------------------------------------------
@app.route("/api/generate-questions", methods=["POST"])
def generate_questions():
    data = request.get_json()
    job_role = data.get("job_role", "")
    interview_type = data.get("interview_type", "general")
    user_id = session.get("user_id")

    if not job_role:
        return jsonify({"success": False, "error": "Job role is required."}), 400

    prompt = f"""You are an interviewer. Generate exactly 5 interview questions for a "{job_role}" position.
Interview type: {interview_type}

Rules:
- Make questions specific and relevant to the "{job_role}" role
- For technical: ask about skills, tools, technologies for this role
- For behavioral: ask situational questions relevant to this role
- For general: mix of motivation, background, role-fit questions
- Return ONLY a valid JSON array of 5 strings, no markdown, no explanation
- Example: ["Question 1?", "Question 2?", "Question 3?", "Question 4?", "Question 5?"]"""

    try:
        response_text = ask_groq(prompt)
        response_text = response_text.replace("```json", "").replace("```", "").strip()
        questions = json.loads(response_text)

        # Create interview session in database
        conn = get_db()
        cursor = conn.execute(
            "INSERT INTO interviews (user_id, job_role, interview_type) VALUES (?, ?, ?)",
            (user_id, job_role, interview_type)
        )
        interview_id = cursor.lastrowid
        conn.commit()
        conn.close()

        print(f"  Interview #{interview_id} started for: {job_role}")
        return jsonify({"success": True, "questions": questions, "interview_id": interview_id})

    except json.JSONDecodeError:
        return jsonify({"success": False, "error": "AI format error. Please try again."}), 500
    except Exception as e:
        print(f"  Error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# ------------------------------------------------
# ROUTE: Submit answer + get AI feedback + score
# ------------------------------------------------
@app.route("/api/submit-answer", methods=["POST"])
def submit_answer():
    data = request.get_json()
    interview_id = data.get("interview_id")
    job_role = data.get("job_role", "")
    question = data.get("question", "")
    question_num = data.get("question_num", 1)
    answer = data.get("answer", "")

    if not question or not answer:
        return jsonify({"success": False, "error": "Missing question or answer."}), 400

    prompt = f"""You are an expert interview coach evaluating a candidate for a "{job_role}" position.

Question: "{question}"
Candidate's Answer: "{answer}"

Your task:
1. Give SHORT feedback in 2-3 sentences. Be specific about strengths and improvements.
2. Give a score from 0 to 10 based on:
   - Relevance to the question (0-3 points)
   - Use of specific examples (0-3 points)
   - Clarity and communication (0-2 points)
   - Depth and insight (0-2 points)

Return ONLY a JSON object like this (no markdown, no explanation):
{{"feedback": "Your feedback here...", "score": 7}}"""

    try:
        response_text = ask_groq(prompt)
        response_text = response_text.replace("```json", "").replace("```", "").strip()
        result = json.loads(response_text)
        feedback = result.get("feedback", "Good answer!")
        score = int(result.get("score", 5))

        conn = get_db()
        conn.execute(
            """INSERT INTO answers (interview_id, question_num, question, answer, feedback, score)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (interview_id, question_num, question, answer, feedback, score)
        )
        conn.commit()
        conn.close()

        print(f"  Answer saved - Interview #{interview_id}, Q{question_num}, Score: {score}/10")
        return jsonify({"success": True, "feedback": feedback, "score": score})

    except Exception as e:
        print(f"  Error: {e}")
        try:
            conn = get_db()
            conn.execute(
                """INSERT INTO answers (interview_id, question_num, question, answer, feedback, score)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (interview_id, question_num, question, answer, "Could not get AI feedback.", 5)
            )
            conn.commit()
            conn.close()
        except:
            pass
        return jsonify({"success": True, "feedback": "Answer saved. AI feedback unavailable.", "score": 5})


# ------------------------------------------------
# ROUTE: Complete interview + generate full report
# ------------------------------------------------
@app.route("/api/complete-interview", methods=["POST"])
def complete_interview():
    data = request.get_json()
    interview_id = data.get("interview_id")

    conn = get_db()
    answers = conn.execute(
        "SELECT * FROM answers WHERE interview_id = ? ORDER BY question_num",
        (interview_id,)
    ).fetchall()

    if not answers:
        conn.close()
        return jsonify({"success": False, "error": "No answers found."}), 400

    total_score = sum(a["score"] for a in answers)
    max_score = len(answers) * 10
    percentage = round((total_score / max_score) * 100)

    conn.execute(
        "UPDATE interviews SET total_score = ?, completed_at = ? WHERE id = ?",
        (percentage, datetime.datetime.now().isoformat(), interview_id)
    )
    conn.commit()

    # Get recording filename if saved
    interview = conn.execute(
        "SELECT recording_file FROM interviews WHERE id = ?", (interview_id,)
    ).fetchone()
    recording_url = None
    if interview and interview["recording_file"]:
        recording_url = f"/recordings/{interview['recording_file']}"

    answers_list = [{
        "question_num": a["question_num"],
        "question": a["question"],
        "answer": a["answer"],
        "feedback": a["feedback"],
        "score": a["score"]
    } for a in answers]

    conn.close()

    if percentage >= 80:   grade, emoji = "Excellent", "🏆"
    elif percentage >= 60: grade, emoji = "Good", "👍"
    elif percentage >= 40: grade, emoji = "Average", "📈"
    else:                  grade, emoji = "Needs Improvement", "💪"

    print(f"  Interview #{interview_id} complete. Score: {percentage}% ({grade})")

    return jsonify({
        "success": True,
        "total_score": total_score,
        "max_score": max_score,
        "percentage": percentage,
        "grade": grade,
        "grade_emoji": emoji,
        "recording_url": recording_url,
        "answers": answers_list
    })


# ------------------------------------------------
# ROUTE: Get past interviews for logged in user
# ------------------------------------------------
@app.route("/api/my-interviews", methods=["GET"])
def my_interviews():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"success": False, "error": "Not logged in."}), 401

    conn = get_db()
    interviews = conn.execute(
        """SELECT * FROM interviews
           WHERE user_id = ? AND completed_at IS NOT NULL
           ORDER BY started_at DESC LIMIT 10""",
        (user_id,)
    ).fetchall()
    conn.close()

    result = [{
        "id": i["id"],
        "job_role": i["job_role"],
        "interview_type": i["interview_type"],
        "total_score": i["total_score"],
        "started_at": i["started_at"],
        "recording_file": i["recording_file"],
        "recording_url": f"/recordings/{i['recording_file']}" if i["recording_file"] else None
    } for i in interviews]

    return jsonify({"success": True, "interviews": result})


# ------------------------------------------------
# RUN THE APP
# ------------------------------------------------
if __name__ == "__main__":
    print("=" * 50)
    print("  AI Interview Bot - Complete System")
    print(f"  Database: {DB_FILE} (SQLite)")
    print(f"  Recordings: {RECORDINGS_FOLDER}/")
    print("  AI: Groq LLaMA 3.1 (Free Forever!)")
    print("=" * 50)
    # Use PORT from environment (Render sets this automatically)
    port = int(os.environ.get("PORT", 5000))
    # debug=False for production on Render
    app.run(host="0.0.0.0", port=port, debug=False)

from fastapi import FastAPI, HTTPException, Header
import uuid
import hashlib
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import httpx
import logging
import os
import json
import re
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path
from dotenv import load_dotenv

import pathlib
load_dotenv(dotenv_path=pathlib.Path(__file__).parent / ".env", override=True)
app = FastAPI(title="AI Interview Assistant API")
logger = logging.getLogger("ai_interview.auth_email")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = "llama-3.3-70b-versatile"

RAG_KB = {
    "behavioral": [
        "Tell me about a time you faced a major technical challenge. How did you resolve it?",
        "Describe a situation where you had to meet a tight deadline with incomplete requirements.",
        "How do you handle disagreements with teammates on technical decisions?",
        "Tell me about a project you're most proud of and why.",
        "Describe a time you received critical feedback and how you responded.",
    ],
    "frontend": [
        "Explain the virtual DOM and its performance implications.",
        "How do you optimize a React app with thousands of list items?",
        "What is the difference between controlled and uncontrolled components?",
        "Explain CSS specificity and how to avoid conflicts in large codebases.",
        "How would you implement code splitting in a large SPA?",
    ],
    "backend": [
        "Design a rate limiting system for a high-traffic API.",
        "Explain ACID properties and when you'd use NoSQL over SQL.",
        "How would you design a URL shortener like bit.ly?",
        "What are the tradeoffs between REST and GraphQL?",
        "Explain the CAP theorem and how it affects distributed systems.",
    ],
    "system_design": [
        "Design a scalable notification system for 10 million users.",
        "How would you design Twitter's trending topics feature?",
        "Design a distributed caching layer for a global application.",
        "How would you architect a real-time collaborative document editor?",
        "Design an autocomplete search system for an e-commerce platform.",
    ],
}

WEIGHTS = {
    "technical_knowledge": 0.30,
    "problem_solving": 0.25,
    "communication_skills": 0.20,
    "project_understanding": 0.15,
    "confidence": 0.10,
}




# ─── Auth Data ────────────────────────────────────────────────────────────────
def hash_pw(p): return hashlib.sha256(p.encode()).hexdigest()

DEFAULT_USERS = {
    "hr@demo.com":        {"id":"u1","name":"HR Manager","email":"hr@demo.com","role":"hr","pw":hash_pw("hr123")},
    "candidate@demo.com": {"id":"u2","name":"Demo Candidate","email":"candidate@demo.com","role":"candidate","pw":hash_pw("candidate123")},
}
TOKENS_DB = {}  # token -> user_id
SIGNUP_OTP_DB = {}  # email -> {"otp": str, "expires_at": datetime}
PASSWORD_RESET_OTP_DB = {}  # email -> {"otp": str, "expires_at": datetime, "role": str}
PASSWORD_RESET_SESSION_DB = {}  # reset_token -> {"email": str, "expires_at": datetime, "role": str}

USERS_DB_FILE = Path(__file__).with_name("users_db.json")
INTERVIEWS_DB_FILE = Path(__file__).with_name("interviews_db.json")
DEFAULT_INTERVIEWS = []

OTP_EXPIRY_MINUTES = max(int(os.getenv("SIGNUP_OTP_TTL_MINUTES", "10")), 1)
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "").strip()
RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "").strip()
RESEND_FROM_NAME = os.getenv("RESEND_FROM_NAME", "AI Interview").strip()
RESEND_API_URL = os.getenv("RESEND_API_URL", "https://api.resend.com/emails").strip()
ALLOW_INSECURE_OTP_RESPONSE = os.getenv("ALLOW_INSECURE_OTP_RESPONSE", "false").strip().lower() == "true"


def load_users():
    if USERS_DB_FILE.exists():
        try:
            data = json.loads(USERS_DB_FILE.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return data
        except Exception:
            pass
    return json.loads(json.dumps(DEFAULT_USERS))


def save_users():
    USERS_DB_FILE.write_text(json.dumps(USERS_DB, indent=2), encoding="utf-8")


def load_interviews():
    if INTERVIEWS_DB_FILE.exists():
        try:
            data = json.loads(INTERVIEWS_DB_FILE.read_text(encoding="utf-8"))
            if isinstance(data, list):
                return data
        except Exception:
            pass
    return DEFAULT_INTERVIEWS.copy()


def save_interviews():
    INTERVIEWS_DB_FILE.write_text(json.dumps(INTERVIEWS_DB, indent=2), encoding="utf-8")

USERS_DB = load_users()
INTERVIEWS_DB = load_interviews()

if not USERS_DB_FILE.exists():
    save_users()

EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")

def normalize_email(value: str) -> str:
    return (value or "").strip().lower()

def is_valid_email(value: str) -> bool:
    return bool(EMAIL_RE.fullmatch(normalize_email(value)))


def has_special_character(value: str) -> bool:
    return bool(re.search(r"[^A-Za-z0-9]", value or ""))


def validate_signup_password(value: str) -> None:
    if not (value or "").strip():
        raise HTTPException(status_code=400, detail="Password is required")
    if not has_special_character(value):
        raise HTTPException(status_code=400, detail="Password must include at least 1 special character")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def get_signup_otp_record(email: str) -> Optional[dict]:
    record = SIGNUP_OTP_DB.get(email)
    if not record:
        return None
    if record["expires_at"] <= utc_now():
        SIGNUP_OTP_DB.pop(email, None)
        return None
    return record


def get_password_reset_otp_record(email: str) -> Optional[dict]:
    record = PASSWORD_RESET_OTP_DB.get(email)
    if not record:
        return None
    if record["expires_at"] <= utc_now():
        PASSWORD_RESET_OTP_DB.pop(email, None)
        return None
    return record


def get_password_reset_session(reset_token: str) -> Optional[dict]:
    record = PASSWORD_RESET_SESSION_DB.get(reset_token)
    if not record:
        return None
    if record["expires_at"] <= utc_now():
        PASSWORD_RESET_SESSION_DB.pop(reset_token, None)
        return None
    return record


def get_missing_email_settings() -> List[str]:
    missing = []
    if not RESEND_API_KEY:
        missing.append("RESEND_API_KEY")
    if not RESEND_FROM_EMAIL:
        missing.append("RESEND_FROM_EMAIL")
    return missing


def is_email_configured() -> bool:
    return not get_missing_email_settings()


def build_otp_config_error() -> HTTPException:
    missing = get_missing_email_settings()
    missing_text = f" Missing: {', '.join(missing)}." if missing else ""
    return HTTPException(
        status_code=500,
        detail=(
            "OTP email delivery is not configured on the server. "
            "Set RESEND_API_KEY and RESEND_FROM_EMAIL."
            f"{missing_text}"
        ),
    )


async def send_auth_otp_email(recipient_email: str, otp: str, purpose: str) -> None:
    if not is_email_configured():
        raise build_otp_config_error()

    subject = f"Your AI Interview {purpose} OTP"
    body = "\n".join([
        f"Your AI Interview {purpose} OTP is:",
        otp,
        "",
        f"It expires in {OTP_EXPIRY_MINUTES} minutes.",
        "If you did not request this, you can ignore this email.",
    ])
    sender = f"{RESEND_FROM_NAME} <{RESEND_FROM_EMAIL}>"
    payload = {
        "from": sender,
        "to": [recipient_email],
        "subject": subject,
        "text": body,
    }
    headers = {
        "Authorization": f"Bearer {RESEND_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(RESEND_API_URL, headers=headers, json=payload)
        response.raise_for_status()
    except HTTPException:
        raise
    except httpx.HTTPStatusError as exc:
        status_code = exc.response.status_code
        logger.exception("Resend rejected OTP email with status %s", status_code)
        if status_code in {401, 403}:
            detail = "Resend authentication failed. Check RESEND_API_KEY."
        elif status_code == 422:
            detail = "Resend rejected the email request. Check RESEND_FROM_EMAIL and verify your Resend sender/domain."
        else:
            detail = "Resend rejected the OTP email request."
        raise HTTPException(status_code=500, detail=detail) from exc
    except httpx.RequestError as exc:
        logger.exception("Could not connect to Resend while sending OTP email")
        raise HTTPException(
            status_code=500,
            detail="Could not connect to Resend. Check RESEND_API_URL and your server network access.",
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected error while sending OTP email")
        raise HTTPException(status_code=500, detail="Unable to send OTP email right now") from exc


async def send_signup_otp_email(recipient_email: str, otp: str) -> None:
    await send_auth_otp_email(recipient_email, otp, "signup")


def to_number(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def get_recommendation_for_score(score: float) -> str:
    normalized_score = clamp_score_out_of_10(score)
    if normalized_score >= 8.5:
        return "Strong Hire"
    if normalized_score >= 7:
        return "Hire"
    if normalized_score >= 5:
        return "Maybe Hire"
    return "No Hire"


def normalize_score_to_percent(value) -> Optional[float]:
    score = to_number(value)
    if score is None:
        return None
    if 0 < score <= 1:
        score *= 100
    elif 0 < score <= 10:
        score *= 10
    score = max(0.0, min(100.0, score))
    return round(score, 1)


def clamp_score_out_of_10(value) -> float:
    score = to_number(value)
    if score is None:
        return 0.0
    if score > 10:
        score /= 10
    score = max(0.0, min(10.0, score))
    return round(score, 1)


LOW_QUALITY_ANSWERS = {
    "idk", "i dont know", "i don't know", "dont know", "don't know",
    "no", "nope", "na", "n/a", "none", "nothing", "asdf", "qwerty",
    "xyz", "test", "random", "blah", "gibberish", "skip",
}


def normalize_answer_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower())


def is_gibberish_or_irrelevant_answer(answer: str) -> bool:
    normalized = normalize_answer_text(answer)
    if not normalized:
        return True
    compact = re.sub(r"[^a-z0-9]+", "", normalized)
    words = re.findall(r"[a-zA-Z]+", normalized)
    if normalized in LOW_QUALITY_ANSWERS or compact in LOW_QUALITY_ANSWERS:
        return True
    if len(compact) <= 2:
        return True
    if len(words) <= 2 and len(compact) < 18:
        return True
    if len(compact) >= 4 and len(set(compact)) <= 2:
        return True
    if re.fullmatch(r"[a-z]{4,}", compact or "") and not re.search(r"[aeiou]", compact):
        return True
    alpha_count = sum(1 for char in compact if char.isalpha())
    if alpha_count >= 6 and len(words) <= 1:
        unique_ratio = len(set(compact)) / max(len(compact), 1)
        if unique_ratio < 0.45:
            return True
    return False


def zero_quality_evaluation(detail: str = "The answer was blank, irrelevant, or not meaningful.") -> dict:
    return {
        "scores": {key: 0 for key in WEIGHTS},
        "strength": "No meaningful strengths were demonstrated.",
        "improvement": detail,
        "weighted_total": 0,
    }


def apply_answer_quality_caps(result: dict, answer: str) -> dict:
    if is_gibberish_or_irrelevant_answer(answer):
        return zero_quality_evaluation()

    scores = {
        key: clamp_score_out_of_10(result.get("scores", {}).get(key))
        for key in WEIGHTS
    }
    weighted_total = round(sum(scores.get(k, 0) * v for k, v in WEIGHTS.items()), 1)

    if weighted_total <= 1:
        result["strength"] = "No meaningful strengths were demonstrated."
    result["scores"] = scores
    result["weighted_total"] = weighted_total
    return result


def build_report_payload(overall_score: float, recommendation: str, summary: str, strengths: list, improvements: list, metric_scores: dict) -> dict:
    overall_score = clamp_score_out_of_10(overall_score)
    metric_scores = {key: clamp_score_out_of_10(metric_scores.get(key)) for key in WEIGHTS}
    payload = {
        "overall_score": overall_score,
        "recommendation": recommendation,
        "summary": summary,
        "strengths": strengths if isinstance(strengths, list) else [],
        "improvements": improvements if isinstance(improvements, list) else [],
        "metric_scores": metric_scores,
        "weighted_total": overall_score,
    }
    payload.update({
        "overallScore": overall_score,
        "technicalKnowledge": metric_scores["technical_knowledge"],
        "problemSolving": metric_scores["problem_solving"],
        "communicationSkills": metric_scores["communication_skills"],
        "projectUnderstanding": metric_scores["project_understanding"],
        "confidence": metric_scores["confidence"],
    })
    return payload


def get_coding_analysis_score(analysis: dict) -> Optional[float]:
    if not isinstance(analysis, dict):
        return None

    overall = to_number(analysis.get("overall_score"))
    if overall is not None:
        return overall

    parts = [to_number(analysis.get("correctness")), to_number(analysis.get("code_quality"))]
    parts = [value for value in parts if value is not None]
    if not parts:
        return None
    return sum(parts) / len(parts)


def get_coding_output_score(output: str) -> Optional[float]:
    if not isinstance(output, str) or not output.strip():
        return None

    lines = [line.strip() for line in output.splitlines() if line.strip()]
    normalized_text = output.lower()
    test_lines = [line for line in lines if re.search(r"test\s*\d+", line, re.IGNORECASE)]
    relevant = test_lines or lines

    passed = 0
    failed = 0
    for line in relevant:
        normalized = line.lower()
        if any(token in normalized for token in ["pass", "passed", "works correctly", "match", "✓"]):
            passed += 1
            continue
        if any(token in normalized for token in ["fail", "failed", "error", "incorrect", "no runnable solution"]):
            failed += 1

    total = passed + failed
    if total == 0:
        if any(token in normalized_text for token in [
            "all tests passed",
            "both tests passed",
            "results match expected output",
            "pattern matching works as expected",
        ]):
            return 10
        if any(token in normalized_text for token in [
            "tests failed",
            "test failed",
            "does not match expected",
        ]):
            return 0
    if total == 0:
        return None
    return (passed / total) * 10


def normalize_interview_record(iv: dict) -> dict:
    if not isinstance(iv, dict):
        return iv

    normalized = dict(iv)
    saved_score = normalize_score_to_percent(iv.get("score"))
    if saved_score is not None:
        normalized["score"] = saved_score
        normalized["recommendation"] = get_recommendation_for_score(saved_score / 10)

    coding = iv.get("coding") or {}
    problems = coding.get("problems") or []
    total_questions = max(int(to_number(coding.get("total_questions")) or 0), len(problems))

    if not problems or total_questions <= 0:
        return normalized

    scores = []
    for problem in problems:
        score = get_coding_analysis_score(problem.get("analysis"))
        if score is None:
            score = get_coding_output_score(problem.get("testcase_output"))
        scores.append(score if score is not None else 0)

    if not any(score > 0 for score in scores):
        return normalized

    derived_score = round((sum(scores) / total_questions) * 10, 1)
    if saved_score is None or saved_score <= 0:
        normalized["score"] = derived_score
        normalized["recommendation"] = get_recommendation_for_score(derived_score / 10)
    return normalized


def get_current_user(authorization: Optional[str] = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    uid = TOKENS_DB.get(token)
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    for u in USERS_DB.values():
        if u["id"] == uid:
            return u
    raise HTTPException(status_code=401, detail="User not found")


# ─── Auth Models ──────────────────────────────────────────────────────────────
class SignupRequest(BaseModel):
    name: str
    email: str
    password: str
    otp: str
    role: str = "candidate"

class SignupOtpRequest(BaseModel):
    email: str

class LoginRequest(BaseModel):
    email: str
    password: str
    role: Optional[str] = None

class PasswordResetOtpRequest(BaseModel):
    email: str
    role: str

class PasswordResetVerifyRequest(BaseModel):
    email: str
    role: str
    otp: str

class PasswordResetConfirmRequest(BaseModel):
    reset_token: str
    password: str
    confirm_password: str


# ─── Auth Endpoints ───────────────────────────────────────────────────────────
@app.post("/auth/request-signup-otp")
async def request_signup_otp(req: SignupOtpRequest):
    email = normalize_email(req.email)
    if not is_valid_email(email):
        raise HTTPException(status_code=400, detail="Enter a valid email address")
    if email in USERS_DB:
        raise HTTPException(status_code=400, detail="Email already registered")

    otp = f"{random.randint(0, 999999):06d}"
    SIGNUP_OTP_DB[email] = {
        "otp": otp,
        "expires_at": utc_now() + timedelta(minutes=OTP_EXPIRY_MINUTES),
    }
    if is_email_configured():
        await send_signup_otp_email(email, otp)
        return {"ok": True, "message": f"OTP sent to {email}"}
    if ALLOW_INSECURE_OTP_RESPONSE:
        return {
            "ok": True,
            "message": "Email delivery is not configured. Returning OTP directly because ALLOW_INSECURE_OTP_RESPONSE=true.",
            "dev_otp": otp,
        }
    raise build_otp_config_error()


@app.post("/auth/signup")
async def signup(req: SignupRequest):
    email = normalize_email(req.email)
    name = (req.name or "").strip()
    if not is_valid_email(email):
        raise HTTPException(status_code=400, detail="Enter a valid email address")
    if not name:
        raise HTTPException(status_code=400, detail="Full name is required")
    if email in USERS_DB:
        raise HTTPException(status_code=400, detail="Email already registered")
    validate_signup_password(req.password)

    otp_record = get_signup_otp_record(email)
    if not otp_record:
        raise HTTPException(status_code=400, detail="Request a new OTP to continue signup")
    if (req.otp or "").strip() != otp_record["otp"]:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    uid = "u" + str(uuid.uuid4())[:8]
    USERS_DB[email] = {"id":uid,"name":name,"email":email,"role":req.role,"pw":hash_pw(req.password)}
    save_users()
    SIGNUP_OTP_DB.pop(email, None)
    token = str(uuid.uuid4())
    TOKENS_DB[token] = uid
    u = USERS_DB[email]
    return {"token": token, "user": {"id":u["id"],"name":u["name"],"email":u["email"],"role":u["role"]}}

@app.post("/auth/login")
async def login(req: LoginRequest):
    u = USERS_DB.get(normalize_email(req.email))
    if not u or u["pw"] != hash_pw(req.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if req.role and u["role"] != req.role:
        raise HTTPException(status_code=403, detail=f"This account is registered as {u['role']}, not {req.role}")
    token = str(uuid.uuid4())
    TOKENS_DB[token] = u["id"]
    return {"token": token, "user": {"id":u["id"],"name":u["name"],"email":u["email"],"role":u["role"]}}


@app.post("/auth/request-password-reset-otp")
async def request_password_reset_otp(req: PasswordResetOtpRequest):
    email = normalize_email(req.email)
    role = (req.role or "").strip().lower()
    if role not in {"candidate", "hr"}:
        raise HTTPException(status_code=400, detail="Choose a valid account type")
    if not is_valid_email(email):
        raise HTTPException(status_code=400, detail="Enter a valid email address")

    user = USERS_DB.get(email)
    if not user or user["role"] != role:
        raise HTTPException(status_code=404, detail=f"No {role} account found for this email")

    otp = f"{random.randint(0, 999999):06d}"
    PASSWORD_RESET_OTP_DB[email] = {
        "otp": otp,
        "role": role,
        "expires_at": utc_now() + timedelta(minutes=OTP_EXPIRY_MINUTES),
    }

    if is_email_configured():
        await send_auth_otp_email(email, otp, "password reset")
        return {"ok": True, "message": f"OTP sent to {email}"}
    if ALLOW_INSECURE_OTP_RESPONSE:
        return {
            "ok": True,
            "message": "Email delivery is not configured. Returning OTP directly because ALLOW_INSECURE_OTP_RESPONSE=true.",
            "dev_otp": otp,
        }
    raise build_otp_config_error()


@app.post("/auth/verify-password-reset-otp")
async def verify_password_reset_otp(req: PasswordResetVerifyRequest):
    email = normalize_email(req.email)
    role = (req.role or "").strip().lower()
    if role not in {"candidate", "hr"}:
        raise HTTPException(status_code=400, detail="Choose a valid account type")
    if not is_valid_email(email):
        raise HTTPException(status_code=400, detail="Enter a valid email address")

    record = get_password_reset_otp_record(email)
    if not record or record.get("role") != role:
        raise HTTPException(status_code=400, detail="Request a new OTP to continue")
    if (req.otp or "").strip() != record["otp"]:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    reset_token = str(uuid.uuid4())
    PASSWORD_RESET_SESSION_DB[reset_token] = {
        "email": email,
        "role": role,
        "expires_at": utc_now() + timedelta(minutes=OTP_EXPIRY_MINUTES),
    }
    PASSWORD_RESET_OTP_DB.pop(email, None)
    return {"ok": True, "message": "OTP verified", "reset_token": reset_token}


@app.post("/auth/reset-password")
async def reset_password(req: PasswordResetConfirmRequest):
    session = get_password_reset_session((req.reset_token or "").strip())
    if not session:
        raise HTTPException(status_code=400, detail="Reset session expired. Request a new OTP")
    if req.password != req.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    validate_signup_password(req.password)

    user = USERS_DB.get(session["email"])
    if not user or user["role"] != session["role"]:
        PASSWORD_RESET_SESSION_DB.pop(req.reset_token, None)
        raise HTTPException(status_code=404, detail="Account no longer exists")

    user["pw"] = hash_pw(req.password)
    save_users()
    PASSWORD_RESET_SESSION_DB.pop(req.reset_token, None)
    return {"ok": True, "message": "Password reset successful"}

@app.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(default=None)):
    if authorization and authorization.startswith("Bearer "):
        TOKENS_DB.pop(authorization.split(" ",1)[1], None)
    return {"ok": True}

@app.get("/auth/me")
async def me(authorization: Optional[str] = Header(default=None)):
    u = get_current_user(authorization)
    return {"id":u["id"],"name":u["name"],"email":u["email"],"role":u["role"]}


# ─── Interview Save/Fetch ─────────────────────────────────────────────────────
class SaveInterviewRequest(BaseModel):
    role: str
    score: float
    recommendation: str
    skills: List[str] = []
    summary: str = ""
    strengths: List[str] = []
    improvements: List[str] = []
    scores: dict = {}
    proctoring: dict = {}
    qa: List[dict] = []
    coding: dict = {}

@app.post("/interviews/save")
async def save_interview(req: SaveInterviewRequest, authorization: Optional[str] = Header(default=None)):
    u = get_current_user(authorization)
    import datetime
    iv = {
        "id": str(uuid.uuid4()),
        "user_id": u["id"],
        "name": u["name"],
        "role": req.role,
        "date": datetime.date.today().isoformat(),
        "score": req.score,
        "recommendation": req.recommendation,
        "skills": req.skills,
        "summary": req.summary,
        "strengths": req.strengths,
        "improvements": req.improvements,
        "scores": req.scores,
        "proctoring": req.proctoring,
        "qa": req.qa,
        "coding": req.coding,
    }
    iv = normalize_interview_record(iv)
    INTERVIEWS_DB.append(iv)
    save_interviews()
    return {"id": iv["id"], "ok": True}

@app.get("/interviews/my")
async def my_interviews(authorization: Optional[str] = Header(default=None)):
    u = get_current_user(authorization)
    mine = [normalize_interview_record(i) for i in INTERVIEWS_DB if i["user_id"] == u["id"]]
    return {"interviews": sorted(mine, key=lambda x: x["date"], reverse=True)}

@app.get("/interviews/all")
async def all_interviews(authorization: Optional[str] = Header(default=None)):
    u = get_current_user(authorization)
    if u["role"] != "hr":
        raise HTTPException(status_code=403, detail="HR access only")
    normalized = [normalize_interview_record(i) for i in INTERVIEWS_DB]
    return {"interviews": sorted(normalized, key=lambda x: x["date"], reverse=True)}

async def call_groq(messages: list, max_tokens: int = 1024) -> str:
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not set in .env file")
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json={"model": MODEL, "max_tokens": max_tokens, "temperature": 0.7, "messages": messages},
        )
    if res.status_code != 200:
        err = res.json()
        raise HTTPException(status_code=res.status_code, detail=err.get("error", {}).get("message", "Groq API error"))
    return res.json()["choices"][0]["message"]["content"]


def parse_json(raw: str):
    try:
        return json.loads(raw.strip())
    except Exception:
        arr = re.search(r'\[[\s\S]*\]', raw)
        if arr:
            return json.loads(arr.group())
        obj = re.search(r'\{[\s\S]*\}', raw)
        if obj:
            return json.loads(obj.group())
        clean = re.sub(r'```json|```', '', raw).strip()
        return json.loads(clean)


def is_placeholder_code(code: str) -> bool:
    if not code or not code.strip():
        return True
    lowered = code.lower()
    if "your solution here" in lowered or "todo" in lowered:
        return True
    non_empty = [line.strip() for line in code.splitlines() if line.strip()]
    if len(non_empty) <= 2:
        return True
    if all(line in {"pass", "}", "{", "};"} for line in non_empty):
        return True
    return False


# ── Request Models ────────────────────────────────────────────────────────────
class GenerateQuestionsRequest(BaseModel):
    role: str
    resume_text: Optional[str] = ""

class EvaluateAnswerRequest(BaseModel):
    role: str
    question: str
    answer: str
    resume_text: Optional[str] = ""

class GenerateReportRequest(BaseModel):
    role: str
    answers: List[dict]
    resume_text: Optional[str] = ""

class AnalyzeCodeRequest(BaseModel):
    problem_title: str
    code: str
    examples: List[str]
    language: str = "javascript"

class RunCodeRequest(BaseModel):
    problem_title: str
    code: str
    examples: List[str]
    language: str = "javascript"

class RAGSearchRequest(BaseModel):
    query: str

class AskRecruiterRequest(BaseModel):
    candidate_name: str
    candidate_role: str
    score: float
    recommendation: str
    skills: List[str]
    question: str


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "AI Interview Assistant API running", "model": MODEL}



class GenerateCodingProblemsRequest(BaseModel):
    prompt: str
    language: str = "javascript"
    role: Optional[str] = "Software Engineer"
    level: Optional[str] = "Mid-level"

@app.post("/generate-coding-problems")
async def generate_coding_problems(req: GenerateCodingProblemsRequest):
    """Generates 3 coding problems based on resume or AI choice, for any language."""
    level = (req.level or "Mid-level").strip()
    role = (req.role or "Software Engineer").strip()
    content_msg = f"""{req.prompt}

Generate exactly 3 coding problems for a {role} {req.language} coding interview.
Respond with ONLY a valid JSON array. No text before or after.
Each object must have: title, difficulty (Easy/Medium/Hard), tags (array), description, examples (array of strings).
Difficulty rule:
- Beginner -> Easy problems.
- Mid-level -> Moderate DSA/problem-solving problems.
- Senior -> Advanced coding or system-design-oriented problems.
Use this candidate level: {level}.
Role rule:
- Frontend -> React/UI logic.
- Backend -> APIs, databases, scalability.
- Full Stack -> End-to-end application logic.
- Software Engineer -> DSA and algorithms.
The questions should feel fresh and varied for this candidate, not generic repeats.
Do not make all 3 problems array-based.
Prefer company-style hiring questions across different areas such as strings, stacks, heaps, trees, graphs, intervals, design, scheduling, or practical data handling when relevant.

Example format:
[
  {{
    "title": "Two Sum",
    "difficulty": "Easy",
    "tags": ["Array", "HashMap"],
    "description": "Given an array of integers...",
    "examples": ["Input: nums=[2,7,11,15], target=9 → Output: [0,1]"]
  }}
]"""

    raw = await call_groq([{"role": "user", "content": content_msg}], max_tokens=1500)
    try:
        problems = parse_json(raw)
        if not isinstance(problems, list):
            raise ValueError("Not a list")
        easy = [p for p in problems if str(p.get("difficulty", "")).lower() == "easy"]
        medium = [p for p in problems if str(p.get("difficulty", "")).lower() == "medium"]
        selected = easy[:2] + medium[:1]
        if len(selected) < 3:
            selected = problems[:3]
        return {"problems": selected[:3]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parse error: {str(e)} | Raw: {raw[:200]}")

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/rag-kb")
def get_rag_kb():
    return {"kb": RAG_KB}


@app.post("/generate-questions")
async def generate_questions(req: GenerateQuestionsRequest):
    base = f"Generate exactly 8 interview questions for a {req.role} role"
    resume_part = f" based on this resume:\n{req.resume_text}" if req.resume_text else " covering technical and behavioral topics"
    content = f"""{base}{resume_part}.

STRICT RULES for every question:
- Maximum 1 to 2 lines per question. Never write long paragraph-style questions.
- Only go to 3 lines if absolutely unavoidable.
- Questions must be short, clear, professional, and conversational.
- No compound multi-part questions. One focused question at a time.
- Mix technical, behavioral, and situational questions across varied topics.

Respond with ONLY a valid JSON array of 8 strings. No text before or after.
Example: ["Tell me about yourself.", "How do you handle tight deadlines?", "What is your experience with REST APIs?"]"""

    raw = await call_groq([{"role": "user", "content": content}])
    try:
        questions = parse_json(raw)
        if not isinstance(questions, list):
            raise ValueError("Response is not a list")
        return {"questions": questions[:8]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parse error: {str(e)} | Raw: {raw[:200]}")


class GenerateFollowUpRequest(BaseModel):
    role: str
    previous_question: str
    previous_answer: str
    resume_text: Optional[str] = ""
    questions_asked: List[str] = []

@app.post("/generate-followup")
async def generate_followup(req: GenerateFollowUpRequest):
    asked_list = "\n".join([f"- {q}" for q in req.questions_asked]) if req.questions_asked else "None"
    resume_context = req.resume_text.strip() if req.resume_text else "No resume provided."
    content = f"""You are a professional interviewer for a {req.role} role.

Resume context: {resume_context}

Last question asked: {req.previous_question}
Candidate's answer: {req.previous_answer}

Already asked questions (do NOT repeat):
{asked_list}

Generate exactly 1 follow-up interview question.

STRICT RULES:
- Maximum 1 to 2 lines. Short, clear, conversational.
- No paragraph-style questions. No multi-part questions.
- Must be relevant to the {req.role} role.
- Must NOT repeat or closely resemble any already asked question.

Respond with ONLY the question text. No JSON, no quotes, no explanation."""

    raw = await call_groq([{"role": "user", "content": content}], max_tokens=150)
    question = raw.strip().strip('"').strip("'").strip()
    return {"question": question}


@app.post("/evaluate-answer")
async def evaluate_answer(req: EvaluateAnswerRequest):
    if is_gibberish_or_irrelevant_answer(req.answer):
        return zero_quality_evaluation("Answer the question with specific, relevant technical details.")

    resume_context = req.resume_text.strip() if req.resume_text else "No resume was provided."

    content = f"""Evaluate this interview answer like a fair human interviewer.

Role: {req.role}
Resume/context:
{resume_context}

Question: {req.question}
Answer: {req.answer}

Respond with ONLY this JSON, no text before or after:
{{"scores":{{"technical_knowledge":7,"problem_solving":6,"communication_skills":8,"project_understanding":6,"confidence":7}},"strength":"What was good in one sentence","improvement":"What to improve in one sentence"}}

Scoring rules:
- Score strictly from 0 to 10.
- Excellent answer: 8-10. Average answer: 5-7. Weak answer: 2-4. Gibberish, spam, irrelevant, or no answer: 0-1.
- Evaluate meaning, relevance, and demonstrated understanding, not grammar or polished English.
- Natural human language, simple wording, and imperfect sentences are acceptable when the answer is relevant.
- Use the resume/context to credit truthful project or skill references that support the answer.
- Do not reward unrelated, memorized, or vague answers just because they are long.
- Use 0 for blank answers, irrelevant answers, or answers that do not address the question.
- Do not give an average score just for attempting an answer."""

    raw = await call_groq([{"role": "user", "content": content}], max_tokens=500)
    try:
        result = parse_json(raw)
        return apply_answer_quality_caps(result, req.answer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parse error: {str(e)}")


@app.post("/generate-report")
async def generate_report(req: GenerateReportRequest):
    qa_text = "\n\n".join([f"Q{i+1}: {a['q']}\nA: {a['a']}" for i, a in enumerate(req.answers)])
    answered = [a for a in req.answers if str(a.get("a", "")).strip()]

    if not req.answers:
        return build_report_payload(
            0,
            "No Hire",
            "No interview answers were submitted, so the candidate could not be evaluated.",
            [],
            ["Complete the interview questions before generating a report."],
            {key: 0 for key in WEIGHTS},
        )

    avg_scores = {}
    for key in WEIGHTS:
        vals = [clamp_score_out_of_10(a.get("scores", {}).get(key)) for a in req.answers]
        avg_scores[key] = round(sum(vals) / len(vals), 1)
    weighted_total = round(sum(avg_scores[k] * v for k, v in WEIGHTS.items()), 1)
    poor_answers = [a for a in req.answers if is_gibberish_or_irrelevant_answer(str(a.get("a", "")))]
    failed_majority = len(poor_answers) > len(req.answers) / 2

    if not answered or weighted_total <= 0 or failed_majority:
        capped_score = 0 if not answered or weighted_total <= 0 else min(weighted_total, 2)
        capped_scores = {key: min(value, 2) for key, value in avg_scores.items()} if failed_majority else avg_scores
        return build_report_payload(
            capped_score,
            "No Hire",
            "Most answers were blank, irrelevant, or too weak to demonstrate interview readiness.",
            [],
            ["Provide complete, relevant answers with concrete technical reasoning."],
            capped_scores,
        )

    resume_context = req.resume_text.strip() if req.resume_text else "No resume was provided."

    content = f"""Generate a recruiter-style interview report.

Role: {req.role}
Resume/context:
{resume_context}

Q&A:
{qa_text}

Respond with ONLY this JSON, no text before or after:
{{"summary":"2-3 sentence summary.","strengths":["strength 1","strength 2"],"improvements":["improvement 1","improvement 2"]}}

Evaluate answer quality against the questions, role, and resume/context. Do not judge grammar harshly when the meaning is clear.
Do not invent strengths for poor answers. Never produce positive feedback for meaningless, irrelevant, or very short answers."""

    raw = await call_groq([{"role": "user", "content": content}], max_tokens=700)
    try:
        base = parse_json(raw)
        recommendation = get_recommendation_for_score(weighted_total)
        return build_report_payload(
            weighted_total,
            recommendation,
            base.get("summary", "The candidate was evaluated against the completed interview answers."),
            base.get("strengths", []),
            base.get("improvements", []),
            avg_scores,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parse error: {str(e)}")


@app.post("/analyze-code")
async def analyze_code(req: AnalyzeCodeRequest):
    if is_placeholder_code(req.code):
        return {
            "time_complexity": "N/A",
            "space_complexity": "N/A",
            "correctness": 0,
            "code_quality": 0,
            "bugs": ["Starter template submitted without a real solution."],
            "suggestions": ["Write a real implementation before running analysis."],
            "overall_score": 0,
            "verdict": "Needs Work",
        }

    content = f"""Do a code review for this {req.language} solution.

Problem: {req.problem_title}
Code:
{req.code}

Respond with ONLY this JSON, no text before or after:
{{"time_complexity":"O(n)","space_complexity":"O(1)","correctness":8,"code_quality":7,"bugs":[],"suggestions":["tip 1","tip 2"],"overall_score":8,"verdict":"Good"}}

verdict must be one of: Optimal, Good, Acceptable, Needs Work"""

    raw = await call_groq([{"role": "user", "content": content}], max_tokens=600)
    try:
        return parse_json(raw)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parse error: {str(e)}")


@app.post("/run-code")
async def run_code(req: RunCodeRequest):
    if is_placeholder_code(req.code):
        return {"output": "No runnable solution detected. Please replace the starter template with your implementation."}

    content = f"""Simulate running this {req.language} code for "{req.problem_title}".

Test cases:
{chr(10).join(req.examples)}

Code:
{req.code}

Show results like:
Test 1: [0,1] ✓
Test 2: [1,2] ✓

If the code is incomplete, invalid, or clearly just a template, say so explicitly instead of claiming tests passed.
Plain text only. Max 5 lines."""

    output = await call_groq([{"role": "user", "content": content}], max_tokens=300)
    return {"output": output}


@app.post("/rag-search")
async def rag_search(req: RAGSearchRequest):
    all_qs = [{"cat": cat, "q": q} for cat, qs in RAG_KB.items() for q in qs]
    content = f"""Semantic search query: "{req.query}"

Questions:
{chr(10).join([f"{i}: {item['q']}" for i, item in enumerate(all_qs)])}

Return ONLY a JSON array of 4 most relevant indices. Example: [0,3,7,12]"""

    raw = await call_groq([{"role": "user", "content": content}], max_tokens=100)
    try:
        indices = parse_json(raw)
        results = [all_qs[i] for i in indices[:4] if i < len(all_qs)]
        return {"results": results}
    except Exception:
        ql = req.query.lower()
        results = [item for item in all_qs if ql in item["q"].lower()][:4]
        return {"results": results}


@app.post("/ask-recruiter")
async def ask_recruiter(req: AskRecruiterRequest):
    content = f"""You are a recruiting assistant.

Candidate: {req.candidate_name}
Role: {req.candidate_role}
Score: {req.score}/10
Recommendation: {req.recommendation}
Skills: {", ".join(req.skills)}

HR Question: {req.question}

Answer professionally in 2-3 sentences."""

    answer = await call_groq([{"role": "user", "content": content}], max_tokens=300)
    return {"answer": answer}
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
from fastapi import UploadFile, File
import pdfplumber
import io

@app.post("/parse-resume")
async def parse_resume(file: UploadFile = File(...)):
    content = await file.read()

    text = ""

    try:
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for page in pdf.pages:
                text += page.extract_text() or ""
    except Exception:
        try:
            text = content.decode("utf-8", errors="ignore")
        except Exception:
            text = ""

    return {"text": text}

import { useState, useRef, useEffect, useCallback } from "react";
import { FaceDetector as MediaPipeFaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";
import AnimeAvatar from "./components/AnimeAvatar.jsx";

// ─── Backend API Base URL ────────────────────────────────────────────────────
const DEFAULT_API = import.meta.env.PROD ? "https://ai-interview-final-aaki.onrender.com" : "http://localhost:8000";
const API = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API).replace(/\/$/, "");
// ─── Token helpers ───────────────────────────────────────────────────────────
const getToken = () => sessionStorage.getItem("token");
const getUser  = () => { try { return JSON.parse(sessionStorage.getItem("user")||"null"); } catch { return null; } };

// ─── API Helpers ─────────────────────────────────────────────────────────────
async function post(endpoint, body, auth = false) {
  const headers = { "Content-Type": "application/json" };
  if (auth) { const t = getToken(); if (t) headers["Authorization"] = `Bearer ${t}`; }
  const res = await fetch(`${API}${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || `Server error ${res.status}`);
  }
  return res.json();
}

async function get(endpoint, auth = false) {
  const headers = {};
  if (auth) { const t = getToken(); if (t) headers["Authorization"] = `Bearer ${t}`; }
  const res = await fetch(`${API}${endpoint}`, { headers });
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  return res.json();
}

// ─── Evaluation Metrics ──────────────────────────────────────────────────────
const EVAL_METRICS = [
  { key: "technical_knowledge",   label: "Technical Knowledge",   weight: 0.30, color: "#6366f1" },
  { key: "problem_solving",       label: "Problem Solving",       weight: 0.25, color: "#06b6d4" },
  { key: "communication_skills",  label: "Communication Skills",  weight: 0.20, color: "#8b5cf6" },
  { key: "project_understanding", label: "Project Understanding", weight: 0.15, color: "#f59e0b" },
  { key: "confidence",            label: "Confidence",            weight: 0.10, color: "#22c55e" },
];

const TARGET_ROLES = [
  "Software Engineer",
  "AI Engineer",
  "ML Engineer",
  "Web Developer",
  "Data Analyst",
  "DevOps Engineer",
  "Cyber Security",
  "QA/Test Engineer",
  "Playwright with Dynamic 365 Java",
  "Fullstack with React Python AWS DevOps",
];

// ─── Fallback Questions Pool (used when AI follow-up fails) ──────────────────
const FALLBACK_QUESTIONS = [
  "How do you prioritize tasks when working under pressure?",
  "What's the most valuable lesson you've learned in your career so far?",
  "How do you stay updated with new technologies in your field?",
  "Describe a time you had to learn something new very quickly.",
  "How do you handle disagreements with a teammate or manager?",
  "What does good code quality mean to you?",
  "Tell me about a project you're particularly proud of.",
  "How do you approach estimating time for a task?",
  "What's your process when you receive unclear requirements?",
  "How do you handle feedback on your work?",
  "Describe your ideal work environment.",
  "What tools or practices do you use to stay productive?",
  "Tell me about a time you had to work with a difficult stakeholder.",
  "How do you ensure your work is reliable and maintainable?",
  "What motivates you most in your day-to-day work?",
  "How do you approach onboarding into a new codebase or project?",
  "Tell me about a mistake you made and what you learned from it.",
  "How do you balance speed and quality when delivering work?",
  "What's your approach to writing documentation?",
  "How do you handle a situation where you're blocked on a task?",
];
const CODING_PROBLEMS = [
  { title: "Two Sum", difficulty: "Easy", tags: ["Array","HashMap"], description: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.", examples: ["Input: nums=[2,7,11,15], target=9 → Output: [0,1]", "Input: nums=[3,2,4], target=6 → Output: [1,2]"], starterCode: "function twoSum(nums, target) {\n  // Your solution here\n\n}" },
  { title: "Valid Parentheses", difficulty: "Easy", tags: ["Stack","String"], description: "Given a string containing '(', ')', '{', '}', '[' and ']', determine if the input string is valid.", examples: ["Input: s='()' → Output: true", "Input: s='(]' → Output: false"], starterCode: "function isValid(s) {\n  // Your solution here\n\n}" },
  { title: "LRU Cache", difficulty: "Medium", tags: ["Design","HashMap"], description: "Design a data structure that follows LRU cache constraints. Implement get and put in O(1).", examples: ["cache = new LRUCache(2)", "cache.put(1,1)", "cache.get(1) → 1"], starterCode: "class LRUCache {\n  constructor(capacity) {\n    // Your solution here\n  }\n  get(key) { }\n  put(key, value) { }\n}" },
  { title: "Merge Intervals", difficulty: "Medium", tags: ["Array","Sorting"], description: "Given an array of intervals, merge all overlapping intervals.", examples: ["Input: [[1,3],[2,6],[8,10]] → Output: [[1,6],[8,10]]"], starterCode: "function merge(intervals) {\n  // Your solution here\n\n}" },
];

// ─── Global CSS ──────────────────────────────────────────────────────────────
const COMPANY_STYLE_CODING_PROBLEMS = [
  { title: "Valid Parentheses", difficulty: "Easy", tags: ["Stack","String"], description: "Given a string containing brackets, determine whether the order is valid.", examples: ["Input: s='()[]{}' -> Output: true", "Input: s='([)]' -> Output: false"], starterCode: "function isValid(s) {\n  // Your solution here\n\n}" },
  { title: "Top K Frequent Words", difficulty: "Easy", tags: ["HashMap","Heap","String"], description: "Given a list of words and an integer k, return the k most frequent words sorted by frequency descending and then alphabetically.", examples: ["Input: words=['i','love','leetcode','i','love','coding'], k=2 -> Output: ['i','love']"], starterCode: "function topKFrequent(words, k) {\n  // Your solution here\n\n}" },
  { title: "Binary Tree Right Side View", difficulty: "Medium", tags: ["Tree","BFS"], description: "Given the root of a binary tree, return the values visible from the right side from top to bottom.", examples: ["Input: [1,2,3,null,5,null,4] -> Output: [1,3,4]"], starterCode: "function rightSideView(root) {\n  // Your solution here\n\n}" },
  { title: "LRU Cache", difficulty: "Medium", tags: ["Design","HashMap"], description: "Design a data structure that follows LRU cache constraints. Implement get and put in O(1).", examples: ["cache = new LRUCache(2)", "cache.put(1,1)", "cache.get(1) -> 1"], starterCode: "class LRUCache {\n  constructor(capacity) {\n    // Your solution here\n  }\n  get(key) { }\n  put(key, value) { }\n}" },
  { title: "Meeting Rooms II", difficulty: "Medium", tags: ["Heap","Intervals","Scheduling"], description: "Given meeting time intervals, find the minimum number of conference rooms required so that no meetings overlap.", examples: ["Input: [[0,30],[5,10],[15,20]] -> Output: 2"], starterCode: "function minMeetingRooms(intervals) {\n  // Your solution here\n\n}" },
];

const ROLE_CODING_PROBLEMS = {
  frontend: [
    { title: "Debounced Search State", difficulty: "Easy", tags: ["React","UI Logic"], description: "Implement a debounced search handler that updates visible results only after the user stops typing for 300ms.", examples: ["Input changes: r -> re -> rea -> react -> Output updates once with react"], starterCode: "function createDebouncedSearch(search, delay = 300) {\n  // Your solution here\n\n}" },
    { title: "Normalize Form Errors", difficulty: "Easy", tags: ["Forms","Validation"], description: "Given API validation errors, return a field-to-message map suitable for rendering under React inputs.", examples: ["Input: [{field:'email', message:'Invalid'}] -> Output: {email:'Invalid'}"], starterCode: "function normalizeErrors(errors) {\n  // Your solution here\n\n}" },
    { title: "Virtual List Window", difficulty: "Medium", tags: ["React","Performance"], description: "Given item count, row height, scroll offset, and viewport height, return the visible start and end indices for a virtualized list.", examples: ["Input: count=1000,row=20,scroll=100,view=60 -> Output: {start:5,end:8}"], starterCode: "function getVisibleWindow(count, rowHeight, scrollTop, viewportHeight) {\n  // Your solution here\n\n}" },
  ],
  backend: [
    { title: "Rate Limit Requests", difficulty: "Easy", tags: ["API","HashMap"], description: "Implement a fixed-window rate limiter that allows at most n requests per user per minute.", examples: ["limit(userA, t=0) repeated 3 times with max=2 -> true,true,false"], starterCode: "function createRateLimiter(maxRequests, windowMs) {\n  // Your solution here\n\n}" },
    { title: "Paginate Query Results", difficulty: "Easy", tags: ["API","Pagination"], description: "Given an array of records, page number, and page size, return items and pagination metadata.", examples: ["Input: 25 records,page=2,size=10 -> 10 items,totalPages=3"], starterCode: "function paginate(records, page, pageSize) {\n  // Your solution here\n\n}" },
    { title: "Idempotency Key Store", difficulty: "Medium", tags: ["API","Caching"], description: "Design an in-memory idempotency helper that returns a cached response for repeated request keys.", examples: ["Same key called twice -> second call returns first response without recomputing"], starterCode: "function createIdempotencyStore() {\n  // Your solution here\n\n}" },
  ],
  fullstack: [
    { title: "Optimistic Todo Sync", difficulty: "Easy", tags: ["State","API"], description: "Merge local optimistic todo updates with server todos without losing pending local items.", examples: ["Local temp item + server list -> output contains both with stable IDs"], starterCode: "function mergeTodos(serverTodos, localTodos) {\n  // Your solution here\n\n}" },
    { title: "Build Filter Query", difficulty: "Easy", tags: ["URL","Frontend","Backend"], description: "Convert UI filter state into a stable API query string, skipping empty values.", examples: ["Input: {status:'open', q:''} -> Output: 'status=open'"], starterCode: "function buildQuery(filters) {\n  // Your solution here\n\n}" },
    { title: "Retry Failed Requests", difficulty: "Medium", tags: ["API","Reliability"], description: "Implement retry logic for a request function with max attempts and exponential backoff delays.", examples: ["Fails twice then succeeds -> returns successful result on third attempt"], starterCode: "async function retryRequest(requestFn, maxAttempts) {\n  // Your solution here\n\n}" },
  ],
};

const getRoleBasedCodingProblems = (role, level) => {
  const text = `${role || ""} ${level || ""}`.toLowerCase();
  const base = text.includes("frontend") || text.includes("react") || text.includes("ui")
    ? ROLE_CODING_PROBLEMS.frontend
    : text.includes("backend") || text.includes("api") || text.includes("database")
      ? ROLE_CODING_PROBLEMS.backend
      : text.includes("fullstack") || text.includes("full stack")
        ? ROLE_CODING_PROBLEMS.fullstack
        : COMPANY_STYLE_CODING_PROBLEMS;
  if (text.includes("senior")) {
    return base.map((p, index) => index === base.length - 1 ? { ...p, difficulty: "Hard" } : p);
  }
  if (text.includes("beginner") || text.includes("junior")) {
    return base.map(p => ({ ...p, difficulty: "Easy" })).slice(0, 3);
  }
  return base.slice(0, 3);
};

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body{height:100%;}
body{background:#06070d;color:#f4f4f5;font-family:sans-serif;min-height:100vh;
  background-image:radial-gradient(ellipse 80% 50% at 20% -10%,rgba(99,102,241,.22) 0%,transparent 60%),
  radial-gradient(ellipse 60% 40% at 80% 100%,rgba(6,182,212,.12) 0%,transparent 50%);}
::-webkit-scrollbar{width:4px;}
::-webkit-scrollbar-thumb{background:rgba(99,102,241,.3);border-radius:4px;}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse-ring{0%{box-shadow:0 0 0 0 rgba(99,102,241,.5)}70%{box-shadow:0 0 0 14px rgba(99,102,241,0)}100%{box-shadow:0 0 0 0 rgba(99,102,241,0)}}
@keyframes wave{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes scanline{0%{top:-4px}100%{top:100%}}
.fade-up{animation:fadeUp .35s ease forwards;}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:9px 18px;border-radius:9px;font-size:13px;font-weight:500;cursor:pointer;transition:all .16s ease;border:none;outline:none;white-space:nowrap;font-family:inherit;}
.btn:active{transform:scale(.96);}
.btn:disabled{opacity:.4;cursor:not-allowed;transform:none!important;}
.btn-primary{background:#6366f1;color:#fff;box-shadow:0 0 20px rgba(99,102,241,.28);}
.btn-primary:hover:not(:disabled){background:#818cf8;}
.btn-ghost{background:rgba(255,255,255,.04);color:#a1a1aa;border:1px solid rgba(255,255,255,.07);}
.btn-ghost:hover:not(:disabled){background:rgba(255,255,255,.08);color:#f4f4f5;}
.btn-danger{background:rgba(239,68,68,.12);color:#fca5a5;border:1px solid rgba(239,68,68,.25);}
.card{background:#0f1120;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:22px;}
.input{width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:9px;padding:9px 13px;color:#f4f4f5;font-size:13px;outline:none;transition:border-color .15s;font-family:inherit;}
select.input{background-color:#15182b;color:#f4f4f5;color-scheme:dark;}
select.input option{background:#15182b;color:#f4f4f5;}
.input:focus{border-color:rgba(99,102,241,.5);}
.input::placeholder{color:#52525b;}
.tag{display:inline-flex;align-items:center;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:500;background:rgba(99,102,241,.1);color:#818cf8;border:1px solid rgba(99,102,241,.2);}
.tag-cyan{background:rgba(6,182,212,.1);color:#67e8f9;border-color:rgba(6,182,212,.2);}
.code-editor{width:100%;min-height:200px;background:#0a0b12;border:1px solid rgba(99,102,241,.2);border-radius:10px;padding:16px;color:#e2e8f0;font-family:monospace;font-size:13px;line-height:1.7;outline:none;resize:vertical;}
.code-editor:focus{border-color:rgba(99,102,241,.45);}
`;

// ─── Icons ────────────────────────────────────────────────────────────────────
const Svg = ({ children, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);
const Icons = {
  Brain:    () => <Svg><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/></Svg>,
  Mic:      ({ size=18 }) => <Svg size={size}><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></Svg>,
  Chart:    () => <Svg><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></Svg>,
  Code:     () => <Svg><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></Svg>,
  Camera:   () => <Svg><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></Svg>,
  Shield:   () => <Svg><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></Svg>,
  Upload:   () => <Svg><path d="M12 13v8"/><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="m8 17 4-4 4 4"/></Svg>,
  Arrow:    () => <Svg><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></Svg>,
  Play:     () => <Svg><polygon points="6 3 20 12 6 21 6 3"/></Svg>,
  Spin:     ({ size=18 }) => <svg width={size} height={size} viewBox="0 0 24 24" style={{animation:"spin .8s linear infinite"}}><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="40" strokeDashoffset="30"/></svg>,
  Database: () => <Svg><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></Svg>,
  Search:   () => <Svg><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></Svg>,
  Home:     () => <Svg><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></Svg>,
  User:     () => <Svg><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></Svg>,
  Terminal: () => <Svg><polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/></Svg>,
};

// ─── Shared Components ────────────────────────────────────────────────────────
function AudioBars({ active }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:3, height:20 }}>
      {[0.3,0.7,1,0.5,0.8,0.4,0.6].map((d,i) => (
        <div key={i} style={{ width:3, height:"100%", borderRadius:2, transformOrigin:"bottom", background:active?"linear-gradient(to top,#6366f1,#06b6d4)":"#52525b", animation:active?`wave .8s ease-in-out ${d*.15}s infinite`:"none", transform:active?undefined:"scaleY(0.25)", opacity:active?1:0.4, transition:"all .3s" }}/>
      ))}
    </div>
  );
}

function WeightedBar({ score, color }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(score*10), 100); return () => clearTimeout(t); }, [score]);
  return (
    <div style={{ height:6, background:"rgba(255,255,255,.07)", borderRadius:4, overflow:"hidden" }}>
      <div style={{ height:"100%", width:`${w}%`, background:`linear-gradient(90deg,${color},#06b6d4)`, borderRadius:4, transition:"width .9s cubic-bezier(.4,0,.2,1)" }}/>
    </div>
  );
}

function EvaluationBreakdown({ scores, weighted_total }) {
  return (
    <div className="card" style={{ border:"1px solid rgba(99,102,241,.22)" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
        <h3 style={{ fontSize:13, fontWeight:700, color:"#a1a1aa", textTransform:"uppercase", letterSpacing:".07em" }}>Weighted Evaluation</h3>
        <div style={{ display:"flex", alignItems:"baseline", gap:3 }}>
          <span style={{ fontSize:28, fontWeight:800, color:"#6366f1" }}>{weighted_total?.toFixed(1)}</span>
          <span style={{ fontSize:12, color:"#52525b" }}>/10</span>
        </div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
        {EVAL_METRICS.map(m => {
          const s = scores?.[m.key] ?? 0;
          return (
            <div key={m.key}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:m.color }}/>
                  <span style={{ fontSize:13, color:"#f4f4f5" }}>{m.label}</span>
                  <span style={{ fontSize:10, color:"#52525b", background:"rgba(255,255,255,.05)", padding:"1px 6px", borderRadius:4 }}>{(m.weight*100).toFixed(0)}%</span>
                </div>
                <span style={{ fontSize:12, color:m.color, fontFamily:"monospace" }}>{s}/10</span>
              </div>
              <WeightedBar score={s} color={m.color}/>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Proctoring Panel ─────────────────────────────────────────────────────────
function ProctoringPanel({ active, onStatsChange, enableVoiceDetection = false }) {
  const videoRef = useRef();
  const [status, setStatus] = useState("idle");
  const [alerts, setAlerts] = useState([]);
  const [tabViolations, setTabViolations] = useState(0);
  const [faceStatus, setFaceStatus] = useState("waiting");
  const [missingCount, setMissingCount] = useState(0);
  const [multipleCount, setMultipleCount] = useState(0);
  const [voiceDetections, setVoiceDetections] = useState(0);
  const faceCheckRef = useRef();
  const streamRef = useRef();
  const lastAlertKeyRef = useRef("");
  const detectorRef = useRef(null);
  const browserDetectorRef = useRef(null);
  const detectorInitRef = useRef(null);
  const faceStatusRef = useRef("waiting");
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const audioDataRef = useRef(null);
  const voiceDetectedRef = useRef(false);

  const addAlert = useCallback((msg, type="warn") => {
    setAlerts(a => [{ id:Date.now(), msg, type, time:new Date().toLocaleTimeString() }, ...a].slice(0,10));
  }, []);

  const addAlertOnce = useCallback((key, msg, type="warn") => {
    if (lastAlertKeyRef.current === key) return;
    lastAlertKeyRef.current = key;
    addAlert(msg, type);
  }, [addAlert]);

  const updateFaceState = useCallback((nextStatus, alertKey, alertMessage, alertType="danger") => {
    const prevStatus = faceStatusRef.current;
    faceStatusRef.current = nextStatus;
    setFaceStatus(nextStatus);

    if (nextStatus === "missing" && prevStatus !== "missing") {
      setMissingCount(count => count + 1);
    }
    if (nextStatus === "multiple" && prevStatus !== "multiple") {
      setMultipleCount(count => count + 1);
    }
    if (alertKey && alertMessage) {
      addAlertOnce(alertKey, alertMessage, alertType);
    }
  }, [addAlertOnce]);

  const initFaceDetector = useCallback(async () => {
    if (detectorRef.current) return detectorRef.current;
    if (detectorInitRef.current) return detectorInitRef.current;

    detectorInitRef.current = (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        detectorRef.current = await MediaPipeFaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          minDetectionConfidence: 0.5,
        });
        addAlertOnce("face-ai-ready", "AI face detection enabled", "info");
        return detectorRef.current;
      } catch {
        addAlertOnce("face-ai-fallback", "AI face detection unavailable, using browser fallback", "warn");
        return null;
      }
    })();

    return detectorInitRef.current;
  }, [addAlertOnce]);

  // Tab switch detection
  useEffect(() => {
    if (!active) return;
    const onBlur = () => setTabViolations(v => { const n=v+1; addAlert(`Tab switch #${n}`,"danger"); return n; });
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [active, addAlert]);

  const startCamera = useCallback(async () => {
    setStatus("loading");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video:true, audio:enableVoiceDetection });
      const track = stream.getVideoTracks()[0];
      const FaceDetectorCtor = window.FaceDetector;
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setStatus("ready");
      updateFaceState("detected");
      lastAlertKeyRef.current = "camera-ready";
      addAlert("Webcam active — proctoring started","info");

      await initFaceDetector();

      if (FaceDetectorCtor && !browserDetectorRef.current) {
        browserDetectorRef.current = new FaceDetectorCtor({ fastMode: true, maxDetectedFaces: 2 });
      }

      if (enableVoiceDetection) {
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx && !audioContextRef.current) {
            const audioContext = new AudioCtx();
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 1024;
            const source = audioContext.createMediaStreamSource(new MediaStream(audioTracks));
            source.connect(analyser);
            audioContextRef.current = audioContext;
            analyserRef.current = analyser;
            audioDataRef.current = new Uint8Array(analyser.frequencyBinCount);
          }
        } else {
          addAlertOnce("voice-mic-missing", "Microphone unavailable for ambient voice detection", "warn");
        }
      }

      if (track) {
        track.onended = () => {
          setStatus("error");
          updateFaceState("missing", "camera-ended", "Camera turned off or disconnected");
        };
        track.onmute = () => {
          updateFaceState("missing", "camera-muted", "Camera feed lost");
        };
        track.onunmute = () => {
          setStatus("ready");
          updateFaceState("detected");
          lastAlertKeyRef.current = "camera-ready";
        };
      }

      clearInterval(faceCheckRef.current);
      faceCheckRef.current = setInterval(async () => {
        const currentStream = streamRef.current;
        const currentTrack = currentStream?.getVideoTracks?.()[0];
        const video = videoRef.current;
        const missingFeed = !currentTrack || currentTrack.readyState !== "live" || currentTrack.muted || !currentTrack.enabled;
        const missingFrames = !video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0 || video.paused || video.ended;
        const analyser = analyserRef.current;
        const audioData = audioDataRef.current;

        if (missingFeed || missingFrames) {
          setStatus("error");
          updateFaceState("missing", "face-missing-feed", "Face not detected or camera feed unavailable");
          return;
        }

        if (detectorRef.current) {
          try {
            const result = detectorRef.current.detectForVideo(video, performance.now());
            const faces = result?.detections || [];
            if (!faces.length) {
              setStatus("ready");
              updateFaceState("missing", "face-missing", "Face not detected");
              return;
            }
            if (faces.length > 1) {
              setStatus("ready");
              updateFaceState("multiple", "face-multiple", "Multiple faces detected");
              return;
            }
          } catch {
            addAlertOnce("face-detector-error", "AI detector unavailable, checking browser fallback", "warn");
          }
        }

        if (!detectorRef.current && browserDetectorRef.current) {
          try {
            const faces = await browserDetectorRef.current.detect(video);
            if (!faces.length) {
              setStatus("ready");
              updateFaceState("missing", "face-missing", "Face not detected");
              return;
            }
            if (faces.length > 1) {
              setStatus("ready");
              updateFaceState("multiple", "face-multiple", "Multiple faces detected");
              return;
            }
          } catch {
            addAlertOnce("face-browser-fallback-error", "Browser face detector unavailable, using camera fallback", "warn");
          }
        }

        if (enableVoiceDetection && analyser && audioData) {
          analyser.getByteFrequencyData(audioData);
          const avgVolume = audioData.reduce((sum, value) => sum + value, 0) / audioData.length;
          const voiceDetected = avgVolume > 22;

          if (voiceDetected && !voiceDetectedRef.current) {
            voiceDetectedRef.current = true;
            setVoiceDetections(count => count + 1);
            addAlertOnce(`voice-${Date.now()}`, "Ambient voice detected near candidate", "danger");
          } else if (!voiceDetected) {
            voiceDetectedRef.current = false;
          }
        }

        setStatus("ready");
        updateFaceState("detected");
        lastAlertKeyRef.current = "camera-ready";
      }, 4000);
    } catch {
      setStatus("error");
      updateFaceState("missing", "camera-denied", "Camera permission denied", "warn");
    }
  }, [addAlert, addAlertOnce, enableVoiceDetection, initFaceDetector, updateFaceState]);

  // AUTO-START camera when active becomes true
  useEffect(() => {
    if (active && status === "idle") {
      startCamera();
    }
  }, [active, status, startCamera]);

  // Cleanup on unmount
  useEffect(() => () => {
    clearInterval(faceCheckRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioContextRef.current?.close?.();
  }, []);

  useEffect(() => {
    onStatsChange?.({
      tabSwitches: tabViolations,
      faceNotDetected: missingCount,
      multipleFaces: multipleCount,
      voiceDetections,
    });
  }, [tabViolations, missingCount, multipleCount, voiceDetections, onStatsChange]);

  const faceColor = { detected:"#22c55e", missing:"#ef4444", multiple:"#f59e0b", waiting:"#52525b" }[faceStatus];

  return (
    <div className="card" style={{ border:"1px solid rgba(99,102,241,.2)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
        <div style={{ color:status==="ready"?"#22c55e":"#f59e0b" }}><Icons.Shield/></div>
        <span style={{ fontSize:13, fontWeight:700 }}>Proctoring</span>
        <span style={{ marginLeft:"auto", fontSize:11, color:status==="ready"?"#22c55e":"#52525b" }}>
          {status==="ready"?"● Active":status==="loading"?"⏳ Starting...":status==="error"?"✗ Error":"○ Waiting"}
        </span>
      </div>
      <div style={{ position:"relative", borderRadius:10, overflow:"hidden", background:"#070810", marginBottom:14, aspectRatio:"4/3" }}>
        <video ref={videoRef} autoPlay muted playsInline style={{ width:"100%", height:"100%", objectFit:"cover", display:status==="ready"?"block":"none" }}/>
        {status !== "ready" && (
          <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10, color:"#52525b" }}>
            {status==="loading"?<Icons.Spin size={28}/>:<Icons.Camera/>}
            <p style={{ fontSize:12 }}>{status==="error"?"Camera unavailable or turned off":status==="loading"?"Starting camera...":"Waiting..."}</p>
          </div>
        )}
        {status === "ready" && (
          <>
            <div style={{ position:"absolute", left:0, right:0, height:2, background:"linear-gradient(90deg,transparent,#6366f1,transparent)", opacity:.5, animation:"scanline 3s linear infinite", top:0 }}/>
            <div style={{ position:"absolute", bottom:8, left:8, padding:"3px 8px", borderRadius:6, background:"rgba(0,0,0,.7)", fontSize:11, color:faceColor }}>
              ● {faceStatus==="detected"?"Face OK":faceStatus==="multiple"?"Multiple faces":"No face"}
            </div>
            <div style={{ position:"absolute", top:8, right:8, padding:"2px 7px", borderRadius:5, background:"rgba(239,68,68,.8)", fontSize:10, color:"#fff", fontWeight:600 }}>● REC</div>
          </>
        )}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:`repeat(${enableVoiceDetection ? 4 : 3},1fr)`, gap:8, marginBottom:14 }}>
        {[
          ["Switches",tabViolations,tabViolations>0],
          ["Face",faceStatus==="detected"?"OK":"!",faceStatus!=="detected"],
          ["Camera",status==="ready"?"On":"Off",status!=="ready"],
          ...(enableVoiceDetection ? [["Voice",voiceDetections,voiceDetections>0]] : []),
        ].map(([l,v,bad]) => (
          <div key={l} style={{ padding:"8px", borderRadius:8, background:"rgba(255,255,255,.03)", border:`1px solid ${bad?"rgba(239,68,68,.25)":"rgba(255,255,255,.07)"}`, textAlign:"center" }}>
            <p style={{ fontSize:15, fontWeight:700, color:bad?"#ef4444":"#22c55e" }}>{v}</p>
            <p style={{ fontSize:10, color:"#52525b" }}>{l}</p>
          </div>
        ))}
      </div>
      {alerts.length > 0 && (
        <div style={{ maxHeight:130, overflowY:"auto", display:"flex", flexDirection:"column", gap:4 }}>
          {alerts.map(a => (
            <div key={a.id} style={{ display:"flex", gap:6, padding:"5px 8px", borderRadius:6, background:a.type==="danger"?"rgba(239,68,68,.08)":"rgba(99,102,241,.08)", fontSize:10 }}>
              <span style={{ color:a.type==="danger"?"#ef4444":"#818cf8", flex:1 }}>{a.msg}</span>
              <span style={{ color:"#52525b" }}>{a.time}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── RAG Panel ────────────────────────────────────────────────────────────────
function RAGPanel({ onSelectQuestion }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [kb, setKb] = useState({});
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    get("/rag-kb").then(d => setKb(d.kb)).catch(() => {});
  }, []);

  const semanticSearch = async (q) => {
    if (!q.trim()) return;
    setIsSearching(true);
    try {
      const data = await post("/rag-search", { query: q });
      setResults(data.results);
    } catch { setResults([]); }
    finally { setIsSearching(false); }
  };

  const allQs = Object.entries(kb).flatMap(([cat, qs]) => qs.map(q => ({ cat, q })));

  return (
    <div className="card" style={{ border:"1px solid rgba(6,182,212,.18)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
        <div style={{ color:"#06b6d4" }}><Icons.Database/></div>
        <span style={{ fontSize:13, fontWeight:700 }}>RAG Knowledge Base</span>
        <span className="tag tag-cyan" style={{ marginLeft:"auto", fontSize:10 }}>{allQs.length} entries</span>
      </div>
      <div style={{ display:"flex", gap:8, marginBottom:12 }}>
        <input className="input" style={{ flex:1 }} placeholder="Search semantically…" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key==="Enter" && semanticSearch(query)}/>
        <button className="btn btn-ghost" style={{ padding:"9px 12px" }} onClick={() => semanticSearch(query)} disabled={isSearching}>
          {isSearching?<Icons.Spin/>:<Icons.Search/>}
        </button>
      </div>
      {results.length === 0 && (
        <div style={{ marginBottom:12, padding:10, borderRadius:9, background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.07)" }}>
          <p style={{ fontSize:12, color:"#a1a1aa", lineHeight:1.5 }}>
            Search the knowledge base to see suggested questions here.
          </p>
        </div>
      )}
      {results.length > 0 && (
        <div style={{ marginBottom:12, padding:10, borderRadius:9, background:"rgba(6,182,212,.05)", border:"1px solid rgba(6,182,212,.18)" }}>
          <p style={{ fontSize:11, color:"#06b6d4", fontWeight:600, marginBottom:8 }}>⚡ Matches</p>
          {results.map((r,i) => (
            <div key={i} style={{ display:"flex", gap:8, padding:"7px 9px", borderRadius:7, background:"rgba(255,255,255,.03)", marginBottom:5, cursor:"pointer" }} onClick={() => onSelectQuestion?.(r.q)}>
              <span className="tag tag-cyan" style={{ fontSize:10, flexShrink:0 }}>{r.cat}</span>
              <p style={{ fontSize:12, color:"#a1a1aa", flex:1 }}>{r.q}</p>
              <button className="btn btn-ghost" style={{ padding:"2px 7px", fontSize:11 }}>Use</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Language configs ─────────────────────────────────────────────────────────
const LANGUAGES = {
  javascript: { label:"JavaScript", comment:"// ", starter:(fn)=>`function ${fn}() {\n  // Your solution here\n\n}` },
  python:     { label:"Python",     comment:"# ",  starter:(fn)=>`def ${fn}():\n    # Your solution here\n    pass` },
  java:       { label:"Java",       comment:"// ", starter:(fn)=>`public class Solution {\n    public static void ${fn}() {\n        // Your solution here\n    }\n}` },
  c:          { label:"C",          comment:"// ", starter:(fn)=>`#include <stdio.h>\n\nvoid ${fn}() {\n    // Your solution here\n}` },
  cpp:        { label:"C++",        comment:"// ", starter:(fn)=>`#include <bits/stdc++.h>\nusing namespace std;\n\nvoid ${fn}() {\n    // Your solution here\n}` },
};

// ─── Coding Interview Mode ────────────────────────────────────────────────────
const toFiniteNumber = (value) => {
  const numeric = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(numeric) ? numeric : null;
};

const getCodingAnalysisScore = (analysis) => {
  if (!analysis) return null;

  const overall = toFiniteNumber(analysis.overall_score);
  if (overall !== null) return overall;

  const partialScores = [analysis.correctness, analysis.code_quality]
    .map(toFiniteNumber)
    .filter(value => value !== null);

  if (!partialScores.length) return null;
  return partialScores.reduce((sum, value) => sum + value, 0) / partialScores.length;
};

const getCodingOutputScore = (output) => {
  const text = typeof output === "string" ? output.trim() : "";
  if (!text) return null;

  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const normalizedText = text.toLowerCase();
  const testLines = lines.filter(line => /test\s*\d+/i.test(line));
  const relevantLines = testLines.length > 0 ? testLines : lines;

  let passed = 0;
  let failed = 0;

  relevantLines.forEach(line => {
    const normalized = line.toLowerCase();
    if (
      normalized.includes("pass") ||
      normalized.includes("passed") ||
      normalized.includes("works correctly") ||
      normalized.includes("match") ||
      normalized.includes("✓")
    ) {
      passed += 1;
      return;
    }
    if (
      normalized.includes("fail") ||
      normalized.includes("failed") ||
      normalized.includes("error") ||
      normalized.includes("incorrect") ||
      normalized.includes("no runnable solution")
    ) {
      failed += 1;
    }
  });

  const total = passed + failed;
  if (!total) {
    if (
      normalizedText.includes("all tests passed") ||
      normalizedText.includes("both tests passed") ||
      normalizedText.includes("results match expected output") ||
      normalizedText.includes("pattern matching works as expected")
    ) {
      return 10;
    }
    if (
      normalizedText.includes("tests failed") ||
      normalizedText.includes("test failed") ||
      normalizedText.includes("does not match expected")
    ) {
      return 0;
    }
  }
  if (!total) return null;
  return (passed / total) * 10;
};

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((value || "").trim());
const hasSpecialCharacter = (value) => /[^A-Za-z0-9]/.test(value || "");

const getRecommendationForScore = (score) => {
  const normalized = normalizeScoreToPercent(score);
  if (normalized >= 85) return "Strong Hire";
  if (normalized >= 70) return "Hire";
  if (normalized >= 50) return "Maybe Hire";
  return "No Hire";
};

const clampScoreOutOf10 = (value) => {
  const numeric = toFiniteNumber(value);
  if (numeric === null) return 0;
  const scaled = numeric > 10 ? numeric / 10 : numeric;
  return Number(Math.max(0, Math.min(10, scaled)).toFixed(1));
};

const normalizeScoreToPercent = (value) => {
  const numeric = toFiniteNumber(value);
  if (numeric === null) return 0;
  const scaled =
    numeric > 0 && numeric <= 1
      ? numeric * 100
      : numeric > 0 && numeric <= 10
        ? numeric * 10
        : numeric;
  return Number(Math.max(0, Math.min(100, scaled)).toFixed(1));
};

const getInterviewDisplayScore = (interview) => {
  const savedScore = toFiniteNumber(interview?.score);
  const normalizedSavedScore = savedScore === null ? null : Math.max(0, Math.min(100, savedScore));
  const codingProblems = interview?.coding?.problems || [];
  const totalQuestions = Math.max(
    toFiniteNumber(interview?.coding?.total_questions) || 0,
    codingProblems.length
  );
  const codingScores = codingProblems
    .map(problem => getCodingAnalysisScore(problem.analysis) ?? getCodingOutputScore(problem.testcase_output));

  if (totalQuestions > 0 && codingScores.some(score => score !== null)) {
    const totalScore = codingScores.reduce((sum, score) => sum + (score ?? 0), 0);
    const derivedCodingScore = Number(((totalScore / totalQuestions) * 10).toFixed(1));
    if (normalizedSavedScore === null || normalizedSavedScore <= 0) {
      return derivedCodingScore;
    }
  }

  return normalizedSavedScore ?? 0;
};

const normalizeInterviewForDisplay = (interview) => {
  const score = getInterviewDisplayScore(interview);
  return {
    ...interview,
    score,
    recommendation: getRecommendationForScore(score),
  };
};

function CodingInterviewMode() {
  const interviewRole = sessionStorage.getItem("codingRole") || "Software Engineer";
  const interviewLevel = sessionStorage.getItem("codingLevel") || "Mid-level";
  const [problemIdx, setProblemIdx] = useState(0);
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("");
  const [output, setOutput] = useState("");
  const [analysis] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isAnalyzing] = useState(false);
  const [isGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab] = useState("problem");
  const [resumeText] = useState("");
  const [codingRecords, setCodingRecords] = useState({});
  const [codingProctoring, setCodingProctoring] = useState({ tabSwitches: 0, faceNotDetected: 0, multipleFaces: 0, voiceDetections: 0 });
  const fileRef = useRef(null);

  const setTab = () => {};
  const handleResumeUpload = () => {};
  const generateProblems = () => {};
  const analyzeCode = () => {};

  const allProblems = getRoleBasedCodingProblems(interviewRole, interviewLevel);
  const problem = allProblems[problemIdx] || allProblems[0];
  const isLastProblem = problemIdx >= allProblems.length - 1;

  const saveProblemState = useCallback((problemData, next = {}) => {
    if (!problemData?.title) return;
    setCodingRecords(prev => ({
      ...prev,
      [problemData.title]: {
        title: problemData.title,
        difficulty: problemData.difficulty,
        tags: problemData.tags || [],
        description: problemData.description,
        examples: problemData.examples || [],
        language,
        code,
        output,
        ...prev[problemData.title],
        ...next,
      },
    }));
  }, [code, language, output]);

  // When language or problem changes, update starter code
  useEffect(() => {
    if (!problem) return;
    const fnName = problem.title.replace(/\s+/g,"").replace(/[^a-zA-Z0-9]/g,"");
    const langCfg = LANGUAGES[language];
    const starter = langCfg.starter(fnName.charAt(0).toLowerCase()+fnName.slice(1));
    const existing = codingRecords[problem.title];
    setCode(existing?.code || starter);
    setOutput(existing?.output || "");
  }, [codingRecords, language, problem]);

  const runCode = async () => {
    setIsRunning(true); setOutput("");
    try {
      const data = await post("/run-code", { problem_title: problem.title, code, examples: problem.examples, language });
      setOutput(data.output);
      saveProblemState(problem, { code, output: data.output });
    } catch (e) { setOutput("Error: " + e.message); }
    finally { setIsRunning(false); }
  };

  const saveCodingRound = async () => {
    if (isSaving) return;
    const problems = allProblems.map((p, index) => {
      const record = codingRecords[p.title] || {};
      return {
        order: index + 1,
        title: p.title,
        difficulty: p.difficulty,
        tags: p.tags || [],
        description: p.description,
        examples: p.examples || [],
        language: record.language || language,
        code: record.code || "",
        testcase_output: record.output || "",
        analysis: null,
      };
    });

    const completed = problems.filter(p => p.code || p.testcase_output);
    if (!completed.length) return;

    const totalQuestions = Math.max(allProblems.length, problems.length);
    const totalScore = problems.reduce(
      (sum, p) => sum + (getCodingOutputScore(p.testcase_output) ?? 0),
      0
    );
    const avgScore = Math.round((totalScore / totalQuestions) * 10);

    setIsSaving(true);
    try {
      await post("/interviews/save", {
        role: `Coding Round (${language})`,
        score: avgScore,
        recommendation: getRecommendationForScore(avgScore),
        skills: [],
        summary: `Coding round completed with ${completed.length} worked problem${completed.length === 1 ? "" : "s"} in ${language}.`,
        strengths: [],
        improvements: [],
        scores: {},
        proctoring: {},
        qa: [],
        coding: {
          language,
          total_questions: allProblems.length,
          problems,
          proctoring: codingProctoring,
        },
      }, true);
      setSaved(true);
    } catch (e) {
      console.error("Coding round save failed:", e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const goToNextProblem = () => {
    if (isLastProblem) return;
    saveProblemState(problem, { code, output });
    setProblemIdx(idx => Math.min(idx + 1, allProblems.length - 1));
    setSaved(false);
  };

  const outputLines = output ? output.split("\n") : [];
  const getOutputLineColor = (line) => {
    const normalized = line.toLowerCase();
    if (
      normalized.includes("fail") ||
      normalized.includes("failed") ||
      normalized.includes("error") ||
      normalized.includes("incorrect") ||
      normalized.includes("no runnable solution")
    ) return "#f87171";
    if (
      normalized.includes("pass") ||
      normalized.includes("passed") ||
      normalized.includes("match") ||
      normalized.includes("works correctly") ||
      normalized.includes("✓")
    ) return "#a3e635";
    return "#cbd5e1";
  };

  const diffColor = { Easy:"#22c55e", Medium:"#f59e0b", Hard:"#ef4444" };
  const verdictColor = { Optimal:"#22c55e", Good:"#06b6d4", Acceptable:"#f59e0b", "Needs Work":"#ef4444" };

  return (
    <div>
      {/* Top controls: problem tabs + language + resume AI generate */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {allProblems.map((p,i) => (
            <button key={i} onClick={() => { saveProblemState(problem, { code, output }); setProblemIdx(i); setSaved(false); }} className="btn btn-ghost"
              style={{ background:problemIdx===i?"rgba(99,102,241,.15)":undefined, border:problemIdx===i?"1px solid rgba(99,102,241,.35)":undefined, color:problemIdx===i?"#818cf8":"#a1a1aa", fontSize:12 }}>
              {p.title} <span style={{ fontSize:9, padding:"1px 5px", borderRadius:4, background:`${diffColor[p.difficulty]||"#6366f1"}18`, color:diffColor[p.difficulty]||"#818cf8" }}>{p.difficulty}</span>
            </button>
          ))}
        </div>
        <div style={{ display:"none", fontSize:12, color:"#71717a" }}>
          Prepared coding set only. Run your code and submit the round when you finish.
          Prepared coding set only. Run your code and submit the round when you finish.
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1.2fr 280px", gap:16, alignItems:"start" }}>
        <div>
          <div style={{ display:"flex", gap:1, marginBottom:12, background:"rgba(255,255,255,.03)", borderRadius:9, padding:3, border:"1px solid rgba(255,255,255,.07)" }}>
            {["problem"].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ flex:1, padding:"7px 0", fontSize:12, borderRadius:7, border:"none", cursor:"pointer", textTransform:"capitalize", background:tab===t?"#6366f1":"transparent", color:tab===t?"#fff":"#52525b", transition:"all .15s", fontFamily:"inherit" }}>{t}</button>
            ))}
          </div>
          {tab === "problem" && (
            <div className="card">
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                <h3 style={{ fontSize:15, fontWeight:700 }}>{problem.title}</h3>
                <span style={{ padding:"2px 8px", borderRadius:6, fontSize:11, background:`${diffColor[problem.difficulty]||"#6366f1"}18`, color:diffColor[problem.difficulty]||"#818cf8", fontWeight:600 }}>{problem.difficulty}</span>
              </div>
              <div style={{ display:"flex", gap:5, marginBottom:10, flexWrap:"wrap" }}>{(problem.tags||[]).map(t => <span key={t} className="tag">{t}</span>)}</div>
              <p style={{ fontSize:13, color:"#a1a1aa", lineHeight:1.65, marginBottom:12 }}>{problem.description}</p>
              {(problem.examples||[]).map((ex,i) => <div key={i} style={{ padding:"7px 10px", borderRadius:7, background:"rgba(0,0,0,.3)", fontFamily:"monospace", fontSize:11, color:"#a1a1aa", marginBottom:5 }}>{ex}</div>)}
            </div>
          )}
          {tab === "analysis" && analysis ? (
            <div className="card" style={{ border:"1px solid rgba(99,102,241,.2)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <h3 style={{ fontSize:14, fontWeight:700 }}>Analysis</h3>
                <div style={{ padding:"3px 10px", borderRadius:20, background:`${verdictColor[analysis.verdict]}18`, border:`1px solid ${verdictColor[analysis.verdict]}35`, color:verdictColor[analysis.verdict], fontSize:12, fontWeight:700 }}>{analysis.verdict}</div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
                {[["Time",analysis.time_complexity],["Space",analysis.space_complexity],["Correctness",`${analysis.correctness}/10`],["Quality",`${analysis.code_quality}/10`]].map(([k,v]) => (
                  <div key={k} style={{ padding:"8px 10px", borderRadius:8, background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.07)" }}>
                    <p style={{ fontSize:11, color:"#52525b", marginBottom:3 }}>{k}</p>
                    <p style={{ fontSize:12, color:"#818cf8", fontFamily:"monospace" }}>{v}</p>
                  </div>
                ))}
              </div>
              {analysis.suggestions?.length > 0 && <div>{analysis.suggestions.map((s,i) => <p key={i} style={{ fontSize:12, color:"#a1a1aa", marginBottom:4 }}>· {s}</p>)}</div>}
            </div>
          ) : tab === "analysis" && (
            <div className="card" style={{ textAlign:"center", padding:"40px", color:"#52525b" }}>
              <p style={{ fontSize:13 }}>Click AI Analyze to see results</p>
            </div>
          )}
        </div>
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            {/* Language selector */}
            <div style={{ display:"flex", gap:4 }}>
              {Object.entries(LANGUAGES).map(([key, cfg]) => (
                <button key={key} onClick={() => { saveProblemState(problem); setLanguage(key); setSaved(false); }} className="btn btn-ghost"
                  style={{ padding:"4px 9px", fontSize:11, background:language===key?"rgba(99,102,241,.2)":undefined, color:language===key?"#818cf8":"#52525b", border:language===key?"1px solid rgba(99,102,241,.35)":"1px solid transparent" }}>
                  {cfg.label}
                </button>
              ))}
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={runCode} disabled={isRunning}>{isRunning?<><Icons.Spin/>Running…</>:<><Icons.Play/>Run</>}</button>
              <button className="btn btn-primary" style={{ display:"none", fontSize:12 }} onClick={analyzeCode} disabled={isAnalyzing}>{isAnalyzing?<><Icons.Spin/>Analyzing…</>:"AI Analyze →"}</button>
            </div>
          </div>
          <textarea className="code-editor" value={code} onChange={e => { setCode(e.target.value); setSaved(false); }}
            onKeyDown={e => { if(e.key==="Tab"){e.preventDefault();const s=e.target.selectionStart;setCode(code.substring(0,s)+"  "+code.substring(s));setTimeout(()=>{e.target.selectionStart=e.target.selectionEnd=s+2},0)} }}
            spellCheck={false}/>
          <div style={{ marginTop:10, borderRadius:9, background:"#050609", border:"1px solid rgba(255,255,255,.07)", padding:"12px 14px", minHeight:70 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:output?"#22c55e":"#52525b" }}/>
              <span style={{ fontSize:11, color:"#52525b" }}>Console</span>
            </div>
            {output ? (
              <pre style={{ fontSize:12, fontFamily:"monospace", whiteSpace:"pre-wrap" }}>
                {outputLines.map((line, index) => (
                  <div key={`${index}-${line}`} style={{ color:getOutputLineColor(line) }}>
                    {line || " "}
                  </div>
                ))}
              </pre>
            ) : <p style={{ fontSize:12, color:"#52525b", fontStyle:"italic" }}>Run code to see output…</p>}
          </div>
          <div style={{ marginTop:10, padding:"10px 14px", borderRadius:9, background:saved?"rgba(34,197,94,.08)":"rgba(99,102,241,.06)", border:`1px solid ${saved?"rgba(34,197,94,.2)":"rgba(99,102,241,.2)"}`, fontSize:12, color:saved?"#4ade80":"#818cf8" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
              <span>
                {isSaving
                  ? "⏳ Submitting coding round..."
                  : saved
                    ? "✅ Coding round submitted to HR dashboard"
                    : isLastProblem
                      ? "Final question reached. Submit after reviewing your code."
                      : `Question ${problemIdx + 1} of ${allProblems.length}. Move to the next coding question when ready.`}
              </span>
              {isLastProblem ? (
                <button className="btn btn-primary" style={{ fontSize:11, padding:"7px 12px" }} onClick={saveCodingRound} disabled={isSaving}>
                  {isSaving?<Icons.Spin size={14}/>:"Submit Coding Round"}
                </button>
              ) : (
                <button className="btn btn-primary" style={{ fontSize:11, padding:"7px 12px" }} onClick={goToNextProblem}>
                  Next Question →
                </button>
              )}
            </div>
          </div>
        </div>
        <ProctoringPanel active={true} enableVoiceDetection={true} onStatsChange={setCodingProctoring}/>
      </div>
    </div>
  );
}

// ─── Save Interview Button ────────────────────────────────────────────────────
function SaveInterviewButton({ report, role, proctoring, qa }) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const saveInterview = async () => {
    if (saved || saving) return;
    setSaving(true);
    try {
      const normalizedScore = clampScoreOutOf10(report?.weighted_total);
      await post("/interviews/save", {
        role,
        score: normalizeScoreToPercent(normalizedScore),
        recommendation: getRecommendationForScore(normalizedScore),
        skills: [],
        summary: report.summary || "",
        strengths: report.strengths || [],
        improvements: report.improvements || [],
        scores: report.metric_scores || {},
        proctoring: proctoring || {},
        qa: qa || [],
      }, true);
      setSaved(true);
    } catch (e) {
      console.error("Save failed:", e.message);
    } finally { setSaving(false); }
  };

  // Auto-save when component mounts
  useEffect(() => { saveInterview(); }, []);

  return (
    <div style={{ padding:"10px 14px", borderRadius:9, background:saved?"rgba(34,197,94,.08)":"rgba(99,102,241,.06)", border:`1px solid ${saved?"rgba(34,197,94,.2)":"rgba(99,102,241,.2)"}`, fontSize:12, color:saved?"#4ade80":"#818cf8", marginBottom:4 }}>
      {saving?"⏳ Saving to HR Dashboard...":saved?"✅ Saved to HR Dashboard":"💾 Save to HR Dashboard"}
    </div>
  );
}

// ─── Interview Page ───────────────────────────────────────────────────────────
const INTERVIEW_DURATION_MS = 25 * 60 * 1000; // 25 minutes

function InterviewPage({ onFinish, onStartCoding }) {
  const [step, setStep] = useState("setup");
  const [role, setRole] = useState("Software Engineer");
  const [resumeText, setResumeText] = useState("");
  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);
  const [proctoringStats, setProctoringStats] = useState({ tabSwitches: 0, faceNotDetected: 0, multipleFaces: 0 });
  const recognitionRef = useRef();
  const fileRef = useRef();
  const preferredVoiceRef = useRef(null);

  // Timer state
  const [timeElapsed, setTimeElapsed] = useState(0);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const timerExpiredRef = useRef(false);  // flag: timer hit 25 min
  const isAnsweringRef = useRef(false);   // flag: candidate currently answering (loading)
  const pendingAutoSubmitRef = useRef(false); // flag: waiting to auto-submit after answer done

  // Dynamic follow-up question generation
  const isGeneratingFollowUpRef = useRef(false);

  useEffect(() => {
    if (!window.speechSynthesis) return;
    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices() || [];
      const femaleVoice = voices.find(voice =>
        /^en/i.test(voice.lang || "") &&
        /(female|woman|zira|aria|samantha|victoria|karen|moira|ava|allison|jenny|susan)/i.test(voice.name || "")
      );
      preferredVoiceRef.current =
        femaleVoice ||
        voices.find(voice => /^en/i.test(voice.lang || "")) ||
        voices[0] ||
        null;
    };
    pickVoice();
    window.speechSynthesis.addEventListener?.("voiceschanged", pickVoice);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", pickVoice);
  }, []);

  // Start countdown timer when interview begins
  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerExpiredRef.current = false;
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setTimeElapsed(elapsed);
      if (elapsed >= INTERVIEW_DURATION_MS && !timerExpiredRef.current) {
        timerExpiredRef.current = true;
        // If currently processing an answer, set pending flag; else finish now
        if (isAnsweringRef.current || pendingAutoSubmitRef.current) {
          pendingAutoSubmitRef.current = true;
        } else {
          // Trigger finish: submit current transcript if any, otherwise generate report
          triggerTimerAutoFinish();
        }
      }
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const triggerTimerAutoFinish = useCallback(() => {
    // This is called when timer expires and candidate is NOT speaking
    // We auto-submit whatever they have and finish
    finishInterviewRef.current?.();
  }, []);

  // We use a ref to hold the finishInterview function so it can be called from the timer
  const finishInterviewRef = useRef(null);

  const handleFile = async e => {
    const f = e.target.files[0]; if (!f) return;
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", f);
      const res = await fetch(`${API}/parse-resume`, { method:"POST", body:formData });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || "Upload failed"); }
      const data = await res.json();
      setResumeText(data.text.slice(0, 4000));
    } catch (err) {
      setError("Resume upload failed: " + err.message);
    }
  };

  const speakQuestion = (text, onDone) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (preferredVoiceRef.current) {
      u.voice = preferredVoiceRef.current;
      if (preferredVoiceRef.current.lang) u.lang = preferredVoiceRef.current.lang;
    }
    u.rate = 0.92;
    u.pitch = 1.15;
    u.onstart = () => setIsSpeaking(true);
    u.onend = () => {
      setIsSpeaking(false);
      onDone?.();
    };
    window.speechSynthesis.speak(u);
  };

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError("Speech recognition not available — type your answer."); return; }
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch(e) {} }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = e => setTranscript(Array.from(e.results).map(r => r[0].transcript).join(" "));
    rec.onerror = () => { setIsListening(false); };
    rec.onend = () => {
      if (recognitionRef.current === rec) {
        try { rec.start(); } catch(e) { setIsListening(false); }
      }
    };
    rec.start();
    recognitionRef.current = rec;
    setIsListening(true);
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      const r = recognitionRef.current;
      recognitionRef.current = null;
      try { r.stop(); } catch(e) {}
    }
    setIsListening(false);
  };

  const generateQuestions = async () => {
    setIsLoading(true); setError("");
    try {
      const data = await post("/generate-questions", { role, resume_text: resumeText });
      setQuestions(data.questions);
      setStep("interview");
      startTimer();
      speakQuestion(data.questions[0], startListening);
    } catch (e) {
      setError("Error: " + e.message);
    } finally { setIsLoading(false); }
  };

  // Generate a follow-up question dynamically based on candidate's previous answer
  const generateFollowUpQuestion = async (allQs, prevQuestion, prevAnswer) => {
    if (isGeneratingFollowUpRef.current) return null;
    isGeneratingFollowUpRef.current = true;
    try {
      const data = await post("/generate-followup", {
        role,
        previous_question: prevQuestion,
        previous_answer: prevAnswer,
        resume_text: resumeText,
        questions_asked: allQs,
      });
      return data.question || null;
    } catch {
      return null;
    } finally {
      isGeneratingFollowUpRef.current = false;
    }
  };

  const generateReport = async (allAnswers) => {
    setIsLoading(true);
    try {
      const data = await post("/generate-report", { role, answers: allAnswers, resume_text: resumeText });
      setReport(data);
    } catch {
      setReport({
        overall_score:0,
        recommendation:"No Hire",
        summary:"The report could not be generated.",
        strengths:[],
        improvements:["Retry the interview when the evaluator is available."],
        metric_scores:{ technical_knowledge:0, problem_solving:0, communication_skills:0, project_understanding:0, confidence:0 },
        weighted_total:0,
      });
    } finally { setIsLoading(false); }
  };

  useEffect(() => {
    if (step !== "done" || !report || !onStartCoding) return;
    sessionStorage.setItem("codingRole", role);
    sessionStorage.setItem("codingLevel", "Mid-level");
    const timer = setTimeout(() => onStartCoding(), 2500);
    return () => clearTimeout(timer);
  }, [step, report, role, onStartCoding]);

  // finishInterview: generate report, save, then go to done screen
  const finishInterview = useCallback(async (finalAnswers) => {
    stopTimer();
    stopListening();
    window.speechSynthesis?.cancel();
    setStep("done");
    await generateReport(finalAnswers);
  }, [stopTimer]);

  // Assign ref so timer can call it
  useEffect(() => {
    finishInterviewRef.current = () => {
      // snapshot current answers from state — we can't close over them
      // so we trigger via a flag and handle in the component
      pendingAutoSubmitRef.current = true;
    };
  });

  // Watch for pendingAutoSubmit when not in loading state
  useEffect(() => {
    if (pendingAutoSubmitRef.current && !isAnsweringRef.current && step === "interview") {
      pendingAutoSubmitRef.current = false;
      // Use answersRef to get latest answers
      const finalAnswers = answersRef.current;
      stopTimer();
      stopListening();
      window.speechSynthesis?.cancel();
      setStep("done");
      generateReport(finalAnswers);
    }
  });

  // Keep a ref to answers so the timer callback can access latest state
  const answersRef = useRef([]);
  useEffect(() => { answersRef.current = answers; }, [answers]);

  const submitAnswer = async () => {
    if (!transcript.trim()) return;
    stopListening();
    setIsLoading(true);
    isAnsweringRef.current = true;

    try {
      const fb = await post("/evaluate-answer", { role, question: questions[currentQ], answer: transcript, resume_text: resumeText });
      const nextAnswers = [...answers, { q: questions[currentQ], a: transcript, ...fb }];
      setAnswers(nextAnswers);
      answersRef.current = nextAnswers;
      setTranscript("");

      // Check if timer already expired → auto-submit after this answer
      if (timerExpiredRef.current || pendingAutoSubmitRef.current) {
        isAnsweringRef.current = false;
        pendingAutoSubmitRef.current = false;
        stopTimer();
        stopListening();
        window.speechSynthesis?.cancel();
        setStep("done");
        await generateReport(nextAnswers);
        return;
      }

      const nextQ = currentQ + 1;
      if (nextQ >= questions.length) {
        isAnsweringRef.current = false;
        stopTimer();
        stopListening();
        window.speechSynthesis?.cancel();
        setStep("done");
        await generateReport(nextAnswers);
        return;
      }

      // Check if interview time is still well under limit — continue dynamically
      const elapsed = Date.now() - (startTimeRef.current || Date.now());
      const remaining = INTERVIEW_DURATION_MS - elapsed;

      // If less than 60 seconds remain, finish
      if (remaining < 60000) {
        isAnsweringRef.current = false;
        stopTimer();
        setStep("done");
        await generateReport(nextAnswers);
        return;
      }

      // Generate a follow-up question dynamically
      const followUp = await generateFollowUpQuestion(
        questions,
        questions[currentQ],
        transcript
      );

      if (followUp) {
        // Add the follow-up question to the list dynamically
        setQuestions(prev => {
          const updated = [...prev];
          // Replace or insert the next question with the follow-up
          if (nextQ < updated.length) {
            updated[nextQ] = followUp;
          } else {
            updated.push(followUp);
          }
          return updated;
        });
        setCurrentQ(nextQ);
        speakQuestion(followUp, startListening);
      } else if (nextQ < questions.length) {
        setCurrentQ(nextQ);
        speakQuestion(questions[nextQ], startListening);
      } else {
        // No follow-up generated — pick a fresh unused fallback question
        const usedSet = new Set(questions);
        const unused = FALLBACK_QUESTIONS.find(q => !usedSet.has(q));
        const fallbackQ = unused || `Tell me more about your experience as a .`;
        setQuestions(prev => [...prev, fallbackQ]);
        setCurrentQ(nextQ);
        speakQuestion(fallbackQ, startListening);
      }
    } catch {
      const fb = {
        scores:{ technical_knowledge:0, problem_solving:0, communication_skills:0, project_understanding:0, confidence:0 },
        strength:"No score was recorded.",
        improvement:"Please retry this answer so it can be evaluated.",
        weighted_total:0,
      };
      const nextAnswers = [...answers, { q: questions[currentQ], a: transcript, ...fb }];
      setAnswers(nextAnswers);
      answersRef.current = nextAnswers;
      setTranscript("");

      if (timerExpiredRef.current || pendingAutoSubmitRef.current) {
        isAnsweringRef.current = false;
        pendingAutoSubmitRef.current = false;
        stopTimer();
        setStep("done");
        await generateReport(nextAnswers);
        return;
      }

      const nextQ = currentQ + 1;
      if (nextQ >= questions.length) {
        isAnsweringRef.current = false;
        stopTimer();
        stopListening();
        window.speechSynthesis?.cancel();
        setStep("done");
        await generateReport(nextAnswers);
        return;
      }

      // On error, move to next question.
      if (nextQ < questions.length) {
        setCurrentQ(nextQ);
        speakQuestion(questions[nextQ], startListening);
      } else {
        const usedSet = new Set(questions);
        const unused = FALLBACK_QUESTIONS.find(q => !usedSet.has(q));
        const fallback = unused || `What aspect of  work do you find most challenging?`;
        setQuestions(prev => [...prev, fallback]);
        setCurrentQ(nextQ);
        speakQuestion(fallback, startListening);
      }
    } finally {
      setIsLoading(false);
      isAnsweringRef.current = false;
    }
  };

  const resetAll = () => {
    stopListening();
    stopTimer();
    window.speechSynthesis?.cancel();
    timerExpiredRef.current = false;
    pendingAutoSubmitRef.current = false;
    isAnsweringRef.current = false;
    setStep("setup");
    setQuestions([]);
    setAnswers([]);
    setCurrentQ(0);
    setReport(null);
    setProctoringStats({ tabSwitches: 0, faceNotDetected: 0, multipleFaces: 0 });
    setTranscript("");
    setTimeElapsed(0);
  };

  useEffect(() => {
    return () => {
      stopListening();
      stopTimer();
      window.speechSynthesis?.cancel();
    };
  }, []);

  // Format time remaining
  const totalSeconds = Math.floor(timeElapsed / 1000);
  const minutesElapsed = Math.floor(totalSeconds / 60);
  const secondsElapsed = totalSeconds % 60;
  const remainingMs = Math.max(0, INTERVIEW_DURATION_MS - timeElapsed);
  const remainingMin = Math.floor(remainingMs / 60000);
  const remainingSec = Math.floor((remainingMs % 60000) / 1000);
  const timerColor = remainingMs < 5 * 60 * 1000 ? "#ef4444" : remainingMs < 10 * 60 * 1000 ? "#f59e0b" : "#22c55e";

  if (step === "setup") return (
    <main style={{ maxWidth:900, margin:"0 auto", padding:"40px 20px 80px" }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, alignItems:"start" }}>
        <div className="card" style={{ border:"1px solid rgba(99,102,241,.22)" }}>
          <h2 style={{ fontSize:22, fontWeight:800, marginBottom:6 }}>Set Up Interview</h2>
          <p style={{ color:"#a1a1aa", fontSize:13, marginBottom:22 }}>Configure your session</p>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:"#a1a1aa", display:"block", marginBottom:7 }}>TARGET ROLE</label>
              <select className="input" value={role} onChange={e => setRole(e.target.value)}>
                {TARGET_ROLES.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:"#a1a1aa", display:"block", marginBottom:7 }}>RESUME (OPTIONAL)</label>
              <div onClick={() => fileRef.current?.click()} style={{ border:"2px dashed rgba(255,255,255,.07)", borderRadius:9, padding:"18px", textAlign:"center", cursor:"pointer" }}>
                <div style={{ color:"#52525b", marginBottom:5, display:"flex", justifyContent:"center" }}><Icons.Upload/></div>
                <p style={{ fontSize:12, color:"#a1a1aa" }}>{resumeText?"✓ Resume loaded":"Click to upload .txt"}</p>
              </div>
              <input ref={fileRef} type="file" accept=".txt" style={{ display:"none" }} onChange={handleFile}/>
              <textarea className="input" style={{ marginTop:8, minHeight:60, resize:"vertical" }} placeholder="Or paste resume text…" value={resumeText} onChange={e => setResumeText(e.target.value)}/>
            </div>
            {error && <p style={{ color:"#fca5a5", fontSize:12 }}>{error}</p>}
            <button className="btn btn-primary" style={{ fontSize:14, padding:"12px" }} onClick={generateQuestions} disabled={isLoading||!role.trim()}>
              {isLoading?<><Icons.Spin/>Generating questions…</>:<>Begin Interview <Icons.Arrow/></>}
            </button>
          </div>
        </div>
        <RAGPanel onSelectQuestion={q => setQuestions(p => [...p, q])}/>
      </div>
    </main>
  );

  if (step === "interview") {
    const progress = Math.min(100, (timeElapsed / INTERVIEW_DURATION_MS) * 100);
    return (
      <main style={{ maxWidth:1100, margin:"0 auto", padding:"32px 20px 80px" }}>
        {/* ── Timer + progress bar ──────────────────────────────────────────────── */}
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6, alignItems:"center" }}>
          <span style={{ fontSize:12, color:"#a1a1aa" }}>Question {currentQ+1}</span>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            <span style={{ fontSize:12, color:"#52525b" }}>{role}</span>
            <span style={{ fontSize:11, color:timerColor, padding:"2px 8px", borderRadius:6,
              background:`rgba(${timerColor==="#22c55e"?"34,197,94":timerColor==="#f59e0b"?"245,158,11":"239,68,68"},.08)`,
              border:`1px solid rgba(${timerColor==="#22c55e"?"34,197,94":timerColor==="#f59e0b"?"245,158,11":"239,68,68"},.2)`,
              fontFamily:"monospace" }}>
              ⏱ {String(remainingMin).padStart(2,"0")}:{String(remainingSec).padStart(2,"0")} left
            </span>
            <span style={{ fontSize:11, color:"#22c55e", padding:"2px 8px", borderRadius:6,
              background:"rgba(34,197,94,.08)", border:"1px solid rgba(34,197,94,.2)" }}>
              ● Proctoring Active
            </span>
          </div>
        </div>
        <div style={{ height:4, background:"rgba(255,255,255,.07)", borderRadius:4, marginBottom:18, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${progress}%`, background:`linear-gradient(90deg,#6366f1,${timerColor})`, transition:"width .5s ease" }}/>
        </div>

        {/* ── Three-column: Avatar | Chat | Proctoring ──────────────────────────── */}
        <div style={{ display:"grid", gridTemplateColumns:"220px 1fr 260px", gap:18, alignItems:"start" }}>

          {/* LEFT: Anime Avatar panel */}
          <div style={{ position:"sticky", top:80 }}>
            <div className="card" style={{
              border:"1px solid rgba(99,102,241,.2)",
              padding:"24px 16px",
              background:"linear-gradient(160deg,#0a0c1a,#0f1120)",
              display:"flex",
              flexDirection:"column",
              alignItems:"center",
            }}>
              <div style={{ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <span style={{ fontSize:9, color:"#52525b", fontFamily:"monospace", letterSpacing:".1em" }}>INTERVIEWER.AI</span>
                <div style={{ display:"flex", gap:4 }}>
                  {["#ef4444","#f59e0b","#22c55e"].map(c => (
                    <div key={c} style={{ width:6, height:6, borderRadius:"50%", background:c, opacity:.6 }}/>
                  ))}
                </div>
              </div>

              <AnimeAvatar
                isSpeaking={isSpeaking}
                isListening={isListening}
                isThinking={isLoading}
              />

              <div style={{
                marginTop:16, width:"100%",
                padding:"10px 12px", borderRadius:9,
                background:"rgba(99,102,241,.06)", border:"1px solid rgba(99,102,241,.18)",
              }}>
                <p style={{ fontSize:10, color:"#52525b", marginBottom:4, textTransform:"uppercase", letterSpacing:".06em" }}>Asking</p>
                <p style={{ fontSize:11, color:"#a1a1aa", lineHeight:1.5, display:"-webkit-box",
                  WebkitLineClamp:3, WebkitBoxOrient:"vertical", overflow:"hidden" }}>
                  {questions[currentQ] || "Preparing question..."}
                </p>
              </div>
              <button className="btn btn-ghost"
                style={{ marginTop:10, fontSize:11, width:"100%", justifyContent:"center" }}
                onClick={() => speakQuestion(questions[currentQ])}>
                🔊 Replay Question
              </button>
            </div>
          </div>

          {/* CENTER: Q&A area */}
          <div>
            <div className="card" style={{ border:"1px solid rgba(99,102,241,.22)", marginBottom:14 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                <div style={{ width:28, height:28, borderRadius:"50%", background:"rgba(99,102,241,.15)",
                  border:"1px solid rgba(99,102,241,.3)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Icons.Brain/>
                </div>
                <span style={{ fontSize:12, color:"#818cf8", fontWeight:500 }}>ARIA — AI Interviewer</span>
                <AudioBars active={isSpeaking}/>
              </div>
              <p style={{ fontSize:15, color:"#f4f4f5", lineHeight:1.65 }}>{questions[currentQ]}</p>
            </div>
            <div className="card" style={{ marginBottom:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <span style={{ fontSize:13, color:"#a1a1aa" }}>Your Answer</span>
                <AudioBars active={isListening}/>
              </div>
              <textarea className="input" style={{ minHeight:80, resize:"vertical", marginBottom:10 }}
                placeholder="Speak or type your answer…" value={transcript} onChange={e => setTranscript(e.target.value)}/>
              <div style={{ display:"flex", gap:10 }}>
                <div style={{ flex:1, display:"flex", alignItems:"center", gap:8, padding:"9px 14px", borderRadius:9,
                  background:isListening?"rgba(99,102,241,.1)":"rgba(255,255,255,.03)",
                  border:isListening?"1px solid rgba(99,102,241,.35)":"1px solid rgba(255,255,255,.07)" }}>
                  <Icons.Mic size={15}/>
                  <span style={{ fontSize:12, color:isListening?"#818cf8":"#52525b" }}>
                    {isListening?"🔴 Mic ON — speak now":"Mic initializing..."}
                  </span>
                  <AudioBars active={isListening}/>
                </div>
                <button className="btn btn-ghost" onClick={submitAnswer} disabled={isLoading||!transcript.trim()} style={{ flex:1 }}>
                  {isLoading?<><Icons.Spin/>Saving answer…</>:"Next Question →"}
                </button>
              </div>
              <div style={{ marginTop:10, borderTop:"1px solid rgba(255,255,255,.05)", paddingTop:10 }}>
                <button className="btn btn-danger" style={{ width:"100%", fontSize:12 }} disabled={isLoading}
                  onClick={async () => {
                    if (!window.confirm("Are you sure you want to finish the interview? Your answers so far will be submitted to HR.")) return;
                    stopListening(); stopTimer(); window.speechSynthesis?.cancel();
                    setStep("done"); await generateReport(answersRef.current);
                  }}>
                  Finish Interview
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: Proctoring */}
          <ProctoringPanel active={true} onStatsChange={setProctoringStats}/>
        </div>
      </main>
    );
  }

  if (step === "done") {
    // Auto-save to HR dashboard
    return (
      <main style={{ maxWidth:760, margin:"0 auto", padding:"36px 20px 80px" }}>
        {isLoading?(
          <div style={{ textAlign:"center", padding:"80px", color:"#52525b" }}><Icons.Spin size={40}/><p style={{ marginTop:14 }}>Submitting your interview…</p></div>
        ):report&&(
          <>
            {/* Auto-save silently */}
            <SaveInterviewButton report={report} role={role} proctoring={proctoringStats} qa={answers}/>
            {/* Candidate sees only confirmation message */}
            <div className="card" style={{ border:"1px solid rgba(99,102,241,.22)", textAlign:"center", padding:"60px 40px", marginBottom:14 }}>
              <div style={{ width:72, height:72, borderRadius:"50%", background:"rgba(34,197,94,.12)", border:"2px solid rgba(34,197,94,.3)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 22px" }}>
                <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h2 style={{ fontSize:24, fontWeight:800, marginBottom:12, color:"#f4f4f5" }}>Interview Round Complete</h2>
              <p style={{ fontSize:15, color:"#a1a1aa", lineHeight:1.75, maxWidth:480, margin:"0 auto 28px" }}>
                Thank you. The interview question round has been completed successfully.
                <br/>
                We will now begin the coding assessment round.
              </p>
              <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
                <button className="btn btn-primary" style={{ padding:"11px 26px" }} onClick={onStartCoding}>Begin Coding Now</button>
                <button className="btn btn-ghost" onClick={onFinish}>← Home</button>
              </div>
            </div>
          </>
        )}
      </main>
    );
  }
}

// ─── Landing Page ─────────────────────────────────────────────────────────────
function LandingPage({ onStart, onGoToCoding }) {
  return (
    <main style={{ maxWidth:1100, margin:"0 auto", padding:"48px 20px 80px" }}>
      <div style={{ display:"grid", gridTemplateColumns:"1.2fr 1fr", gap:22, alignItems:"start" }}>
        <div className="card" style={{ padding:"38px", border:"1px solid rgba(99,102,241,.3)", boxShadow:"0 0 60px rgba(99,102,241,.1)" }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"4px 13px", borderRadius:20, background:"rgba(99,102,241,.1)", border:"1px solid rgba(99,102,241,.25)", fontSize:12, color:"#818cf8", marginBottom:22 }}>
            <Icons.Brain/> AI Interview Assistant
          </div>
          <h1 style={{ fontSize:38, fontWeight:800, lineHeight:1.15, letterSpacing:"-0.03em", marginBottom:14 }}>
            Practice Real Interviews with Voice, AI Feedback & Proctoring
          </h1>
          <p style={{ color:"#a1a1aa", fontSize:14, lineHeight:1.65, marginBottom:28 }}>
            Answer AI-generated questions by voice, get weighted feedback across 5 professional metrics, and receive recruiter-style reports. Powered by Python + FastAPI backend.
          </p>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:28 }}>
            <button className="btn btn-primary" style={{ fontSize:14, padding:"11px 26px" }} onClick={onStart}>Start Interview <Icons.Arrow/></button>
            <button className="btn btn-ghost" style={{ fontSize:14 }} onClick={onGoToCoding}><Icons.Code/> Coding</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8 }}>
            {[
              { icon:<Icons.Shield/>, c:"#f59e0b", t:"Anti-Cheat Proctoring", d:"Webcam + tab detection" },
              { icon:<Icons.Chart/>, c:"#6366f1", t:"Weighted Evaluation", d:"5 metrics, professional scoring" },
              { icon:<Icons.Database/>, c:"#06b6d4", t:"RAG Knowledge Base", d:"Python-powered semantic search" },
              { icon:<Icons.Terminal/>, c:"#8b5cf6", t:"Coding Interview", d:"Run code + submit results" },
            ].map(f => (
              <div key={f.t} style={{ padding:"11px 13px", borderRadius:9, background:"rgba(0,0,0,.25)", border:"1px solid rgba(255,255,255,.07)" }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, color:f.c, marginBottom:4 }}>{f.icon}<span style={{ fontSize:12, fontWeight:600 }}>{f.t}</span></div>
                <p style={{ fontSize:11, color:"#52525b" }}>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="card" style={{ padding:0, overflow:"hidden", aspectRatio:"4/5" }}>
          <div style={{ width:"100%", height:"100%", background:"linear-gradient(135deg,#0c0e20,#111827)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:18, padding:28 }}>
            <div style={{ width:68, height:68, borderRadius:"50%", background:"rgba(99,102,241,.15)", border:"2px solid rgba(99,102,241,.4)", display:"flex", alignItems:"center", justifyContent:"center", animation:"pulse-ring 2.5s ease infinite" }}>
              <Icons.Mic size={30}/>
            </div>
            <AudioBars active={true}/>
            <p style={{ textAlign:"center", color:"#a1a1aa", fontSize:13, maxWidth:200, lineHeight:1.6 }}>Powered by Python FastAPI + Groq AI</p>
            <div style={{ width:"100%", padding:"13px 15px", borderRadius:9, background:"rgba(99,102,241,.07)", border:"1px solid rgba(99,102,241,.2)" }}>
              <p style={{ fontSize:11, color:"#818cf8", fontWeight:600, marginBottom:8 }}>Backend Endpoints</p>
              {["/generate-questions","/evaluate-answer","/generate-report","/analyze-code","/rag-search"].map(e => (
                <div key={e} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5 }}>
                  <div style={{ width:5, height:5, borderRadius:"50%", background:"#22c55e", flexShrink:0 }}/>
                  <span style={{ fontSize:10, color:"#52525b", fontFamily:"monospace" }}>{e}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// ─── Recruiter Page ───────────────────────────────────────────────────────────
function RecruiterPage() {
  const [interviews, setInterviews] = useState([]);
  const [selected,   setSelected]   = useState(null);
  const [question,   setQuestion]   = useState("");
  const [answer,     setAnswer]     = useState("");
  const [isLoading,  setIsLoading]  = useState(false);
  const [fetching,   setFetching]   = useState(true);
  const [search,     setSearch]     = useState("");
  const [filter,     setFilter]     = useState("All");

  const rc = r => ({ "Strong Hire":"#22c55e","Hire":"#06b6d4","Maybe Hire":"#f59e0b","Maybe":"#f59e0b","No Hire":"#ef4444" }[r]||"#818cf8");

  useEffect(() => {
    get("/interviews/all", true)
      .then(d => setInterviews((d.interviews || []).map(normalizeInterviewForDisplay)))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, []);

  const ask = async () => {
    if (!question.trim() || !selected) return;
    setIsLoading(true);
    try {
      const data = await post("/ask-recruiter", {
        candidate_name: selected.name, candidate_role: selected.role,
        score: clampScoreOutOf10(selected.score), recommendation: selected.recommendation,
        skills: selected.skills || [], question
      }, true);
      setAnswer(data.answer);
    } catch { setAnswer("Could not fetch answer."); }
    finally { setIsLoading(false); }
  };

  const filtered = interviews.filter(iv => {
    const matchSearch = !search || iv.name?.toLowerCase().includes(search.toLowerCase()) || iv.role?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "All" || iv.recommendation === filter;
    return matchSearch && matchFilter;
  });

  return (
    <main style={{ maxWidth:1060, margin:"0 auto", padding:"40px 20px 80px" }}>
      <h2 style={{ fontSize:24, fontWeight:800, marginBottom:4 }}>HR Dashboard</h2>
      <p style={{ color:"#a1a1aa", fontSize:13, marginBottom:20 }}>All candidate interviews with scores and feedback</p>

      {/* Search + Filter */}
      <div style={{ display:"flex", gap:10, marginBottom:20 }}>
        <input className="input" placeholder="Search by name or role..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex:1 }}/>
        <div style={{ display:"flex", gap:6 }}>
          {["All","Strong Hire","Hire","Maybe Hire","No Hire"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding:"7px 12px", borderRadius:8, border:`1px solid ${filter===f?"rgba(99,102,241,.5)":"rgba(255,255,255,.08)"}`,
                background: filter===f?"rgba(99,102,241,.15)":"transparent",
                color: filter===f?"#818cf8":"#71717a", fontSize:11, fontWeight:700, cursor:"pointer" }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"280px 1fr", gap:16 }}>
        {/* Candidate List */}
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {fetching ? (
            <div style={{ color:"#a1a1aa", fontSize:13, padding:20 }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="card" style={{ textAlign:"center", padding:30, color:"#52525b" }}>
              <p style={{ fontSize:28, marginBottom:8 }}>🔍</p>
              <p style={{ fontSize:13 }}>No candidates found</p>
            </div>
          ) : filtered.map(iv => (
            <div key={iv.id} className="card" onClick={() => { setSelected(iv); setAnswer(""); setQuestion(""); }}
              style={{ cursor:"pointer", padding:14,
                border: selected?.id===iv.id ? "1px solid rgba(99,102,241,.45)" : "1px solid rgba(255,255,255,.07)",
                background: selected?.id===iv.id ? "rgba(99,102,241,.07)" : "#0f1120" }}>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <div>
                  <p style={{ fontSize:13, fontWeight:700 }}>{iv.name}</p>
                  <p style={{ fontSize:11, color:"#a1a1aa" }}>{iv.role}</p>
                </div>
                <div style={{ textAlign:"right" }}>
                  <p style={{ fontSize:18, fontWeight:900, color:"#6366f1" }}>{iv.score}%</p>
                </div>
              </div>
              <div style={{ marginTop:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ padding:"2px 8px", borderRadius:20, background:`${rc(iv.recommendation)}15`,
                  border:`1px solid ${rc(iv.recommendation)}35`, color:rc(iv.recommendation), fontSize:10, fontWeight:700 }}>
                  {iv.recommendation}
                </span>
                <span style={{ fontSize:10, color:"#52525b" }}>{iv.date}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Detail Panel */}
        <div>
          {selected ? (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div className="card" style={{ border:"1px solid rgba(99,102,241,.2)" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
                  <div>
                    <h3 style={{ fontSize:20, fontWeight:800 }}>{selected.name}</h3>
                    <p style={{ fontSize:13, color:"#a1a1aa" }}>{selected.role} · {selected.date}</p>
                  </div>
                  <span style={{ padding:"4px 14px", borderRadius:20, fontSize:12, fontWeight:700,
                    background:`${rc(selected.recommendation)}15`, border:`1px solid ${rc(selected.recommendation)}35`,
                    color:rc(selected.recommendation) }}>{selected.recommendation}</span>
                </div>

                {/* Skills */}
                {selected.skills?.length > 0 && (
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
                    {selected.skills.map(s => <span key={s} className="tag">{s}</span>)}
                  </div>
                )}

                {/* Summary */}
                {selected.summary && (
                  <p style={{ fontSize:13, color:"#a1a1aa", lineHeight:1.7, marginBottom:14 }}>{selected.summary}</p>
                )}

                {(!selected.coding?.problems?.length && (selected.proctoring || selected.qa?.length > 0)) && (
                  <div style={{ display:"grid", gridTemplateColumns:"1.2fr .8fr", gap:12, marginBottom:14, alignItems:"start" }}>
                    <div style={{ padding:"12px", borderRadius:10, background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.07)" }}>
                      <p style={{ fontSize:11, fontWeight:700, color:"#a1a1aa", marginBottom:10 }}>QUESTIONS & ANSWERS</p>
                      {selected.qa?.length > 0 ? (
                        <div style={{ maxHeight:260, overflowY:"auto", display:"flex", flexDirection:"column", gap:10 }}>
                          {selected.qa.map((item, index) => (
                            <div key={index} style={{ paddingBottom:10, borderBottom:"1px solid rgba(255,255,255,.06)" }}>
                              <p style={{ fontSize:11, color:"#818cf8", fontWeight:700, marginBottom:5 }}>Q{index + 1}. {item.q}</p>
                              <p style={{ fontSize:12, color:"#a1a1aa", lineHeight:1.6 }}>{item.a || "No answer recorded"}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ fontSize:12, color:"#52525b" }}>No questions saved for this interview.</p>
                      )}
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:10 }}>
                    {[
                      ["Tab Switches", selected.proctoring?.tabSwitches || 0, "#f59e0b"],
                      ["Face Not Detected", selected.proctoring?.faceNotDetected || 0, "#ef4444"],
                      ["Multiple Faces", selected.proctoring?.multipleFaces || 0, "#8b5cf6"],
                    ].map(([label, value, color]) => (
                      <div key={label} style={{ padding:"10px 12px", borderRadius:10, background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.07)" }}>
                        <p style={{ fontSize:18, fontWeight:800, color }}>{value}</p>
                        <p style={{ fontSize:11, color:"#a1a1aa", marginTop:4 }}>{label}</p>
                      </div>
                    ))}
                    </div>
                  </div>
                )}

                {!!selected.coding?.problems?.length && (
                  <div style={{ marginBottom:14, padding:"12px", borderRadius:10, background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.07)" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                      <p style={{ fontSize:11, fontWeight:700, color:"#a1a1aa" }}>CODING</p>
                      <span className="tag">{selected.coding.language || "coding"}</span>
                    </div>

                    <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:12 }}>
                      {[
                        ["Tab Switches", selected.coding.proctoring?.tabSwitches || 0, "#f59e0b"],
                        ["Face Not Detected", selected.coding.proctoring?.faceNotDetected || 0, "#ef4444"],
                        ["Multiple Faces", selected.coding.proctoring?.multipleFaces || 0, "#8b5cf6"],
                        ["Voice Alerts", selected.coding.proctoring?.voiceDetections || 0, "#06b6d4"],
                      ].map(([label, value, color]) => (
                        <div key={label} style={{ padding:"10px 12px", borderRadius:10, background:"rgba(255,255,255,.02)", border:"1px solid rgba(255,255,255,.07)" }}>
                          <p style={{ fontSize:18, fontWeight:800, color }}>{value}</p>
                          <p style={{ fontSize:11, color:"#a1a1aa", marginTop:4 }}>{label}</p>
                        </div>
                      ))}
                    </div>

                    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                      {selected.coding.problems.map((item, index) => (
                        <div key={`${item.title}-${index}`} style={{ padding:"12px", borderRadius:10, background:"rgba(0,0,0,.2)", border:"1px solid rgba(255,255,255,.06)" }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                            <p style={{ fontSize:13, fontWeight:700 }}>{index + 1}. {item.title}</p>
                            <span style={{ fontSize:11, color:"#818cf8" }}>{item.difficulty}</span>
                          </div>
                          <p style={{ fontSize:12, color:"#a1a1aa", lineHeight:1.6, marginBottom:8 }}>{item.description}</p>
                          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                            <div>
                              <p style={{ fontSize:11, color:"#a1a1aa", marginBottom:5 }}>Submitted Code</p>
                              <pre style={{ fontSize:11, color:"#f4f4f5", whiteSpace:"pre-wrap", background:"#050609", border:"1px solid rgba(255,255,255,.07)", borderRadius:8, padding:"10px", maxHeight:180, overflow:"auto" }}>{item.code || "No code submitted"}</pre>
                            </div>
                            <div>
                              <p style={{ fontSize:11, color:"#a1a1aa", marginBottom:5 }}>Testcase Results</p>
                              <pre style={{ fontSize:11, color:"#a3e635", whiteSpace:"pre-wrap", background:"#050609", border:"1px solid rgba(255,255,255,.07)", borderRadius:8, padding:"10px", minHeight:84 }}>{item.testcase_output || "No testcase results"}</pre>
                              {item.analysis && (
                                <div style={{ marginTop:8, padding:"10px", borderRadius:8, background:"rgba(99,102,241,.08)", border:"1px solid rgba(99,102,241,.18)" }}>
                                  <p style={{ fontSize:11, color:"#818cf8", marginBottom:4 }}>AI Analysis</p>
                                  <p style={{ fontSize:12, color:"#a1a1aa" }}>{item.analysis.verdict} • Score {item.analysis.overall_score}/10</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Strengths & Improvements */}
                {(selected.strengths?.length > 0 || selected.improvements?.length > 0) && (
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
                    {selected.strengths?.length > 0 && (
                      <div>
                        <p style={{ fontSize:11, fontWeight:700, color:"#22c55e", marginBottom:6 }}>✅ STRENGTHS</p>
                        {selected.strengths.map((s,i) => <p key={i} style={{ fontSize:12, color:"#a1a1aa", marginBottom:3 }}>• {s}</p>)}
                      </div>
                    )}
                    {selected.improvements?.length > 0 && (
                      <div>
                        <p style={{ fontSize:11, fontWeight:700, color:"#f59e0b", marginBottom:6 }}>⚡ TO IMPROVE</p>
                        {selected.improvements.map((s,i) => <p key={i} style={{ fontSize:12, color:"#a1a1aa", marginBottom:3 }}>• {s}</p>)}
                      </div>
                    )}
                  </div>
                )}

                {/* Ask AI */}
                <div style={{ borderTop:"1px solid rgba(255,255,255,.07)", paddingTop:14 }}>
                  <p style={{ fontSize:11, fontWeight:700, color:"#a1a1aa", marginBottom:10 }}>ASK AI ABOUT CANDIDATE</p>
                  <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                    <input className="input" placeholder="Is this a good culture fit?" value={question}
                      onChange={e => setQuestion(e.target.value)} onKeyDown={e => e.key==="Enter"&&ask()} style={{ flex:1 }}/>
                    <button className="btn btn-primary" onClick={ask} disabled={isLoading||!question.trim()}>
                      {isLoading ? <Icons.Spin size={14}/> : "Ask"}
                    </button>
                  </div>
                  {answer && (
                    <div style={{ padding:"10px 13px", borderRadius:9, background:"rgba(99,102,241,.07)",
                      border:"1px solid rgba(99,102,241,.18)", fontSize:13, color:"#f4f4f5", lineHeight:1.6 }}>{answer}</div>
                  )}
                </div>
              </div>

              {/* Metrics breakdown */}
              {!selected.coding?.problems?.length && selected.scores && Object.keys(selected.scores).length > 0 && (
                <EvaluationBreakdown scores={selected.scores} weighted_total={clampScoreOutOf10(selected.score)}/>
              )}
            </div>
          ) : (
            <div className="card" style={{ display:"flex", flexDirection:"column", alignItems:"center",
              justifyContent:"center", minHeight:300, color:"#52525b" }}>
              <Icons.User/><p style={{ marginTop:10, fontSize:13 }}>Select a candidate to view details</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
// ─── Auth Page ────────────────────────────────────────────────────────────────
function AuthPage({ onAuth }) {
  const [mode, setMode] = useState("signin");
  const [role, setRole] = useState("candidate");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [error, setError] = useState("");
  const [otpStatus, setOtpStatus] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [forgotStep, setForgotStep] = useState("request");

  const resetOtpState = () => {
    setOtp("");
    setOtpSent(false);
    setOtpStatus("");
    setResetToken("");
    setForgotStep("request");
  };

  const resetPasswordFields = () => {
    setPassword("");
    setConfirmPassword("");
    setShowPw(false);
    setShowConfirmPw(false);
  };

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    setError("");
    resetPasswordFields();
    if (nextMode === "forgot") {
      resetOtpState();
      return;
    }
    setOtp("");
    setOtpSent(false);
    setResetToken("");
    setForgotStep("request");
  };

  const handleRoleChange = (nextRole) => {
    setRole(nextRole);
    setError("");
    if (mode === "signup" || mode === "forgot") resetOtpState();
  };

  const handleEmailChange = (value) => {
    setEmail(value);
    if (mode === "signup" || mode === "forgot") resetOtpState();
  };

  const fill = (nextRole, nextEmail, nextPassword) => {
    setMode("signin");
    setRole(nextRole);
    setEmail(nextEmail);
    setPassword(nextPassword);
    setConfirmPassword("");
    setName("");
    setError("");
    resetOtpState();
  };

  async function handleSendOtp() {
    const normalizedEmail = email.trim().toLowerCase();
    setError("");
    setOtpStatus("");
    if (!isValidEmail(normalizedEmail)) {
      setError("Enter a valid email address");
      return;
    }

    setSendingOtp(true);
    try {
      const isForgotMode = mode === "forgot";
      const data = await post(
        isForgotMode ? "/auth/request-password-reset-otp" : "/auth/request-signup-otp",
        isForgotMode ? { email: normalizedEmail, role } : { email: normalizedEmail }
      );
      setOtpSent(true);
      if (isForgotMode) setForgotStep("verify");
      setOtpStatus(data.dev_otp ? `${data.message} OTP: ${data.dev_otp}` : (data.message || "OTP sent to your email"));
    } catch (e) {
      setError(e.message);
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleSubmit() {
    setError("");
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      let data = null;

      if (mode === "signup") {
        if (!name.trim()) throw new Error("Enter your full name");
        if (!isValidEmail(normalizedEmail)) throw new Error("Enter a valid email address");
        if (!password) throw new Error("Enter your password");
        if (!hasSpecialCharacter(password)) throw new Error("Password must include at least 1 special character");
        if (!otp.trim()) throw new Error("Enter the OTP sent to your email");
        data = await post("/auth/signup", { name: name.trim(), email: normalizedEmail, password, otp: otp.trim(), role });
      } else if (mode === "forgot") {
        if (!isValidEmail(normalizedEmail)) throw new Error("Enter a valid email address");
        if (forgotStep === "verify") {
          if (!otp.trim()) throw new Error("Enter the OTP sent to your email");
          const verified = await post("/auth/verify-password-reset-otp", {
            email: normalizedEmail,
            role,
            otp: otp.trim(),
          });
          setResetToken(verified.reset_token || "");
          setForgotStep("reset");
          setOtpStatus(verified.message || "OTP verified. Enter your new password.");
          resetPasswordFields();
        } else if (forgotStep === "reset") {
          if (!resetToken) throw new Error("Reset session expired. Request a new OTP");
          if (!password) throw new Error("Enter your new password");
          if (!confirmPassword) throw new Error("Confirm your new password");
          if (!hasSpecialCharacter(password)) throw new Error("Password must include at least 1 special character");
          if (password !== confirmPassword) throw new Error("Passwords do not match");
          await post("/auth/reset-password", {
            reset_token: resetToken,
            password,
            confirm_password: confirmPassword,
          });
          setMode("signin");
          setPassword("");
          setConfirmPassword("");
          setOtp("");
          setOtpSent(false);
          setResetToken("");
          setForgotStep("request");
          setOtpStatus("Password updated. Sign in with your new password.");
        } else {
          throw new Error("Send an OTP to continue");
        }
      } else {
        if (!isValidEmail(normalizedEmail)) throw new Error("Enter a valid email address");
        if (!password) throw new Error("Enter your password");
        data = await post("/auth/login", { email: normalizedEmail, password, role });
      }

      if (data?.token && data?.user) {
        sessionStorage.setItem("token", data.token);
        sessionStorage.setItem("user", JSON.stringify(data.user));
        onAuth(data.user);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ width:"100%", maxWidth:420 }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:10, marginBottom:10 }}>
            <Icons.Brain/><span style={{ fontSize:22, fontWeight:900, letterSpacing:"-.02em" }}>AI Interview</span>
          </div>
          <p style={{ color:"#a1a1aa", fontSize:13 }}>Your AI-powered interview coach</p>
        </div>

        <div className="card" style={{ border:"1px solid rgba(99,102,241,.25)", padding:28 }}>
          <div style={{ display:"flex", gap:0, marginBottom:24, borderRadius:10, background:"rgba(255,255,255,.04)", padding:3 }}>
            {[ ["signin","Sign In"], ["signup","Sign Up"] ].map(([k,l]) => (
              <button key={k} onClick={() => handleModeChange(k)}
                style={{ flex:1, padding:"8px 0", borderRadius:8, border:"none", cursor:"pointer", fontSize:13, fontWeight:700,
                  background: mode===k ? "rgba(99,102,241,.25)" : "transparent",
                  color: mode===k ? "#818cf8" : "#71717a" }}>
                {l}
              </button>
            ))}
          </div>

          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:11, fontWeight:700, color:"#a1a1aa", display:"block", marginBottom:6 }}>ACCOUNT TYPE *</label>
            <div style={{ display:"flex", gap:8 }}>
              {[ ["candidate","Candidate"], ["hr","HR"] ].map(([k,l]) => (
                <button key={k} onClick={() => handleRoleChange(k)}
                  style={{ flex:1, padding:"10px 0", borderRadius:9, border:`1.5px solid ${role===k?"rgba(99,102,241,.6)":"rgba(255,255,255,.08)"}`,
                    background: role===k ? "rgba(99,102,241,.14)" : "rgba(255,255,255,.02)",
                    color: role===k ? "#818cf8" : "#a1a1aa", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                  {mode==="signin" ? `${l} Login` : l}
                </button>
              ))}
            </div>
          </div>

          {mode==="signup" && (
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:11, fontWeight:700, color:"#a1a1aa", display:"block", marginBottom:6 }}>FULL NAME *</label>
              <input className="input" placeholder="Jane Smith" value={name} onChange={e => setName(e.target.value)} style={{ width:"100%" }}/>
            </div>
          )}

          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, fontWeight:700, color:"#a1a1aa", display:"block", marginBottom:6 }}>EMAIL *</label>
            <div style={{ display:"flex", gap:8 }}>
              <input className="input" type="email" placeholder="you@example.com" value={email} onChange={e => handleEmailChange(e.target.value)} style={{ width:"100%" }}/>
              {(mode==="signup" || (mode==="forgot" && forgotStep==="request")) && (
                <button className="btn btn-ghost" type="button" onClick={handleSendOtp} disabled={sendingOtp} style={{ padding:"0 12px", fontSize:11 }}>
                  {sendingOtp ? <Icons.Spin size={14}/> : otpSent ? "Resend OTP" : "Send OTP"}
                </button>
              )}
            </div>
          </div>

          {(mode==="signin" || mode==="signup") && (
            <div style={{ marginBottom:mode==="signup" ? 14 : 12 }}>
              <label style={{ fontSize:11, fontWeight:700, color:"#a1a1aa", display:"block", marginBottom:6 }}>PASSWORD *</label>
              <div style={{ position:"relative" }}>
                <input className="input" type={showPw?"text":"password"} placeholder="????????" value={password}
                  onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key==="Enter"&&handleSubmit()}
                  style={{ width:"100%", paddingRight:54 }}/>
                <button type="button" onClick={() => setShowPw(!showPw)} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)",
                  background:"none", border:"none", cursor:"pointer", color:"#71717a", fontSize:12 }}>
                  {showPw?"Hide":"Show"}
                </button>
              </div>
            </div>
          )}

          {mode==="signin" && (
            <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:18 }}>
              <button type="button" onClick={() => handleModeChange("forgot")} style={{ background:"none", border:"none", color:"#818cf8", fontSize:12, cursor:"pointer", padding:0 }}>
                Forgot password?
              </button>
            </div>
          )}

          {mode==="signup" && (
            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:11, fontWeight:700, color:"#a1a1aa", display:"block", marginBottom:6 }}>EMAIL OTP *</label>
              <input className="input" placeholder="Enter 6-digit OTP" value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={e => e.key==="Enter"&&handleSubmit()}
                style={{ width:"100%", letterSpacing:"0.24em" }}/>
              {otpStatus && <p style={{ marginTop:6, fontSize:11, color:"#818cf8" }}>{otpStatus}</p>}
            </div>
          )}

          {mode==="forgot" && forgotStep==="verify" && (
            <div style={{ marginBottom:18 }}>
              <label style={{ fontSize:11, fontWeight:700, color:"#a1a1aa", display:"block", marginBottom:6 }}>EMAIL OTP *</label>
              <input className="input" placeholder="Enter 6-digit OTP" value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={e => e.key==="Enter"&&handleSubmit()}
                style={{ width:"100%", letterSpacing:"0.24em" }}/>
              {otpStatus && <p style={{ marginTop:6, fontSize:11, color:"#818cf8" }}>{otpStatus}</p>}
            </div>
          )}

          {mode==="forgot" && forgotStep==="reset" && (
            <>
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:11, fontWeight:700, color:"#a1a1aa", display:"block", marginBottom:6 }}>NEW PASSWORD *</label>
                <div style={{ position:"relative" }}>
                  <input className="input" type={showPw?"text":"password"} placeholder="Enter new password" value={password}
                    onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key==="Enter"&&handleSubmit()}
                    style={{ width:"100%", paddingRight:54 }}/>
                  <button type="button" onClick={() => setShowPw(!showPw)} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)",
                    background:"none", border:"none", cursor:"pointer", color:"#71717a", fontSize:12 }}>
                    {showPw?"Hide":"Show"}
                  </button>
                </div>
              </div>
              <div style={{ marginBottom:18 }}>
                <label style={{ fontSize:11, fontWeight:700, color:"#a1a1aa", display:"block", marginBottom:6 }}>CONFIRM NEW PASSWORD *</label>
                <div style={{ position:"relative" }}>
                  <input className="input" type={showConfirmPw?"text":"password"} placeholder="Re-enter new password" value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)} onKeyDown={e => e.key==="Enter"&&handleSubmit()}
                    style={{ width:"100%", paddingRight:54 }}/>
                  <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)",
                    background:"none", border:"none", cursor:"pointer", color:"#71717a", fontSize:12 }}>
                    {showConfirmPw?"Hide":"Show"}
                  </button>
                </div>
              </div>
              {otpStatus && <p style={{ marginTop:-8, marginBottom:12, fontSize:11, color:"#818cf8" }}>{otpStatus}</p>}
            </>
          )}

          {(mode==="signup" || (mode==="forgot" && forgotStep==="reset")) && <p style={{ marginTop:-8, marginBottom:14, fontSize:11, color:"#71717a" }}>Password must include at least 1 special character.</p>}
          {error && <div style={{ marginBottom:14, padding:"9px 13px", borderRadius:8, background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.25)", color:"#f87171", fontSize:13 }}>{error}</div>}

          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading} style={{ width:"100%", padding:"11px 0", fontSize:14 }}>
            {loading ? <Icons.Spin size={16}/> : mode==="signin" ? `Sign In as ${role==="hr" ? "HR" : "Candidate"}` : mode==="signup" ? "Create Account" : forgotStep==="verify" ? "Verify OTP" : forgotStep==="reset" ? "Save New Password" : "Send OTP to Continue"}
          </button>

          <div style={{ marginTop:18, borderTop:"1px solid rgba(255,255,255,.07)", paddingTop:14 }}>
            <p style={{ fontSize:11, color:"#52525b", marginBottom:8, textAlign:"center" }}>DEMO ACCOUNTS</p>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => { fill("candidate","candidate@demo.com","candidate123"); setTimeout(() => handleSubmit(), 120); }}
                style={{ flex:1, padding:"7px 0", borderRadius:8, border:"1px solid rgba(255,255,255,.08)", background:"transparent",
                  color:"#a1a1aa", fontSize:11, cursor:"pointer" }}>Candidate</button>
              <button onClick={() => { fill("hr","hr@demo.com","hr123"); setTimeout(() => handleSubmit(), 120); }}
                style={{ flex:1, padding:"7px 0", borderRadius:8, border:"1px solid rgba(255,255,255,.08)", background:"transparent",
                  color:"#a1a1aa", fontSize:11, cursor:"pointer" }}>HR</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ????????? Candidate Dashboard ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
function CandidateDashboard({ user, onStartInterview }) {
  const [interviews, setInterviews] = useState([]);
  const [selected,   setSelected]   = useState(null);
  const [loading,    setLoading]     = useState(true);

  useEffect(() => {
    get("/interviews/my", true)
      .then(d => setInterviews((d.interviews || []).map(normalizeInterviewForDisplay)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const avg  = interviews.length ? Math.round(interviews.reduce((s,i) => s+(i.score||0),0)/interviews.length) : 0;
  const best = interviews.length ? Math.max(...interviews.map(i => i.score||0)) : 0;

  return (
    <main style={{ maxWidth:1100, margin:"0 auto", padding:"36px 20px 80px" }}>
      <div style={{ marginBottom:28 }}>
        <h2 style={{ fontSize:24, fontWeight:900, marginBottom:4 }}>Welcome back, {user.name} 👋</h2>
        <p style={{ color:"#a1a1aa", fontSize:13 }}>Track your interview progress and history</p>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:28 }}>
        {[["Total Interviews", interviews.length, "🎯"],["Average Score", avg+"%", "📊"],["Best Score", best+"%", "🏆"]].map(([l,v,e]) => (
          <div key={l} className="card" style={{ textAlign:"center", padding:20 }}>
            <div style={{ fontSize:28, marginBottom:6 }}>{e}</div>
            <div style={{ fontSize:26, fontWeight:900, color:"#818cf8" }}>{v}</div>
            <div style={{ fontSize:12, color:"#a1a1aa", marginTop:4 }}>{l}</div>
          </div>
        ))}
      </div>

      <button className="btn btn-primary" onClick={onStartInterview} style={{ marginBottom:28, padding:"11px 28px", fontSize:14 }}>
        + Start New Interview
      </button>

      {/* Interview History */}
      <h3 style={{ fontSize:16, fontWeight:800, marginBottom:14 }}>Interview History</h3>
      {loading ? <p style={{ color:"#a1a1aa" }}>Loading...</p> :
       interviews.length===0 ? (
        <div className="card" style={{ textAlign:"center", padding:40, color:"#52525b" }}>
          <p style={{ fontSize:32, marginBottom:10 }}>🎤</p>
          <p>No interviews yet. Start your first one!</p>
        </div>
       ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {interviews.map(iv => (
            <div key={iv.id} className="card" style={{ cursor:"pointer", border:`1px solid ${selected?.id===iv.id?"rgba(99,102,241,.4)":"rgba(255,255,255,.05)"}` }}
              onClick={() => setSelected(selected?.id===iv.id ? null : iv)}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:15 }}>{iv.role}</div>
                  <div style={{ fontSize:12, color:"#71717a", marginTop:2 }}>{iv.date}</div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:20, fontWeight:900, color:"#818cf8" }}>{iv.score}%</span>
                  <span style={{ color:"#52525b" }}>{selected?.id===iv.id?"▲":"▼"}</span>
                </div>
              </div>

              {selected?.id===iv.id && (
                <div style={{ marginTop:16, paddingTop:16, borderTop:"1px solid rgba(255,255,255,.07)" }}>
                  {/* Metrics */}
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8, marginBottom:16 }}>
                    {EVAL_METRICS.map(m => (
                      <div key={m.key} style={{ textAlign:"center", padding:"10px 6px", borderRadius:8, background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.06)" }}>
                        <div style={{ fontSize:16, fontWeight:900, color:m.color }}>{iv.scores?.[m.key]||0}</div>
                        <div style={{ fontSize:9, color:"#71717a", marginTop:3, lineHeight:1.3 }}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                  {/* Summary */}
                  {iv.summary && <p style={{ fontSize:13, color:"#a1a1aa", lineHeight:1.7, marginBottom:12 }}>{iv.summary}</p>}
                  {/* Strengths & Improvements */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                    {iv.strengths?.length>0 && (
                      <div>
                        <p style={{ fontSize:11, fontWeight:700, color:"#22c55e", marginBottom:6 }}>✅ STRENGTHS</p>
                        {iv.strengths.map((s,i) => <p key={i} style={{ fontSize:12, color:"#a1a1aa", marginBottom:3 }}>• {s}</p>)}
                      </div>
                    )}
                    {iv.improvements?.length>0 && (
                      <div>
                        <p style={{ fontSize:11, fontWeight:700, color:"#f59e0b", marginBottom:6 }}>⚡ IMPROVEMENTS</p>
                        {iv.improvements.map((s,i) => <p key={i} style={{ fontSize:12, color:"#a1a1aa", marginBottom:3 }}>• {s}</p>)}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
       )}
    </main>
  );
}

// ─── App Shell ────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(() => getUser());
  const [page, setPage] = useState("home");

  function handleAuth(u) { setUser(u); setPage(u.role === "hr" ? "recruiter" : "home"); }
  function handleLogout() {
    const t = getToken();
    if (t) post("/auth/logout", {}, true).catch(() => {});
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    setUser(null); setPage("home");
  }

  // Not logged in → show auth page
  if (!user) return (<><style>{CSS}</style><AuthPage onAuth={handleAuth}/></>);

  const candidateNav = [
    { key:"home",      label:"Home",      icon:<Icons.Home/> },
    { key:"interview", label:"Interview", icon:<Icons.Mic size={15}/> },
    { key:"coding",    label:"Coding",    icon:<Icons.Code/> },
    { key:"dashboard", label:"My History",icon:<Icons.Chart/> },
  ];
  const hrNav = [
    { key:"recruiter", label:"HR Dashboard", icon:<Icons.Chart/> },
  ];
  const navItems = user.role === "hr" ? hrNav : candidateNav;

  return (
    <>
      <style>{CSS}</style>
      <header style={{ position:"sticky", top:0, zIndex:40, borderBottom:"1px solid rgba(255,255,255,.07)", background:"rgba(6,7,13,.85)", backdropFilter:"blur(24px)" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"13px 20px" }}>
          <div onClick={() => setPage(user.role==="hr"?"recruiter":"home")} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", color:"#f4f4f5" }}>
            <Icons.Brain/>
            <span style={{ fontSize:14, fontWeight:800, letterSpacing:"-.01em" }}>AI Interview</span>
          </div>
          <nav style={{ display:"flex", gap:3, alignItems:"center" }}>
            {navItems.map(n => (
              <button key={n.key} className="btn btn-ghost" onClick={() => setPage(n.key)}
                style={{ padding:"6px 13px", fontSize:12, gap:6,
                  background:page===n.key?"rgba(99,102,241,.14)":undefined,
                  color:page===n.key?"#818cf8":"#a1a1aa",
                  border:page===n.key?"1px solid rgba(99,102,241,.28)":"1px solid transparent" }}>
                {n.icon} {n.label}
              </button>
            ))}
            {/* User info + logout */}
            <div style={{ display:"flex", alignItems:"center", gap:8, marginLeft:10, paddingLeft:10, borderLeft:"1px solid rgba(255,255,255,.08)" }}>
              <div style={{ width:28, height:28, borderRadius:"50%", background:"rgba(99,102,241,.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"#818cf8" }}>
                {(user.name||"U")[0].toUpperCase()}
              </div>
              <div style={{ lineHeight:1.2 }}>
                <div style={{ fontSize:12, fontWeight:700 }}>{user.name}</div>
                <div style={{ fontSize:10, color:"#71717a", textTransform:"uppercase" }}>{user.role}</div>
              </div>
              <button className="btn btn-ghost" onClick={handleLogout}
                style={{ padding:"5px 10px", fontSize:11, color:"#71717a", marginLeft:4 }}>
                Sign Out
              </button>
            </div>
          </nav>
        </div>
      </header>

      {page==="home"      && user.role!=="hr" && <LandingPage onStart={() => setPage("interview")} onGoToCoding={() => setPage("coding")}/>}
      {page==="interview" && user.role!=="hr" && <InterviewPage onFinish={() => setPage("dashboard")} onStartCoding={() => setPage("coding")}/>}
      {page==="dashboard" && user.role!=="hr" && <CandidateDashboard user={user} onStartInterview={() => setPage("interview")}/>}
      {page==="coding"    && user.role!=="hr" && (
        <main style={{ maxWidth:1100, margin:"0 auto", padding:"36px 20px 80px" }}>
          <div style={{ marginBottom:22 }}>
            <h2 style={{ fontSize:22, fontWeight:800, marginBottom:4 }}>Coding Interview Mode</h2>
            <p style={{ color:"#a1a1aa", fontSize:13 }}>Solve problems, run code, and submit results</p>
          </div>
          <CodingInterviewMode/>
        </main>
      )}
      {page==="recruiter" && <RecruiterPage/>}
    </>
  );
}

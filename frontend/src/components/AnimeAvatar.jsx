/**
 * AnimeAvatar.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Animated anime-style AI interviewer avatar.
 * Drop this file in: frontend/src/components/AnimeAvatar.jsx
 *
 * Props:
 *   isSpeaking  {boolean}  – true while the AI is reading a question aloud
 *   isListening {boolean}  – true while waiting for candidate's answer
 *   isThinking  {boolean}  – true while AI is generating the next question
 *   avatarSrc   {string}   – optional custom image path (defaults to built-in)
 *   name        {string}   – interviewer display name
 *   title       {string}   – interviewer display title
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useState, useCallback } from "react";
import animeImg from "../anime-avatar.jpg";

// ── Keyframe CSS injected once ───────────────────────────────────────────────
const AVATAR_CSS = `
@keyframes av-blink {
  0%,90%,100% { transform: scaleY(1); }
  95%          { transform: scaleY(0.05); }
}
@keyframes av-breathe {
  0%,100% { transform: scaleY(1) translateY(0px); }
  50%     { transform: scaleY(1.012) translateY(-2px); }
}
@keyframes av-headtilt {
  0%,100% { transform: rotate(0deg) translateY(0px); }
  25%     { transform: rotate(-1.2deg) translateY(-1px); }
  75%     { transform: rotate(1deg) translateY(1px); }
}
@keyframes av-idle-float {
  0%,100% { transform: translateY(0px); }
  50%     { transform: translateY(-5px); }
}
@keyframes av-talking-bob {
  0%,100% { transform: translateY(0px) rotate(0deg); }
  20%     { transform: translateY(-2px) rotate(-0.5deg); }
  50%     { transform: translateY(-4px) rotate(0.4deg); }
  80%     { transform: translateY(-1px) rotate(-0.3deg); }
}
@keyframes av-scanline {
  0%   { top: -4px; opacity: 0.6; }
  100% { top: 100%; opacity: 0; }
}
@keyframes av-pulse-ring {
  0%   { box-shadow: 0 0 0 0 rgba(99,102,241,.55); }
  70%  { box-shadow: 0 0 0 18px rgba(99,102,241,0); }
  100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); }
}
@keyframes av-thinking-ring {
  0%   { box-shadow: 0 0 0 0 rgba(245,158,11,.4); }
  70%  { box-shadow: 0 0 0 14px rgba(245,158,11,0); }
  100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); }
}
@keyframes av-status-dot {
  0%,100% { opacity: 1; }
  50%     { opacity: 0.3; }
}
@keyframes av-lip-a {
  0%,100% { transform: scaleY(1); }
  50%     { transform: scaleY(1.9); }
}
@keyframes av-lip-b {
  0%,100% { transform: scaleY(1); }
  30%     { transform: scaleY(2.1); }
  70%     { transform: scaleY(1.5); }
}
@keyframes av-hologram-lines {
  0%   { background-position: 0 0; }
  100% { background-position: 0 40px; }
}
@keyframes av-corner-rotate {
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`;

let cssInjected = false;
function injectCSS() {
  if (cssInjected) return;
  cssInjected = true;
  const s = document.createElement("style");
  s.textContent = AVATAR_CSS;
  document.head.appendChild(s);
}

// ── Lip-sync canvas overlay ──────────────────────────────────────────────────
function LipSyncBars({ active }) {
  const bars = [0.4, 0.9, 1, 0.6, 0.8, 0.5, 0.7, 0.3];
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      gap: 2.5, height: 18, width: "100%",
    }}>
      {bars.map((h, i) => (
        <div key={i} style={{
          width: 3,
          height: "100%",
          borderRadius: 3,
          background: active
            ? "linear-gradient(to top, #6366f1, #a78bfa)"
            : "rgba(255,255,255,.18)",
          transformOrigin: "bottom",
          transform: active ? undefined : "scaleY(0.2)",
          animation: active
            ? `${i % 2 === 0 ? "av-lip-a" : "av-lip-b"} ${0.35 + h * 0.25}s ease-in-out ${i * 0.06}s infinite`
            : "none",
          transition: "transform .25s, background .25s",
          opacity: active ? 1 : 0.35,
        }} />
      ))}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function AnimeAvatar({
  isSpeaking  = false,
  isListening = false,
  isThinking  = false,
  avatarSrc,
  name  = "ARIA",
  title = "AI Interview Specialist",
}) {
  injectCSS();

  const imgSrc = avatarSrc || animeImg;

  // Derived animation state
  const isIdle    = !isSpeaking && !isThinking;
  const ringColor = isThinking
    ? "rgba(245,158,11,.6)"
    : isSpeaking
    ? "rgba(99,102,241,.6)"
    : "rgba(34,197,94,.25)";

  const borderColor = isThinking
    ? "rgba(245,158,11,.7)"
    : isSpeaking
    ? "rgba(99,102,241,.8)"
    : isListening
    ? "rgba(34,197,94,.5)"
    : "rgba(99,102,241,.25)";

  const statusLabel = isThinking
    ? "Thinking..."
    : isSpeaking
    ? "Speaking"
    : isListening
    ? "Listening"
    : "Standby";

  const statusColor = isThinking
    ? "#f59e0b"
    : isSpeaking
    ? "#818cf8"
    : isListening
    ? "#22c55e"
    : "#52525b";

  const headAnimation = isSpeaking
    ? "av-talking-bob 1.8s ease-in-out infinite"
    : "av-headtilt 6s ease-in-out infinite";

  const bodyAnimation = "av-breathe 4s ease-in-out infinite";

  const ringAnimation = isSpeaking
    ? "av-pulse-ring 1.4s ease-out infinite"
    : isThinking
    ? "av-thinking-ring 1.8s ease-out infinite"
    : "none";

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 0,
      userSelect: "none",
    }}>

      {/* ── Outer glow ring ─────────────────────────────────────────────── */}
      <div style={{
        position: "relative",
        borderRadius: "50%",
        padding: 4,
        background: `conic-gradient(from 0deg, ${borderColor}, rgba(6,182,212,.4), ${borderColor})`,
        animation: isSpeaking || isThinking ? ringAnimation : "none",
        boxShadow: `0 0 ${isSpeaking ? "30px" : "12px"} ${ringColor}`,
        transition: "box-shadow .4s, background .4s",
      }}>
        {/* Inner avatar frame */}
        <div style={{
          width: 180,
          height: 180,
          borderRadius: "50%",
          overflow: "hidden",
          position: "relative",
          background: "#070810",
          animation: bodyAnimation,
        }}>
          {/* Avatar image with head movement */}
          <div style={{
            width: "100%",
            height: "100%",
            animation: headAnimation,
            transformOrigin: "center 40%",
          }}>
            <img
              src={imgSrc}
              alt={name}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center top",
                borderRadius: "50%",
                filter: isThinking
                  ? "brightness(0.85) saturate(0.8)"
                  : "brightness(1) saturate(1)",
                transition: "filter .4s",
              }}
            />
          </div>

          {/* Hologram scan-line overlay (speaking only) */}
          {isSpeaking && (
            <div style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              pointerEvents: "none",
              background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(99,102,241,.04) 3px, rgba(99,102,241,.04) 4px)",
              animation: "av-hologram-lines 1.2s linear infinite",
            }} />
          )}

          {/* Speaking shimmer */}
          {isSpeaking && (
            <div style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: "linear-gradient(135deg, rgba(99,102,241,.12) 0%, transparent 50%, rgba(6,182,212,.08) 100%)",
              pointerEvents: "none",
            }} />
          )}

          {/* Scan line */}
          <div style={{
            position: "absolute",
            left: 0,
            right: 0,
            height: 2,
            background: "linear-gradient(90deg, transparent, rgba(99,102,241,.6), transparent)",
            animation: "av-scanline 3s linear infinite",
            pointerEvents: "none",
          }} />
        </div>

        {/* Rotating corner accent (speaking) */}
        {(isSpeaking || isThinking) && (
          <div style={{
            position: "absolute",
            inset: -6,
            borderRadius: "50%",
            border: "1.5px dashed",
            borderColor: isThinking ? "rgba(245,158,11,.3)" : "rgba(99,102,241,.3)",
            animation: "av-corner-rotate 8s linear infinite",
            pointerEvents: "none",
          }} />
        )}
      </div>

      {/* ── Status badge ────────────────────────────────────────────────── */}
      <div style={{
        marginTop: 14,
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 14px",
        borderRadius: 20,
        background: `${statusColor}12`,
        border: `1px solid ${statusColor}35`,
      }}>
        <div style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: statusColor,
          animation: (isSpeaking || isListening || isThinking)
            ? "av-status-dot .8s ease-in-out infinite"
            : "none",
        }} />
        <span style={{ fontSize: 11, color: statusColor, fontWeight: 600, letterSpacing: ".05em" }}>
          {statusLabel}
        </span>
      </div>

      {/* ── Lip-sync bars ───────────────────────────────────────────────── */}
      <div style={{
        marginTop: 10,
        width: 130,
        padding: "6px 12px",
        borderRadius: 8,
        background: "rgba(255,255,255,.03)",
        border: "1px solid rgba(255,255,255,.07)",
      }}>
        <LipSyncBars active={isSpeaking} />
      </div>

      {/* ── Name plate ──────────────────────────────────────────────────── */}
      <div style={{ marginTop: 10, textAlign: "center" }}>
        <div style={{
          fontSize: 14,
          fontWeight: 800,
          color: "#f4f4f5",
          letterSpacing: ".08em",
          textTransform: "uppercase",
        }}>
          {name}
        </div>
        <div style={{ fontSize: 11, color: "#52525b", marginTop: 2 }}>
          {title}
        </div>
      </div>

      {/* ── Tech HUD badges ─────────────────────────────────────────────── */}
      <div style={{
        marginTop: 10,
        display: "flex",
        gap: 6,
        flexWrap: "wrap",
        justifyContent: "center",
      }}>
        {["AI", "NLP", "v2.4"].map(tag => (
          <span key={tag} style={{
            fontSize: 9,
            padding: "2px 7px",
            borderRadius: 4,
            background: "rgba(99,102,241,.08)",
            border: "1px solid rgba(99,102,241,.18)",
            color: "#818cf8",
            fontFamily: "monospace",
            letterSpacing: ".06em",
          }}>
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

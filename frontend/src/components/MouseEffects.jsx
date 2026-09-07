import { useEffect, useRef, useCallback } from "react";

// ─── Particle System ──────────────────────────────────────────────────────────
function initParticles(canvas) {
  const ctx = canvas.getContext("2d");
  let animId;
  let W = window.innerWidth;
  let H = window.innerHeight;

  canvas.width = W;
  canvas.height = H;

  const COUNT = 80;
  const particles = Array.from({ length: COUNT }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    r: Math.random() * 1.5 + 0.5,
    alpha: Math.random() * 0.5 + 0.1,
    color: Math.random() > 0.6 ? "#6366f1" : Math.random() > 0.5 ? "#06b6d4" : "#8b5cf6",
  }));

  const CONNECTION_DIST = 120;

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Draw connections
    for (let i = 0; i < COUNT; i++) {
      for (let j = i + 1; j < COUNT; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONNECTION_DIST) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(99,102,241,${0.08 * (1 - dist / CONNECTION_DIST)})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }

    // Draw particles
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    animId = requestAnimationFrame(draw);
  }

  draw();

  const onResize = () => {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;
  };
  window.addEventListener("resize", onResize);

  return () => {
    cancelAnimationFrame(animId);
    window.removeEventListener("resize", onResize);
  };
}

// ─── Ripple Effect ────────────────────────────────────────────────────────────
function addRippleListeners() {
  const handler = (e) => {
    const el = e.target.closest(".btn");
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.2;
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    const ripple = document.createElement("span");
    ripple.className = "ripple-wave";
    ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`;
    el.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  };
  document.addEventListener("click", handler);
  return () => document.removeEventListener("click", handler);
}

// ─── Card Spotlight + Tilt ────────────────────────────────────────────────────
function addCardEffects() {
  const onMove = (e) => {
    const cards = document.querySelectorAll(".card");
    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty("--mouse-x", `${x}%`);
      card.style.setProperty("--mouse-y", `${y}%`);

      // Tilt only if close to card
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      const inCard =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      if (inCard) {
        const rotX = (-cy / rect.height) * 6;
        const rotY = (cx / rect.width) * 6;
        card.style.transform = `perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.01)`;
        card.style.boxShadow = `0 20px 60px rgba(0,0,0,0.4), 0 0 30px rgba(99,102,241,0.12)`;
        card.style.borderColor = `rgba(99,102,241,0.22)`;
      } else {
        card.style.transform = "";
        card.style.boxShadow = "";
        card.style.borderColor = "";
      }
    });
  };
  document.addEventListener("mousemove", onMove);
  return () => document.removeEventListener("mousemove", onMove);
}

// ─── Scroll Reveal ────────────────────────────────────────────────────────────
function initScrollReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        }
      });
    },
    { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
  );

  const observe = () => {
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
  };
  observe();

  // Re-observe on DOM mutations (React rerenders)
  const mutObs = new MutationObserver(observe);
  mutObs.observe(document.body, { childList: true, subtree: true });

  return () => {
    observer.disconnect();
    mutObs.disconnect();
  };
}

// ─── Magnetic Buttons ─────────────────────────────────────────────────────────
function addMagneticEffect() {
  const onMove = (e) => {
    document.querySelectorAll(".btn-primary, .btn-ghost").forEach((btn) => {
      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const RANGE = 60;
      if (dist < RANGE) {
        const strength = (1 - dist / RANGE) * 6;
        btn.style.transform = `translate(${(dx / dist) * strength}px, ${(dy / dist) * strength}px)`;
      } else {
        btn.style.transform = "";
      }
    });
  };
  document.addEventListener("mousemove", onMove);
  return () => document.removeEventListener("mousemove", onMove);
}

// ─── Parallax Aurora Orbs ─────────────────────────────────────────────────────
function initParallaxOrbs() {
  const orb1 = document.querySelector(".aurora-orb-1");
  const orb2 = document.querySelector(".aurora-orb-2");
  const orb3 = document.querySelector(".aurora-orb-3");

  const onMove = (e) => {
    const x = e.clientX / window.innerWidth;
    const y = e.clientY / window.innerHeight;
    if (orb1) orb1.style.transform = `translate(${x * 40}px, ${y * 30}px)`;
    if (orb2) orb2.style.transform = `translate(${-x * 35}px, ${-y * 25}px)`;
    if (orb3) orb3.style.transform = `translate(${(x - 0.5) * 50}px, ${(y - 0.5) * 40}px) translate(-50%, -50%)`;
  };
  window.addEventListener("mousemove", onMove);
  return () => window.removeEventListener("mousemove", onMove);
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MouseEffects() {
  const canvasRef = useRef(null);

  const setup = useCallback(() => {
    const cleanups = [
      initParticles(canvasRef.current),
      addRippleListeners(),
      addCardEffects(),
      initScrollReveal(),
      addMagneticEffect(),
      initParallaxOrbs(),
    ];
    return () => cleanups.forEach((fn) => fn?.());
  }, []);

  useEffect(() => {
    const cleanup = setup();
    return cleanup;
  }, [setup]);

  return (
    <>
      {/* Aurora Background Orbs */}
      <div id="aurora-container">
        <div className="aurora-orb aurora-orb-1" />
        <div className="aurora-orb aurora-orb-2" />
        <div className="aurora-orb aurora-orb-3" />
      </div>

      {/* Particle Canvas */}
      <canvas id="particle-canvas" ref={canvasRef} />
    </>
  );
}

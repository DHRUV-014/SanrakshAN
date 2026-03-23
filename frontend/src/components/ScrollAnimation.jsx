import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

function createNodes(count, w, h) {
  const nodes = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const radius = 0.15 + Math.random() * 0.3;
    nodes.push({
      bx: 0.5 + Math.cos(angle) * radius * (0.6 + Math.random() * 0.4),
      by: 0.5 + Math.sin(angle) * radius * (0.6 + Math.random() * 0.4),
      size: Math.random() * 0.8 + 0.5,
      drift: Math.random() * 0.15 + 0.05,
      phase: Math.random() * Math.PI * 2,
    });
  }
  return nodes;
}

function drawScene(ctx, w, h, p, t, nodes) {
  const cx = w / 2, cy = h / 2;

  // Smooth eased phases
  const fadeIn    = easeOut(clamp(p * 4, 0, 1));
  const meshForm  = easeOut(clamp((p - 0.05) * 3, 0, 1));
  const connForm  = easeOut(clamp((p - 0.12) * 2.5, 0, 1));
  const focus     = easeOut(clamp((p - 0.3) * 2.5, 0, 1));
  const resolve   = easeOut(clamp((p - 0.6) * 2.5, 0, 1));

  // Background
  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, w, h);

  // Subtle radial ambient — very soft
  const ambient = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.5);
  ambient.addColorStop(0, `rgba(59,130,246,${0.02 * fadeIn + 0.02 * resolve})`);
  ambient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = ambient;
  ctx.fillRect(0, 0, w, h);

  // Nodes
  if (meshForm > 0) {
    const positions = [];
    const maxR = Math.min(w, h) * 0.38;

    nodes.forEach(n => {
      const drift = Math.sin(t * n.drift + n.phase) * 3;
      const driftY = Math.cos(t * n.drift * 0.8 + n.phase) * 2;

      // Position — gently tighten toward center as focus increases
      const tighten = focus * 0.35;
      const x = cx + (n.bx - 0.5) * w * (1 - tighten) * 0.85 + drift;
      const y = cy + (n.by - 0.5) * h * (1 - tighten) * 0.85 + driftY;

      positions.push({ x, y });

      // Node dot — very small, subtle
      const alpha = meshForm * (0.15 + 0.15 * focus + 0.1 * resolve);
      ctx.beginPath();
      ctx.arc(x, y, n.size * (1 + resolve * 0.3), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(148,163,184,${alpha})`;  // slate-400 tone
      ctx.fill();
    });

    // Connections — thin, barely visible
    if (connForm > 0) {
      const maxDist = 90 + focus * 40;
      ctx.lineWidth = 0.4;

      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const d = Math.hypot(positions[i].x - positions[j].x, positions[i].y - positions[j].y);
          if (d < maxDist) {
            const lineAlpha = connForm * (1 - d / maxDist) * 0.06;
            ctx.beginPath();
            ctx.moveTo(positions[i].x, positions[i].y);
            ctx.lineTo(positions[j].x, positions[j].y);
            ctx.strokeStyle = `rgba(148,163,184,${lineAlpha})`;
            ctx.stroke();
          }
        }
      }
    }
  }

  // Center ring — clean, minimal
  if (focus > 0) {
    const baseR = Math.min(w, h) * 0.14;

    // Single clean ring
    ctx.beginPath();
    ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(59,130,246,${focus * 0.15})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Outer subtle ring
    ctx.beginPath();
    ctx.arc(cx, cy, baseR * 1.6, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(59,130,246,${focus * 0.06})`;
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Center point
    ctx.beginPath();
    ctx.arc(cx, cy, 1.5 + resolve * 1, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(59,130,246,${focus * 0.4 + resolve * 0.3})`;
    ctx.fill();
  }

  // Resolve glow — very subtle green shift
  if (resolve > 0) {
    const resolveGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.2);
    resolveGrad.addColorStop(0, `rgba(34,197,94,${resolve * 0.03})`);
    resolveGrad.addColorStop(1, 'rgba(34,197,94,0)');
    ctx.fillStyle = resolveGrad;
    ctx.fillRect(0, 0, w, h);
  }
}

export default function ScrollAnimation() {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const progressRef = useRef(0);
  const rafRef = useRef(null);
  const nodesRef = useRef([]);
  const timeRef = useRef(0);
  const t1 = useRef(null), t2 = useRef(null), t3 = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const container = containerRef.current;
    const isMobile = window.innerWidth < 768;

    nodesRef.current = createNodes(isMobile ? 30 : 55);

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: container,
        start: 'top top',
        end: `+=${isMobile ? 1400 : 2000}`,
        scrub: 1,
        pin: true,
        anticipatePin: 1,
        onUpdate: (self) => { progressRef.current = self.progress; },
      }
    });

    // Subtle text fades — professional, understated
    tl.fromTo(t1.current, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.1, ease: 'power2.out' }, 0.1)
      .to(t1.current, { autoAlpha: 0, y: -10, duration: 0.08 }, 0.35)
      .fromTo(t2.current, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.1, ease: 'power2.out' }, 0.42)
      .to(t2.current, { autoAlpha: 0, y: -10, duration: 0.08 }, 0.65)
      .fromTo(t3.current, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.12, ease: 'power2.out' }, 0.75);

    let last = performance.now();
    function render(now) {
      timeRef.current += (now - last) / 1000;
      last = now;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.width / dpr, h = canvas.height / dpr;
      drawScene(ctx, w, h, progressRef.current, timeRef.current, nodesRef.current);
      rafRef.current = requestAnimationFrame(render);
    }
    rafRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, []);

  const abs = "absolute inset-0 flex flex-col items-center justify-center";

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: '100vh' }}>
      <div className="w-full h-full relative overflow-hidden bg-[#09090b]">
        <canvas ref={canvasRef} className="absolute inset-0" />

        {/* Smooth edge blending */}
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-[#09090b] to-transparent z-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#09090b] to-transparent z-20 pointer-events-none" />

        {/* Text — minimal, professional */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="text-center px-6 max-w-xl relative">

            <div ref={t1} className={abs} style={{ visibility: 'hidden' }}>
              <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 font-medium mb-3 leading-relaxed">Multi-layer verification</p>
              <h3 className="text-xl sm:text-2xl font-semibold text-white/80 tracking-tight leading-snug">
                Every frame analyzed at the pixel level
              </h3>
            </div>

            <div ref={t2} className={abs} style={{ visibility: 'hidden' }}>
              <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 font-medium mb-3 leading-relaxed">Neural forensics</p>
              <h3 className="text-xl sm:text-2xl font-semibold text-white/80 tracking-tight leading-snug">
                Cross-referencing biometric consistency
              </h3>
            </div>

            <div ref={t3} className={abs} style={{ visibility: 'hidden' }}>
              <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 font-medium mb-3 leading-relaxed">Confidence established</p>
              <h3 className="text-xl sm:text-2xl font-semibold text-white/80 tracking-tight leading-snug">
                Authenticity verified
              </h3>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

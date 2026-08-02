import { useEffect, useRef } from 'react';

export default function NetworkBackground({ n = 80, conn = 200, parallax = true }) {
  const canvasRef   = useRef(null);
  const mouseRef    = useRef({ x: 0, y: 0 });
  const parallaxRef = useRef(parallax);

  useEffect(() => { parallaxRef.current = parallax; }, [parallax]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    let nodes  = [];
    let pulses = [];
    let raf;

    function resize() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    function spawn() {
      nodes = Array.from({ length: n }, (_, i) => {
        const isHub = i < Math.floor(n * 0.1);
        return {
          x:     Math.random() * canvas.width,
          y:     Math.random() * canvas.height,
          vx:    (Math.random() - 0.5) * (isHub ? 0.06 : 0.18),
          vy:    (Math.random() - 0.5) * (isHub ? 0.06 : 0.18),
          r:     isHub ? Math.random() * 2.5 + 4 : Math.random() * 1.5 + 1,
          isHub,
          phase: Math.random() * Math.PI * 2,
          depth: isHub ? 1.0 : Math.random() * 0.5 + 0.3,
        };
      });
    }

    function spawnPulse() {
      const i         = Math.floor(Math.random() * nodes.length);
      const neighbors = [];
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        if (Math.sqrt(dx * dx + dy * dy) < conn) neighbors.push(j);
      }
      if (neighbors.length > 0) {
        const j = neighbors[Math.floor(Math.random() * neighbors.length)];
        pulses.push({ from: i, to: j, progress: 0, speed: 0.006 + Math.random() * 0.01 });
      }
    }

    const pulseTimer = setInterval(spawnPulse, 700);

    function dx(node) {
      const mx = parallaxRef.current ? mouseRef.current.x : 0;
      return node.x + mx * node.depth * 22;
    }
    function dy(node) {
      const my = parallaxRef.current ? mouseRef.current.y : 0;
      return node.y + my * node.depth * 22;
    }

    function frame(t) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < nodes.length; i++) {
        const xi = dx(nodes[i]), yi = dy(nodes[i]);
        for (let j = i + 1; j < nodes.length; j++) {
          const xj = dx(nodes[j]), yj = dy(nodes[j]);
          const d  = Math.sqrt((xi-xj)**2 + (yi-yj)**2);
          if (d < conn) {
            const a = (1 - d / conn) * 0.3;
            ctx.strokeStyle = `rgba(88,166,255,${a})`;
            ctx.lineWidth   = d < conn * 0.4 ? 1.0 : 0.7;
            ctx.beginPath(); ctx.moveTo(xi, yi); ctx.lineTo(xj, yj); ctx.stroke();
          }
        }
      }

      pulses = pulses.filter(p => p.progress <= 1);
      for (const p of pulses) {
        const fn = nodes[p.from], tn = nodes[p.to];
        const fx = dx(fn), fy = dy(fn), tx = dx(tn), ty = dy(tn);
        const px = fx + (tx - fx) * p.progress;
        const py = fy + (ty - fy) * p.progress;
        ctx.save();
        ctx.shadowColor = '#79b8ff'; ctx.shadowBlur = 14;
        ctx.fillStyle = 'rgba(121,184,255,0.95)';
        ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        p.progress += p.speed;
      }

      for (const nd of nodes) {
        const x     = dx(nd), y = dy(nd);
        const pulse = nd.isHub ? 0.7 + Math.sin(t * 0.0008 + nd.phase) * 0.3 : 1;
        const alpha = nd.isHub ? 0.88 * pulse : 0.5;
        const blur  = nd.isHub ? 18 : 10;
        const r     = nd.r * (nd.isHub ? pulse : 1);
        ctx.save();
        ctx.shadowColor = nd.isHub ? '#79b8ff' : '#58a6ff';
        ctx.shadowBlur  = blur;
        ctx.fillStyle   = `rgba(88,166,255,${alpha})`;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        nd.x += nd.vx; nd.y += nd.vy;
        if (nd.x < 0 || nd.x > canvas.width)  nd.vx *= -1;
        if (nd.y < 0 || nd.y > canvas.height) nd.vy *= -1;
      }

      raf = requestAnimationFrame(frame);
    }

    const onMouse = (e) => {
      mouseRef.current = {
        x: e.clientX / window.innerWidth  - 0.5,
        y: e.clientY / window.innerHeight - 0.5,
      };
    };
    const onResize = () => { resize(); spawn(); };

    resize(); spawn();
    raf = requestAnimationFrame(frame);
    window.addEventListener('resize',    onResize, { passive: true });
    window.addEventListener('mousemove', onMouse,  { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(pulseTimer);
      window.removeEventListener('resize',    onResize);
      window.removeEventListener('mousemove', onMouse);
    };
  }, [n, conn]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}
    />
  );
}

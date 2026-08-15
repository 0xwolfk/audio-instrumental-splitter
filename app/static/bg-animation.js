(() => {
  const canvas = document.getElementById("bgCanvas");
  const ctx = canvas.getContext("2d");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const COLORS = [
    "255, 77, 109",   // accent pink/red
    "230, 231, 234",  // faint neutral
    "154, 155, 163",  // muted grey
  ];

  let width, height, dpr;
  let motes = [];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function makeMote() {
    const points = 6 + Math.floor(rand(0, 3)); // irregular 6-8 sided blob
    const spikes = [];
    for (let i = 0; i < points; i++) {
      spikes.push({
        angle: (i / points) * Math.PI * 2,
        amp: rand(0.25, 0.55),
        phase: rand(0, Math.PI * 2),
        speed: rand(0.15, 0.35),
      });
    }
    return {
      x: rand(0, width),
      y: rand(0, height),
      vx: rand(-0.06, 0.06),
      vy: rand(-0.05, 0.05),
      baseRadius: rand(1.5, 4.5),
      color: COLORS[Math.floor(rand(0, COLORS.length))],
      opacity: rand(0.06, 0.22),
      spikes,
      driftPhase: rand(0, Math.PI * 2),
      driftSpeed: rand(0.05, 0.12),
    };
  }

  function initMotes() {
    const count = Math.round((width * height) / 26000);
    motes = Array.from({ length: Math.min(Math.max(count, 18), 60) }, makeMote);
  }

  function drawMote(mote, t) {
    const { x, y, baseRadius, spikes, color, opacity } = mote;
    ctx.beginPath();
    spikes.forEach((s, i) => {
      const wobble = 1 + s.amp * Math.sin(t * s.speed + s.phase);
      const r = baseRadius * wobble;
      const px = x + Math.cos(s.angle) * r;
      const py = y + Math.sin(s.angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fillStyle = `rgba(${color}, ${opacity})`;
    ctx.fill();
  }

  function step(timestamp) {
    const t = timestamp / 1000;
    ctx.clearRect(0, 0, width, height);

    for (const mote of motes) {
      mote.x += mote.vx + Math.sin(t * mote.driftSpeed + mote.driftPhase) * 0.02;
      mote.y += mote.vy + Math.cos(t * mote.driftSpeed + mote.driftPhase) * 0.02;

      if (mote.x < -10) mote.x = width + 10;
      if (mote.x > width + 10) mote.x = -10;
      if (mote.y < -10) mote.y = height + 10;
      if (mote.y > height + 10) mote.y = -10;

      drawMote(mote, t);
    }

    requestAnimationFrame(step);
  }

  resize();
  initMotes();

  window.addEventListener("resize", () => {
    resize();
    initMotes();
  });

  if (!prefersReducedMotion) {
    requestAnimationFrame(step);
  }
})();

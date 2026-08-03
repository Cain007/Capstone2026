import { useEffect, useRef } from 'react';

type SmokeParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  spin: number;
  life: number;
  ttl: number;
  hue: number;
  alpha: number;
};

const MAX_PARTICLES = 260;

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export default function SmokeStreams() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { alpha: true });

    if (!canvas || !context) {
      return undefined;
    }

    let animationFrame = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let lastTime = performance.now();
    const particles: SmokeParticle[] = [];
    const pointer = {
      lastX: window.innerWidth * 0.5,
      lastY: window.innerHeight * 0.55,
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawnParticle = (
      x: number,
      y: number,
      forceX = randomBetween(-0.28, 0.28),
      forceY = randomBetween(-1.6, -0.45),
      intensity = 1,
    ) => {
      if (particles.length >= MAX_PARTICLES) {
        particles.splice(0, particles.length - MAX_PARTICLES + 1);
      }

      particles.push({
        x: x + randomBetween(-12, 12) * intensity,
        y: y + randomBetween(-10, 10) * intensity,
        vx: forceX + randomBetween(-0.18, 0.18),
        vy: forceY + randomBetween(-0.18, 0.18),
        size: randomBetween(24, 72) * intensity,
        spin: randomBetween(-0.018, 0.018),
        life: 0,
        ttl: randomBetween(130, 230),
        hue: randomBetween(178, 284),
        alpha: randomBetween(0.12, 0.28),
      });
    };

    const emitAmbientSmoke = (time: number) => {
      const sourceCount = width < 700 ? 2 : 4;

      for (let index = 0; index < sourceCount; index += 1) {
        const x =
          width * (0.14 + index * (0.72 / Math.max(1, sourceCount - 1))) +
          Math.sin(time * 0.0006 + index * 2.4) * 34;
        const y = height * (0.78 + Math.sin(time * 0.0004 + index) * 0.08);
        spawnParticle(x, y, randomBetween(-0.16, 0.16), randomBetween(-1.15, -0.48), 0.75);
      }
    };

    const emitPointerSmoke = (clientX: number, clientY: number) => {
      const dx = clientX - pointer.lastX;
      const dy = clientY - pointer.lastY;
      const speed = Math.min(Math.hypot(dx, dy), 44);
      const amount = Math.max(2, Math.ceil(speed / 8));

      for (let index = 0; index < amount; index += 1) {
        const progress = index / amount;
        const x = pointer.lastX + dx * progress;
        const y = pointer.lastY + dy * progress;
        spawnParticle(x, y, dx * 0.012, dy * 0.012 - 0.65, 0.9);
      }

      pointer.lastX = clientX;
      pointer.lastY = clientY;
    };

    const handlePointerMove = (event: PointerEvent) => {
      emitPointerSmoke(event.clientX, event.clientY);
    };

    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];

      if (touch) {
        emitPointerSmoke(touch.clientX, touch.clientY);
      }
    };

    const drawParticle = (particle: SmokeParticle, delta: number) => {
      particle.life += delta;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vx += Math.sin((particle.life + particle.x) * 0.015) * particle.spin * delta;
      particle.vy -= 0.0025 * delta;

      const progress = particle.life / particle.ttl;
      const fade = Math.sin(Math.min(progress, 1) * Math.PI);
      const radius = particle.size * (0.72 + progress * 1.7);
      const gradient = context.createRadialGradient(
        particle.x,
        particle.y,
        0,
        particle.x,
        particle.y,
        radius,
      );

      gradient.addColorStop(0, `hsla(${particle.hue}, 84%, 76%, ${particle.alpha * fade})`);
      gradient.addColorStop(0.42, `hsla(${particle.hue + 24}, 76%, 62%, ${particle.alpha * 0.42 * fade})`);
      gradient.addColorStop(1, 'hsla(230, 40%, 12%, 0)');

      context.globalCompositeOperation = 'lighter';
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
      context.fill();
    };

    const render = (time: number) => {
      const delta = Math.min((time - lastTime) / 16.67, 2);
      lastTime = time;

      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = 'source-over';

      if (Math.floor(time / 70) !== Math.floor((time - delta * 16.67) / 70)) {
        emitAmbientSmoke(time);
      }

      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index];

        if (particle.life >= particle.ttl) {
          particles.splice(index, 1);
        } else {
          drawParticle(particle, delta);
        }
      }

      animationFrame = requestAnimationFrame(render);
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    animationFrame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  return <canvas ref={canvasRef} className="smoke-streams-canvas" aria-hidden="true" />;
}

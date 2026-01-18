"use client";

import { useEffect, useRef } from "react";

class Particle {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  size = 0;
  alpha = 0;
  fadeDir = 0;
  color = "255, 255, 220";
  width = 0;
  height = 0;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.init();
  }

  init() {
    this.x = Math.random() * this.width;
    this.y = Math.random() * this.height;
    this.vx = (Math.random() - 0.5) * 0.4;
    this.vy = (Math.random() - 0.5) * 0.4 - 0.1;
    this.size = Math.random() * 3 + 1;
    this.alpha = Math.random() * 0.5;
    this.fadeDir = Math.random() > 0.5 ? 0.004 : -0.004;
    this.color = `255, 255, ${Math.floor(Math.random() * 55 + 200)}`;
  }

  update(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.x += this.vx;
    this.y += this.vy;
    this.alpha += this.fadeDir;

    if (this.alpha <= 0 || this.alpha >= 0.8) {
      this.fadeDir *= -1;
    }

    if (this.x < 0 || this.x > width || this.y < 0 || this.y > height) {
      this.init();
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${this.color}, ${this.alpha})`;
    ctx.shadowBlur = 10;
    ctx.shadowColor = "white";
    ctx.fill();
  }
}

class LightBeam {
  x = 0;
  y = -100;
  angle = Math.PI / 4;
  length = 0;
  width = 0;
  alpha = 0;
  targetAlpha = 0;
  state: "in" | "stay" | "out" = "in";
  speed = 0.002;
  height = 0;

  constructor(width: number, height: number) {
    this.height = height;
    this.init(width, height);
  }

  init(width: number, height: number) {
    this.x = Math.random() * width;
    this.y = -100;
    this.angle = Math.PI / 4 + (Math.random() - 0.5) * 0.2;
    this.length = Math.random() * height * 1.5;
    this.width = Math.random() * 100 + 50;
    this.alpha = 0;
    this.targetAlpha = Math.random() * 0.1 + 0.05;
    this.state = "in";
    this.speed = Math.random() * 0.002 + 0.001;
  }

  update(width: number, height: number) {
    this.height = height;
    if (this.state === "in") {
      this.alpha += this.speed;
      if (this.alpha >= this.targetAlpha) {
        this.state = "stay";
      }
    } else if (this.state === "stay") {
      if (Math.random() < 0.005) {
        this.state = "out";
      }
    } else {
      this.alpha -= this.speed;
      if (this.alpha <= 0) {
        this.init(width, height);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    const grad = ctx.createLinearGradient(0, 0, 0, this.length);
    grad.addColorStop(0, "rgba(255, 253, 224, 0)");
    grad.addColorStop(0.5, `rgba(255, 253, 224, ${this.alpha})`);
    grad.addColorStop(1, "rgba(255, 253, 224, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(-this.width / 2, 0, this.width, this.length);
    ctx.restore();
  }
}

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    let width = 0;
    let height = 0;
    let animationId = 0;
    const particles: Particle[] = [];
    const beams: LightBeam[] = [];

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < 90; i += 1) {
      particles.push(new Particle(width, height));
    }
    for (let i = 0; i < 5; i += 1) {
      beams.push(new LightBeam(width, height));
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      beams.forEach((beam) => {
        beam.update(width, height);
        beam.draw(ctx);
      });
      particles.forEach((particle) => {
        particle.update(width, height);
        particle.draw(ctx);
      });
      animationId = window.requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <main className="landing-morning">
      <div className="landing-morning__bg" />
      <canvas ref={canvasRef} className="landing-morning__canvas" />

      <section className="landing-morning__card">
        <div className="landing-morning__title">QR Parking MVP</div>
        <div className="landing-morning__sub">
          초대 기반으로 입주민 확인과 스캔 알림을 제공하는
          QR 주차 관리 솔루션입니다.
        </div>
        <div className="landing-morning__pulse">
          로그인 준비 중<span className="landing-dot">.</span>
          <span className="landing-dot">.</span>
          <span className="landing-dot">.</span>
        </div>
        <a className="landing-morning__cta" href="/auth/login">
          로그인 화면으로 이동
        </a>
      </section>
    </main>
  );
}

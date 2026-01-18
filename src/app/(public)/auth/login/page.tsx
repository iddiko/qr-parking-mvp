"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabase/client";

const MIN_LANDING_MS = 1200;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const routeByRole = (role: string | null | undefined) => {
    if (role === "SUPER") return "/dashboard/super";
    if (role === "MAIN") return "/dashboard/main";
    if (role === "SUB") return "/dashboard/sub";
    if (role === "GUARD") return "/scan";
    if (role === "RESIDENT") return "/my-qr";
    return "/auth/login";
  };

  const redirectForUser = async (userId: string) => {
    const { data } = await supabaseClient.from("profiles").select("role").eq("id", userId).single();
    router.push(routeByRole(data?.role));
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLanding(false);
    }, MIN_LANDING_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const loadLogo = async () => {
      const response = await fetch("/api/branding");
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      if (data?.logo_url) {
        setLogoUrl(data.logo_url);
      }
    };
    loadLogo();
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabaseClient.auth.getSession();
      if (data.session?.user) {
        setIsRedirecting(true);
        await redirectForUser(data.session.user.id);
      }
    };
    checkSession();
  }, [router]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus(null);
    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setStatus("로그인에 실패했습니다. 다시 확인해주세요.");
      setIsSubmitting(false);
      return;
    }
    const { data } = await supabaseClient.auth.getSession();
    if (data.session?.user) {
      await redirectForUser(data.session.user.id);
      return;
    }
    router.push("/auth/login");
  };

  if (showLanding) {
    return (
      <div className="login-layout">
        <header className="login-header">
          <div className="login-header__brand">QR Parking MVP</div>
        </header>
        <main className="login-body landing landing-full">
          <div className="landing-orb landing-orb--a" />
          <div className="landing-orb landing-orb--b" />
          <div className="landing-orb landing-orb--c" />
          <div className="landing-card landing-card--hero">
            <div className="landing-title">QR 주차 MVP</div>
            <div className="landing-sub">초대 기반으로 차량 여부를 확인하고, 스캔 알림을 즉시 전달합니다.</div>
            <div className="landing-pulse">
              로그인 준비 중<span className="landing-dot">.</span>
              <span className="landing-dot">.</span>
              <span className="landing-dot">.</span>
            </div>
          </div>
        </main>
        <footer className="login-footer">QR Parking MVP</footer>
      </div>
    );
  }

  return (
    <div className="login-layout">
      <header className="login-header">
        <div className="login-header__brand">QR Parking MVP</div>
      </header>
      <main className="login-body login-wrap">
        <form onSubmit={onSubmit} className="login-card">
          <div className="login-title">로그인</div>
          <div className="login-logo" aria-label="회사 로고 영역">
            {logoUrl ? <img className="login-logo__img" src={logoUrl} alt="회사 로고" /> : null}
          </div>
          <div className="login-hint">
            초대받은 계정으로 로그인하세요. 권한에 따라 경비/입주민/관리자 화면이 자동으로 연결됩니다.
          </div>
          <label className="login-field">
            이메일
            <input
              className="login-input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@example.com"
              required
            />
          </label>
          <label className="login-field" style={{ position: "relative" }}>
            비밀번호
            <input
              className="login-input"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="비밀번호"
              required
            />
          <button
            className="eye-button"
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label="비밀번호 보기"
          >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M1.5 12s4-7.5 10.5-7.5S22.5 12 22.5 12s-4 7.5-10.5 7.5S1.5 12 1.5 12z" />
                <circle cx="12" cy="12" r="3.5" />
              </svg>
            </button>
          </label>
          {status ? <div className="muted">{status}</div> : null}
          <button className="login-button" type="submit" disabled={isSubmitting || isRedirecting}>
            {isSubmitting || isRedirecting ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </main>
      <footer className="login-footer">회원가입은 관리자가 보낸 링크 URL을 클릭하세요.</footer>
    </div>
  );
}

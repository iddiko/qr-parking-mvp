export default function Page() {
  return (
    <main className="landing-full">
      <div className="landing-orb landing-orb--a" />
      <div className="landing-orb landing-orb--b" />
      <div className="landing-orb landing-orb--c" />

      <section className="landing-card landing-card--hero">
        <div className="landing-title">QR Parking MVP</div>
        <div className="landing-sub">
          초대 기반으로 입주민 확인과 스캔 알림을 제공하는
          QR 주차 관리 솔루션입니다.
        </div>
        <div className="landing-pulse">
          로그인 준비 중<span className="landing-dot">.</span>
          <span className="landing-dot">.</span>
          <span className="landing-dot">.</span>
        </div>
        <a className="landing-cta" href="/auth/login">
          로그인 화면으로 이동
        </a>
      </section>
    </main>
  );
}

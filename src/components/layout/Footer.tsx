type FooterProps = {
  onMenuToggle?: () => void;
};

export function Footer({ onMenuToggle }: FooterProps) {
  return (
    <footer className="app-footer">
      <button className="menu-toggle menu-toggle--footer" type="button" aria-label="메뉴 열기" onClick={onMenuToggle}>
        <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      <span className="footer-brand">QR Parking MVP</span>
    </footer>
  );
}

export type MenuItem = {
  key: string;
  label: string;
  href: string;
};

export const menuConfig: Record<string, MenuItem[]> = {
  admin: [
    { key: "dashboard", label: "대시보드", href: "/dashboard" },
    { key: "complexes", label: "단지 관리", href: "/complexes" },
    { key: "buildings", label: "동 관리", href: "/buildings" },
    { key: "members", label: "회원 관리", href: "/members" },
    { key: "users", label: "사용자 초대", href: "/users" },
    { key: "approvals", label: "승인", href: "/approvals" },
    { key: "parking.qrs", label: "주차 QR", href: "/parking/qrs" },
    { key: "parking.scans", label: "경비 스캔 리스트(log)", href: "/parking/scans" },
    { key: "meter.cycles", label: "검침 주기", href: "/meter/cycles" },
    { key: "meter.submissions", label: "검침 제출", href: "/meter/submissions" },
    { key: "notices", label: "공지", href: "/admin/notices" },
    { key: "settings", label: "설정", href: "/settings" },
    { key: "mypage", label: "마이페이지", href: "/admin/mypage" },
    { key: "notifications", label: "알림", href: "/admin/notifications" },
  ],
  guard: [
    { key: "scan", label: "QR 스캔", href: "/scan" },
    { key: "history", label: "스캔 이력", href: "/history" },
    { key: "notices", label: "공지", href: "/guard/notices" },
    { key: "mypage", label: "마이페이지", href: "/guard/mypage" },
    { key: "notifications", label: "알림", href: "/guard/notifications" },
  ],
  resident: [
    { key: "scan", label: "QR 스캔", href: "/resident/scan" },
    { key: "myQr", label: "내 QR", href: "/my-qr" },
    { key: "alerts", label: "알림", href: "/alerts" },
    { key: "meter", label: "검침", href: "/meter" },
    { key: "notices", label: "공지", href: "/resident/notices" },
    { key: "mypage", label: "마이페이지", href: "/resident/mypage" },
    { key: "notifications", label: "알림 내역", href: "/resident/notifications" },
  ],
};

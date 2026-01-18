# Menu Toggle Test

목표: 메뉴 토글 OFF 시 UI/페이지/API가 모두 403으로 동작하는지 확인.

## 사전 준비
- 관리자 계정 로그인 가능
- Edit Mode ON 필요(SUPER 기준)

## 공통 확인 방법
1) `/settings`에서 토글 OFF 저장
2) 사이드바에서 해당 메뉴가 숨김인지 확인
3) 직접 URL 접근 시 403 확인
4) API 호출 시 403 확인

## 테스트 케이스
### RESIDENT meter OFF
- 토글: resident.meter = false
- UI: 사이드바에서 "검침" 메뉴 숨김
- 페이지: `/meter` 접근 시 403
- API: `GET /api/meter?type=cycles` 403

### RESIDENT notifications OFF
- 토글: resident.notifications = false
- UI: 사이드바에서 "알림 내역" 메뉴 숨김
- 페이지: `/notifications` 접근 시 403
- API: `GET /api/notifications` 403

### GUARD scan OFF
- 토글: guard.scan = false
- UI: 사이드바에서 "스캔" 메뉴 숨김
- 페이지: `/scan` 접근 시 403
- API: `POST /api/scan` 403

### SUB settings OFF
- 토글: sub.settings = false
- UI: 사이드바에서 "설정" 메뉴 숨김
- 페이지: `/settings` 접근 시 403
- API: `GET /api/settings` 403

## 기대 결과
- 메뉴 토글 OFF 시 UI/페이지/API 모두 403으로 차단됨

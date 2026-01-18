# QR_SYS_V01 TASKS

## 작업 규칙
- 추가 기능 제안 금지. 체크리스트 충족 전 완료 인정 불가.
- 보고 형식: (1) 수정 파일 목록 (2) 수동 테스트 경로 3줄 (3) 남은 이슈 3개 이내.
- 이후 지시사항은 TASKS/SUMMARY에 반영.

## 목표(MVP)
QR 스캔 판별 + 스캔 알림 + 초대 가입 + 가스 검침(직접입력) + 공지 + 권한별 메뉴 토글 + 헤더/마이페이지/로그아웃/알림 아이콘.

## 역할
SUPER / MAIN / SUB / GUARD / RESIDENT

## SUPER Edit Mode
- SUPER는 기본 READ-ONLY, Edit Mode ON에서만 수정 가능
- 서버에서도 edit-mode 강제
- SUPER는 알림 수신 대상 아님

## 메뉴 토글 규칙
- OFF: 사이드바 숨김 + 페이지 403 + API 403
- 상위 관리자가 하위 메뉴 관리

## WBS 순서
1) Supabase migrations(0001/0002/0003/0004/0005)
2) AppFrame/Header/Sidebar 기본 레이아웃
3) Auth/roles/guards/403
4) settings 저장/조회 + admin/settings UI
5) menu.config 기반 메뉴 렌더링
6) 초대 가입 + 차량/QR 생성
7) 승인 흐름 -> QR ACTIVE
8) 스캔 API -> 로그/알림/이메일
9) meter cycles/submissions + notices
10) bulk invite 업로드/발송

## 최근 진행
- 마이페이지 팝업 + 내 정보/QR/로그아웃 정리
- 사이드바 역할 표시 + 단지/동/호 표시
- 경비/입주민 스캔 카메라 자동 시작, 위치 권한 요청
- 스캔 결과/차량번호 표시, 스캔 이력/알림 저장
- 알림 위치 클릭 시 지도 연결(좌표 기반)
- 내 정보 수정 가능(이름/이메일/전화번호), 대표번호 지정
- 내 정보 수정 시 관리자(MAIN/SUB) 알림 발송

## 테스트 문서
- docs/INVITE_APPROVAL_TEST.md
- docs/MENU_TOGGLE_TEST.md

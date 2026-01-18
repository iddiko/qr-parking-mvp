# Invite To Approval Test

목표: 초대 가입 -> 차량/QR 생성 -> 승인 -> QR ACTIVE 전환 흐름 확인.

## 사전 준비
- 관리자 계정으로 로그인 가능해야 함.
- 초대 메일 수신 가능하거나 초대 링크를 직접 확인할 수 있어야 함.
- Edit Mode ON 필요(SUPER 기준).

## 절차
1) 관리자 로그인 후 `/users`에서 RESIDENT 초대 생성
2) 초대 목록에서 방금 생성된 초대 확인(상태 SENT)
3) 초대 링크로 `/auth/invite?token=...` 접속
4) 차량 있음 선택 -> 차량번호/차량타입 입력 -> 가입 완료
5) 관리자 `/approvals`에서 방금 가입한 항목 확인
6) 승인 버튼 클릭 -> 승인 완료 확인

## 확인 쿼리(SQL Editor)
1) 초대 상태 확인
```sql
select email, role, status, sent_at, accepted_at
from invites
order by created_at desc
limit 5;
```

2) 차량/QR 생성 확인
```sql
select v.id, v.plate, v.vehicle_type, q.status, q.code
from vehicles v
join qrs q on q.vehicle_id = v.id
order by v.created_at desc
limit 5;
```

3) 승인 후 ACTIVE 확인
```sql
select q.id, q.status, v.plate
from qrs q
join vehicles v on v.id = q.vehicle_id
order by q.created_at desc
limit 5;
```

## 기대 결과
- 초대 가입 후 invites.status = ACCEPTED
- 차량 있음 가입 시 vehicles/qrs 생성
- 승인 후 qrs.status = ACTIVE

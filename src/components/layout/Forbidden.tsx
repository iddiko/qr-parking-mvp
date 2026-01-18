export function Forbidden({ message }: { message?: string }) {
  return (
    <div>
      <h1 className="page-title">403</h1>
      <p className="muted">{message ?? "접근 권한이 없습니다."}</p>
    </div>
  );
}

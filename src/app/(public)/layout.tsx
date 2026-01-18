import type { ReactNode } from "react";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <div style={{ minHeight: "100vh", padding: "40px 20px" }}>{children}</div>;
}

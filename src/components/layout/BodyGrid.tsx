import type { ReactNode } from "react";

export function BodyGrid({ children }: { children: ReactNode }) {
  return <div className="body-grid">{children}</div>;
}

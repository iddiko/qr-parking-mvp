import type { ReactNode } from "react";
import "./globals.css";
import { BrandingClient } from "@/components/layout/BrandingClient";

export const metadata = {
  title: "QR Parking MVP",
  description: "QR Parking MVP",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <BrandingClient />
        {children}
      </body>
    </html>
  );
}

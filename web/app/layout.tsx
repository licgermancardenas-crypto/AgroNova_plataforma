import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgroNova · Decision Intelligence Platform",
  description: "Plataforma analítica corporativa — AgroNova Argentina S.A.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "California | Creative Intelligence",
  description: "Central de inteligência da pauta de criação do Ecossistema California.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0B0B0C", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

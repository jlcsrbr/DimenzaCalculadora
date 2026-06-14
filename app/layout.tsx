import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dimenza 3D – Calculadora",
  description: "Sistema de cotizaciones y ventas para impresión 3D multimaterial",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

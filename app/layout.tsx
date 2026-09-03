import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Suspense, type ReactNode } from "react";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/shell/app-shell";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Indicadores EC · Hospital São Joaquim",
  description: "Dashboard interno de Engenharia Clínica — GlobalThings / SJH",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Providers>
          <Suspense fallback={<div className="p-6 text-sm text-slate-500">Carregando filtros…</div>}>
            <AppShell>{children}</AppShell>
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}

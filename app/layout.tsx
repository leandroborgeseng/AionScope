import type { Metadata } from "next";
import { Barlow_Condensed, Montserrat, Outfit } from "next/font/google";
import { Suspense, type ReactNode } from "react";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/shell/app-shell";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

/** Etiquetas Niimbot (kit oficial AION) — canvas usa estas famílias. */
const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["600", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Indicadores EC · Hospital São Joaquim",
  description: "Dashboard interno de Engenharia Clínica — Aion / SJH",
  icons: {
    icon: [{ url: "/aion-mark.png", type: "image/png" }],
    apple: "/aion-mark.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${outfit.variable} ${outfit.className} ${barlowCondensed.variable} ${montserrat.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Providers>
          <Suspense fallback={<div className="p-6 text-sm text-aion-muted">Carregando filtros…</div>}>
            <AppShell>{children}</AppShell>
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}

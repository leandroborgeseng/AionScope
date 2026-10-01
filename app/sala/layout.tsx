import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "./sala.css";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "Sala operacional · Engenharia Clínica",
};

export default function SalaLayout({ children }: { children: ReactNode }) {
  return <div className={mono.variable}>{children}</div>;
}

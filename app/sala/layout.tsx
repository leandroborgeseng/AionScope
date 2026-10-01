import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Sala operacional · Engenharia Clínica",
};

export default function SalaLayout({ children }: { children: ReactNode }) {
  return children;
}

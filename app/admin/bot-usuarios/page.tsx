import type { Metadata } from "next";
import { TelaBotUsuarios } from "@/components/admin/bot-usuarios/tela";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bot · usuários · AionScope",
};

export default function PaginaBotUsuarios() {
  return <TelaBotUsuarios />;
}

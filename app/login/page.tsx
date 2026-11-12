import type { Metadata } from "next";
import { connection } from "next/server";
import { destinoSeguro } from "@/lib/auth/painel-guard";
import { painelConfigurado } from "@/lib/auth/painel-sessao";
import { TelaLogin } from "./tela-login";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Entrar · AionScope",
  description: "Acesso restrito.",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; erro?: string }>;
}) {
  await connection();
  const params = await searchParams;
  return <TelaLogin disponivel={painelConfigurado()} next={destinoSeguro(params.next)} erro={params.erro} />;
}

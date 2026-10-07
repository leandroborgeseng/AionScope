"use client";

import { useEffect, useState } from "react";
import type { PainelTreinamentos } from "@/lib/treinamentos/types";
import { META_RECICLAGEM_PCT } from "@/lib/treinamentos/calcular";

function corFaixa(faixa: string) {
  if (faixa === "ok") return "#3E7A1E";
  if (faixa === "atencao") return "#A8460A";
  return "#A3123A";
}

/** Tela-resumo TV: KPIs + continuidade por setor (sem nomes — LGPD). */
export function TvTreinamentos({ painel: inicial }: { painel?: PainelTreinamentos | null }) {
  const [painel, setPainel] = useState<PainelTreinamentos | null>(inicial ?? null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (inicial) return;
    let cancel = false;
    (async () => {
      try {
        const res = await fetch("/api/treinamentos/resumo", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as PainelTreinamentos;
        if (!cancel) setPainel(data);
      } catch (e) {
        if (!cancel) setErro(e instanceof Error ? e.message : "Falha ao carregar");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [inicial]);

  if (erro) {
    return <p className="sala-vazio">Treinamentos: {erro}</p>;
  }
  if (!painel) {
    return <p className="sala-vazio">Carregando treinamentos…</p>;
  }

  const aAnt = painel.anos.find((a) => a.ano === painel.ano_anterior);
  const aAtual = painel.anos.find((a) => a.ano === painel.ano_atual);
  const topSetores = painel.setores.slice(0, 14);

  return (
    <div className="sala-coluna" style={{ flex: 1, minHeight: 0, gap: 16 }}>
      <p style={{ margin: 0, fontSize: 18, color: "#4E6079" }}>
        {painel.treinamento} · base consolidada · sem nomes na TV
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: 14,
        }}
      >
        <div className="sala-cartao">
          <div className="sala-rotulo-bloco">BASE {painel.ano_anterior}</div>
          <div className="sala-numero" style={{ fontSize: 56, color: "#3E7A1E" }}>
            {aAnt?.treinados ?? "—"}
          </div>
          <span style={{ fontSize: 18, color: "#4E6079" }}>já capacitados</span>
        </div>
        <div className="sala-cartao">
          <div className="sala-rotulo-bloco">TURMA {painel.ano_atual}</div>
          <div className="sala-numero" style={{ fontSize: 56 }}>
            {aAtual?.treinados ?? "—"}
          </div>
          <span style={{ fontSize: 18, color: "#4E6079" }}>
            {painel.reciclados_atual} recorrentes + {painel.novos_atual} novos
          </span>
        </div>
        <div className="sala-cartao">
          <div className="sala-rotulo-bloco">CONTINUIDADE</div>
          <div
            className="sala-numero"
            style={{
              fontSize: 56,
              color:
                painel.taxa_reciclagem_geral_pct >= 40
                  ? "#3E7A1E"
                  : "#A8460A",
            }}
          >
            {painel.taxa_reciclagem_geral_pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
          </div>
          <span style={{ fontSize: 18, color: "#4E6079" }}>
            já capacitados retornaram · meta {META_RECICLAGEM_PCT}%
          </span>
        </div>
        <div className="sala-cartao">
          <div className="sala-rotulo-bloco">NOVOS {painel.ano_atual}</div>
          <div className="sala-numero" style={{ fontSize: 56 }}>
            {painel.novos_atual}
          </div>
          <span style={{ fontSize: 18, color: "#4E6079" }}>
            {painel.taxa_novos_pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% da turma
          </span>
        </div>
        <div className="sala-cartao">
          <div className="sala-rotulo-bloco">HORAS·HOMEM</div>
          <div className="sala-numero" style={{ fontSize: 44 }}>
            {aAnt?.horas_homem}/{aAtual?.horas_homem}
          </div>
          <span style={{ fontSize: 18, color: "#4E6079" }}>
            {painel.ano_anterior} / {painel.ano_atual}
          </span>
        </div>
      </div>

      <div className="sala-cartao" style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <div className="sala-rotulo-bloco">POR SETOR · BASE → RECORRENTES + NOVOS</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "6px 28px",
            marginTop: 8,
          }}
        >
          {topSetores.map((s) => (
            <div
              key={s.setor}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) 90px 70px",
                gap: 10,
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={s.setor}
              >
                {s.setor}
              </span>
              <strong style={{ fontSize: 18, textAlign: "right", color: "#4E6079" }}>
                {s.treinados_anterior} → {s.reciclados_atual}+{s.novos_atual}
              </strong>
              <strong style={{ fontSize: 20, color: corFaixa(s.faixa), textAlign: "right" }}>
                {Math.round(s.taxa_reciclagem_pct)}%
              </strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

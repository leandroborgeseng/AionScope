"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, FileText, Sparkles, Users, UserPlus, X } from "lucide-react";
import type { PainelTreinamentos } from "@/lib/treinamentos/types";

type EvidenciasStatus = {
  tokenObrigatorio: boolean;
  anos: string[];
  liberado: boolean;
};

/** Tela TV: maturidade da equipe + evidências PDF (sem nomes — LGPD). */
export function TvTreinamentos({
  painel: inicial,
  onInteracaoChange,
}: {
  painel?: PainelTreinamentos | null;
  onInteracaoChange?: (ativa: boolean) => void;
}) {
  const [painel, setPainel] = useState<PainelTreinamentos | null>(inicial ?? null);
  const [erro, setErro] = useState<string | null>(null);
  const [evidencias, setEvidencias] = useState<EvidenciasStatus | null>(null);
  const [listaAno, setListaAno] = useState<string | null>(null);

  useEffect(() => {
    if (inicial) {
      setPainel(inicial);
      return;
    }
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

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch("/api/treinamentos/evidencias/status", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as EvidenciasStatus;
        if (!cancel) setEvidencias(data);
      } catch {
        /* evidências opcionais na TV */
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    onInteracaoChange?.(Boolean(listaAno));
    return () => onInteracaoChange?.(false);
  }, [listaAno, onInteracaoChange]);

  useEffect(() => {
    if (!listaAno) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setListaAno(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [listaAno]);

  if (erro) {
    return <p className="sala-vazio">Treinamentos: {erro}</p>;
  }
  if (!painel) {
    return <p className="sala-vazio">Carregando treinamentos…</p>;
  }

  const aAnt = painel.anos.find((a) => a.ano === painel.ano_anterior);
  const aAtual = painel.anos.find((a) => a.ano === painel.ano_atual);
  const topSetores = painel.setores.slice(0, 12);
  const anosLista = evidencias?.anos ?? [];
  const podeAbrir = evidencias ? !evidencias.tokenObrigatorio || evidencias.liberado : false;
  const maxSetor = Math.max(
    1,
    ...topSetores.map((s) => Math.max(s.treinados_anterior, s.reciclados_atual + s.novos_atual)),
  );

  return (
    <div className="sala-tv-treinamentos">
      <div className="sala-tv-treinamentos-hero">
        <div className="sala-tv-treinamentos-hero-copy">
          <span className="sala-tv-treinamentos-selo">
            <Sparkles size={18} strokeWidth={2.4} aria-hidden />
            Resultado positivo
          </span>
          <h2 className="sala-tv-treinamentos-titulo">
            {painel.treinamento}
          </h2>
          <p className="sala-tv-treinamentos-mensagem">
            Treinamento <strong>opcional</strong>. Quem não participou em geral{" "}
            <strong>já sabe operar</strong> a bomba — isso é maturidade da equipe, não atraso.
          </p>
        </div>
        <div className="sala-tv-treinamentos-hero-numero" aria-label="Já aptos sem reforço">
          <div className="sala-rotulo-bloco">JÁ APTOS · SEM REFORÇO</div>
          <div className="sala-numero sala-tv-treinamentos-destaque">{painel.aptos_sem_reforco}</div>
          <span>
            da base {painel.ano_anterior} ({aAnt?.treinados ?? "—"}) · sabem o que precisam
          </span>
        </div>
      </div>

      <div className="sala-tv-treinamentos-kpis">
        <div className="sala-cartao sala-tv-treinamentos-kpi ok">
          <CheckCircle2 size={28} strokeWidth={2.2} aria-hidden />
          <div>
            <div className="sala-rotulo-bloco">BASE {painel.ano_anterior}</div>
            <div className="sala-numero" style={{ fontSize: 48 }}>
              {aAnt?.treinados ?? "—"}
            </div>
            <span>já capacitados</span>
          </div>
        </div>
        <div className="sala-cartao sala-tv-treinamentos-kpi">
          <Users size={28} strokeWidth={2.2} aria-hidden />
          <div>
            <div className="sala-rotulo-bloco">REFORÇO {painel.ano_atual}</div>
            <div className="sala-numero" style={{ fontSize: 48 }}>
              {painel.reciclados_atual}
            </div>
            <span>
              {painel.taxa_reciclagem_geral_pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
              optaram por atualizar
            </span>
          </div>
        </div>
        <div className="sala-cartao sala-tv-treinamentos-kpi">
          <UserPlus size={28} strokeWidth={2.2} aria-hidden />
          <div>
            <div className="sala-rotulo-bloco">NOVOS {painel.ano_atual}</div>
            <div className="sala-numero" style={{ fontSize: 48 }}>
              {painel.novos_atual}
            </div>
            <span>
              {painel.taxa_novos_pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% da turma{" "}
              {aAtual?.treinados ?? ""}
            </span>
          </div>
        </div>
        <div className="sala-cartao sala-tv-treinamentos-kpi">
          <div>
            <div className="sala-rotulo-bloco">HORAS·HOMEM</div>
            <div className="sala-numero" style={{ fontSize: 40 }}>
              {aAnt?.horas_homem} / {aAtual?.horas_homem}
            </div>
            <span>
              {painel.ano_anterior} base · {painel.ano_atual} turma
            </span>
          </div>
        </div>
      </div>

      <div className="sala-tv-treinamentos-corpo">
        <div className="sala-cartao sala-tv-treinamentos-setores">
          <div className="sala-rotulo-bloco">POR SETOR · MATURIDADE</div>
          <p className="sala-tv-treinamentos-legenda">
            Base {painel.ano_anterior} · já aptos · reforço · novos — quem não voltou permanece capacitado
          </p>
          <div className="sala-tv-treinamentos-setores-lista">
            {topSetores.map((s) => {
              const aptos = Math.max(0, s.treinados_anterior - s.reciclados_atual);
              const turma = s.reciclados_atual + s.novos_atual;
              return (
                <div key={s.setor} className="sala-tv-treinamentos-setor-linha">
                  <span className="sala-tv-treinamentos-setor-nome" title={s.setor}>
                    {s.setor}
                  </span>
                  <div className="sala-tv-treinamentos-setor-barra" aria-hidden>
                    <i
                      className="base"
                      style={{ width: `${(100 * s.treinados_anterior) / maxSetor}%` }}
                    />
                    <i className="turma" style={{ width: `${(100 * turma) / maxSetor}%` }}>
                      <b style={{ width: `${turma ? (100 * s.reciclados_atual) / turma : 0}%` }} />
                      <b className="novos" style={{ width: `${turma ? (100 * s.novos_atual) / turma : 0}%` }} />
                    </i>
                  </div>
                  <strong className="sala-tv-treinamentos-setor-nums">
                    <span className="aptos">{aptos} aptos</span>
                    <span>
                      {s.reciclados_atual}+{s.novos_atual}
                    </span>
                  </strong>
                </div>
              );
            })}
          </div>
        </div>

        <div className="sala-cartao sala-tv-treinamentos-evidencias">
          <div className="sala-rotulo-bloco">LISTAS DE PRESENÇA</div>
          <p className="sala-tv-treinamentos-legenda">
            Evidências do treinamento · toque para abrir o PDF (sem nomes na grade da TV)
          </p>
          <div className="sala-tv-treinamentos-evidencias-botoes">
            {["2025", "2026"].map((ano) => {
              const tem = anosLista.includes(ano);
              return (
                <button
                  key={ano}
                  type="button"
                  className="sala-tv-treinamentos-btn-lista"
                  disabled={!tem || !podeAbrir}
                  onClick={() => setListaAno(ano)}
                >
                  <FileText size={32} strokeWidth={2.2} aria-hidden />
                  <span>
                    <strong>Lista {ano}</strong>
                    <small>
                      {!tem
                        ? "envie no painel Indicadores"
                        : !podeAbrir
                          ? "desbloqueie com token"
                          : ano === "2025"
                            ? "manuscritas · evidência"
                            : "Google Forms · evidência"}
                    </small>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="sala-tv-treinamentos-resumo-positivo">
            <CheckCircle2 size={22} strokeWidth={2.4} aria-hidden />
            <p>
              <strong>{painel.aptos_sem_reforco} profissionais</strong> da base já dominam o
              equipamento. A turma {painel.ano_atual} soma reforço pontual e novos — progresso, não
              regressão.
            </p>
          </div>
          <a className="sala-tv-treinamentos-link-painel" href="/indicadores/treinamentos-bombas">
            Painel completo · upload e filtros
          </a>
        </div>
      </div>

      {listaAno ? (
        <div className="sala-drill-overlay" role="dialog" aria-modal="true" aria-label={`Lista ${listaAno}`}>
          <button
            type="button"
            className="sala-drill-backdrop"
            aria-label="Fechar lista"
            onClick={() => setListaAno(null)}
          />
          <div className="sala-drill-sheet sala-tv-treinamentos-pdf-sheet">
            <div className="sala-drill-sheet-cabecalho">
              <div className="sala-drill-sheet-titulo">
                <span className="sala-drill-sheet-chip">evidência</span>
                <div className="sala-drill-sheet-heading">
                  <span className="sala-drill-sheet-icone" aria-hidden>
                    <FileText size={28} strokeWidth={2.2} />
                  </span>
                  <div>
                    <div className="sala-rotulo-bloco">LISTA DE PRESENÇA {listaAno}</div>
                    <div className="sala-tv-treinamentos-pdf-sub">
                      Bombas B. Braun · documento original
                    </div>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="sala-drill-limpar sala-drill-fechar"
                onClick={() => setListaAno(null)}
              >
                <X size={18} aria-hidden /> Fechar · Esc
              </button>
            </div>
            <iframe
              title={`Lista de presença ${listaAno}`}
              src={`/api/treinamentos/evidencias/${listaAno}`}
              className="sala-tv-treinamentos-pdf-frame"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

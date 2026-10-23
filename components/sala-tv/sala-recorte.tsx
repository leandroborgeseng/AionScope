"use client";

/**
 * Drill-down das telas Envelhecimento, Fluxo e Programadas (sala-drill-* da Sala).
 * A lista vem de /api/sala/recorte (mesma função que conta o gráfico, ver lib/ec/sala-recortes.ts).
 * O detalhe da OS é buscado na API no clique; se falhar, mostra o cache com "dados do cache".
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { LinhaRecorte, RecorteResolvido } from "@/lib/ec/sala-recortes";
import type { OsDetalheSnapshot, SalaDrillSelecao, SalaSnapshot } from "@/lib/ec/snapshot-tipos";
import { SalaOsDetalhePainel } from "@/components/sala-tv/sala-os-detalhe";

export const DRILL_IDLE_MS = 90_000;
const DETALHE_TIMEOUT_MS = 9_000;

export function isRecorteDrill(id: string) {
  return /^(envelhecimento|fluxo|programadas)\./.test(id);
}

// ------------------------------------------------------------------ filtros (C5/C9)

export type FiltrosRecorte = {
  etapa?: string;
  oficina?: string;
  tipo?: string;
  situacao?: string;
  periodo?: string;
  movimento?: string;
  ordem?: "antiga" | "recente";
};

const CHAVES_FILTRO: Array<[keyof FiltrosRecorte, string]> = [
  ["etapa", "f_etapa"],
  ["oficina", "f_oficina"],
  ["tipo", "f_tipo"],
  ["situacao", "f_situacao"],
  ["periodo", "f_periodo"],
  ["movimento", "f_mov"],
  ["ordem", "ordem"],
];

export type EstadoUrlDrill = { drill: string | null; os: string | null; filtros: FiltrosRecorte };

export function lerUrlDrill(search: string): EstadoUrlDrill {
  const params = new URLSearchParams(search);
  const filtros: FiltrosRecorte = {};
  for (const [chave, param] of CHAVES_FILTRO) {
    const valor = params.get(param);
    if (valor) (filtros as Record<string, string>)[chave] = valor;
  }
  return { drill: params.get("drill"), os: params.get("os"), filtros };
}

export function escreverUrlDrill(search: string, estado: EstadoUrlDrill): string {
  const params = new URLSearchParams(search);
  for (const chave of ["drill", "os", ...CHAVES_FILTRO.map(([, p]) => p)]) params.delete(chave);
  if (estado.drill) {
    params.set("drill", estado.drill);
    for (const [chave, param] of CHAVES_FILTRO) {
      const valor = estado.filtros[chave];
      if (valor) params.set(param, valor);
    }
  }
  if (estado.os) params.set("os", estado.os);
  const texto = params.toString();
  return texto ? `?${texto}` : "";
}

const PERIODOS: Array<{ id: string; rotulo: string; ok: (dias: number) => boolean }> = [
  { id: "hoje", rotulo: "Hoje", ok: (d) => d === 0 },
  { id: "7d", rotulo: "Até 7 dias", ok: (d) => d <= 7 },
  { id: "30d", rotulo: "Até 30 dias", ok: (d) => d <= 30 },
  { id: "mais30", rotulo: "Mais de 30 dias", ok: (d) => d > 30 },
];

function passaMovimento(linha: LinhaRecorte, movimento?: string) {
  if (!movimento) return true;
  if (!linha.movimento) return true;
  return linha.movimento === movimento || linha.movimento === "Ambas";
}

export function aplicarFiltros(linhas: LinhaRecorte[], filtros: FiltrosRecorte): LinhaRecorte[] {
  const periodo = PERIODOS.find((p) => p.id === filtros.periodo);
  const saida = linhas.filter(
    (l) =>
      (!filtros.etapa || l.etapa === filtros.etapa) &&
      (!filtros.oficina || l.oficina === filtros.oficina) &&
      (!filtros.tipo || l.tipo === filtros.tipo) &&
      (!filtros.situacao || l.situacaoOs === filtros.situacao) &&
      (!periodo || (l.idadeDias != null && periodo.ok(l.idadeDias))) &&
      passaMovimento(l, filtros.movimento),
  );
  const fator = filtros.ordem === "recente" ? -1 : 1;
  return [...saida].sort((a, b) => fator * (a.aberturaIso ?? "").localeCompare(b.aberturaIso ?? ""));
}

function contar(linhas: LinhaRecorte[], campo: (l: LinhaRecorte) => string) {
  const mapa = new Map<string, number>();
  for (const l of linhas) mapa.set(campo(l), (mapa.get(campo(l)) ?? 0) + 1);
  return [...mapa.entries()].sort((a, b) => b[1] - a[1]);
}

// ------------------------------------------------------------------ dados

type RespostaRecorte = RecorteResolvido & { ok: true; total: number };
type EstadoCarga =
  | { status: "carregando" }
  | { status: "erro"; mensagem: string }
  | { status: "ok"; dados: RespostaRecorte };

function useRecorte(id: string, demo: boolean, versao: string | undefined, ativo = true) {
  const [estado, setEstado] = useState<EstadoCarga>({ status: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  const anteriorRef = useRef<RespostaRecorte | null>(null);
  useEffect(() => {
    if (!ativo) return;
    const controle = new AbortController();
    // Snapshot novo com o sheet aberto: mantém a lista atual na tela enquanto recarrega.
    if (!anteriorRef.current || anteriorRef.current.id !== id) setEstado({ status: "carregando" });
    const url = `/api/sala/recorte?id=${encodeURIComponent(id)}${demo ? "&demo=drill" : ""}`;
    fetch(url, { cache: "no-store", signal: controle.signal })
      .then(async (resposta) => {
        const json = (await resposta.json().catch(() => null)) as (RespostaRecorte & { error?: string }) | null;
        if (!resposta.ok || !json?.ok) throw new Error(json?.error ?? `HTTP ${resposta.status}`);
        anteriorRef.current = json;
        setEstado({ status: "ok", dados: json });
      })
      .catch((erro: unknown) => {
        if (controle.signal.aborted) return;
        setEstado({ status: "erro", mensagem: erro instanceof Error ? erro.message : "falha" });
      });
    return () => controle.abort();
  }, [id, demo, versao, tentativa, ativo]);
  const tentarDeNovo = useCallback(() => setTentativa((n) => n + 1), []);
  return { estado, tentarDeNovo };
}

// ------------------------------------------------------------------ UI

function Chip({
  ativo,
  onClick,
  children,
  desabilitado,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
  desabilitado?: boolean;
}) {
  return (
    <button
      type="button"
      className={ativo ? "sala-recorte-chip ativo" : "sala-recorte-chip"}
      aria-pressed={ativo}
      disabled={desabilitado}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function GrupoChips({
  rotulo,
  opcoes,
  valor,
  total,
  onChange,
}: {
  rotulo: string;
  opcoes: Array<[string, number]>;
  valor?: string;
  total: number;
  onChange: (valor?: string) => void;
}) {
  if (opcoes.length < 2 && !valor) return null;
  return (
    <div className="sala-recorte-grupo" role="group" aria-label={rotulo}>
      <span className="sala-recorte-grupo-rotulo">{rotulo}</span>
      <Chip ativo={!valor} onClick={() => onChange(undefined)}>
        Todas ({total})
      </Chip>
      {opcoes.map(([opcao, qtd]) => (
        <Chip key={opcao} ativo={valor === opcao} onClick={() => onChange(valor === opcao ? undefined : opcao)}>
          {opcao} ({qtd})
        </Chip>
      ))}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="sala-recorte-skeleton" aria-busy="true" aria-label="Carregando">
      <i />
      <i />
      <i />
    </div>
  );
}

function LinhaRecorteTv({ linha, onSelecionar, fluxo }: { linha: LinhaRecorte; onSelecionar: (os: string, el: HTMLElement) => void; fluxo?: boolean }) {
  return (
    <button
      type="button"
      className="sala-recorte-linha"
      onClick={(evento) => onSelecionar(linha.os, evento.currentTarget)}
      aria-label={`Abrir OS ${linha.os}, ${linha.equipamento}`}
    >
      <span className="sala-numero sala-recorte-os">{fluxo && linha.hora ? `${linha.hora} · ` : ""}{linha.os}</span>
      <span className="sala-recorte-corpo">
        <strong>{linha.equipamento}</strong>
        <small>
          {linha.tag} · {linha.setor} · {linha.etapa}
          {linha.movimento ? ` · ${linha.movimento}` : ""}
        </small>
      </span>
      <span className="sala-recorte-idade">
        <span className="sala-numero">{linha.idade}</span>
        <small>{linha.semMovimento !== "—" ? linha.semMovimento : linha.situacaoOs}</small>
      </span>
    </button>
  );
}

export function SalaRecorteOverlay({
  drill,
  demo,
  versao,
  filtros,
  mobile,
  impedimentos,
  onFiltros,
  onLimpar,
  onSelecionarOs,
  onResolvido,
}: {
  drill: SalaDrillSelecao;
  demo: boolean;
  /** `atualizadoEm` do snapshot: recarrega a lista mantendo filtro e rolagem. */
  versao?: string;
  filtros: FiltrosRecorte;
  mobile: boolean;
  impedimentos: SalaSnapshot["programadas"]["impedimentos"];
  onFiltros: (filtros: FiltrosRecorte) => void;
  onLimpar: () => void;
  onSelecionarOs: (os: string, el: HTMLElement) => void;
  onResolvido: (info: { titulo: string; total: number; detalhes: Record<string, OsDetalheSnapshot>; oss: string[] }) => void;
}) {
  const impedimentosDrill = drill.id === "programadas.impedimentos";
  const { estado, tentarDeNovo } = useRecorte(drill.id, demo, versao, !impedimentosDrill);
  const listaRef = useRef<HTMLDivElement | null>(null);
  const rolagemRef = useRef(0);
  const dados = estado.status === "ok" ? estado.dados : null;

  useEffect(() => {
    if (!dados || impedimentosDrill) return;
    onResolvido({ titulo: dados.titulo, total: dados.total, detalhes: dados.detalhes, oss: dados.linhas.map((l) => l.os) });
  }, [dados, impedimentosDrill, onResolvido]);

  // Mantém a rolagem ao recarregar (snapshot novo) — C7.
  useLayoutEffect(() => {
    if (listaRef.current) listaRef.current.scrollTop = rolagemRef.current;
  }, [dados]);

  const linhas = useMemo(() => dados?.linhas ?? [], [dados]);
  const visiveis = useMemo(() => aplicarFiltros(linhas, filtros), [linhas, filtros]);
  const set = (parcial: Partial<FiltrosRecorte>) => onFiltros({ ...filtros, ...parcial });
  const temFiltro = CHAVES_FILTRO.some(([chave]) => chave !== "ordem" && filtros[chave]);
  const total = impedimentosDrill ? impedimentos.length : (dados?.total ?? drill.contagem ?? 0);
  const titulo = impedimentosDrill ? "IMPEDIMENTOS" : (dados?.titulo ?? drill.titulo);

  return (
    <div
      className={mobile ? "sala-drill-overlay sala-recorte-mobile" : "sala-drill-overlay"}
      role="dialog"
      aria-modal="true"
      aria-label={`Lista: ${titulo}`}
    >
      <button type="button" className="sala-drill-backdrop" onClick={onLimpar} aria-label="Fechar lista" tabIndex={-1} />
      <div className="sala-drill-sheet sala-recorte-sheet">
        <div className="sala-drill-sheet-cabecalho">
          <div className="sala-drill-sheet-titulo">
            <span className="sala-drill-sheet-chip">selecionado</span>
            <div className="sala-drill-sheet-heading">
              <div>
                <div className="sala-rotulo-bloco">{titulo}</div>
                <div className="sala-numero sala-drill-sheet-qtd">
                  {total} {impedimentosDrill ? "" : "OS"}
                </div>
              </div>
            </div>
          </div>
          <div className="sala-os-detalhe-acoes">
            {temFiltro ? (
              <button type="button" className="sala-drill-limpar" onClick={() => onFiltros({ ordem: filtros.ordem })}>
                Limpar filtros
              </button>
            ) : null}
            <button type="button" className="sala-drill-limpar sala-drill-fechar" onClick={onLimpar} data-autofoco="1">
              Fechar · Esc
            </button>
          </div>
        </div>

        {impedimentosDrill ? (
          <div className="sala-drill-sheet-lista">
            {impedimentos.length === 0 ? <p className="sala-vazio">Nenhum impedimento ativo.</p> : null}
            {impedimentos.map((item) => (
              <div key={`${item.tag}-${item.motivo}`} className="sala-recorte-linha estatica">
                <span className="sala-numero sala-recorte-os">{item.tag}</span>
                <span className="sala-recorte-corpo">
                  <strong>{item.equipamento}</strong>
                  <small>{item.motivo}</small>
                </span>
                <span className="sala-recorte-idade">
                  <small>nova data</small>
                  <span className="sala-numero">{item.novaData}</span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <>
            {dados && linhas.length > 0 ? (
              <div className="sala-recorte-filtros">
                <GrupoChips rotulo="Etapa" opcoes={contar(linhas, (l) => l.etapa)} valor={filtros.etapa} total={linhas.length} onChange={(v) => set({ etapa: v })} />
                <GrupoChips rotulo="Oficina" opcoes={contar(linhas, (l) => l.oficina)} valor={filtros.oficina} total={linhas.length} onChange={(v) => set({ oficina: v })} />
                <GrupoChips rotulo="Tipo" opcoes={contar(linhas, (l) => l.tipo)} valor={filtros.tipo} total={linhas.length} onChange={(v) => set({ tipo: v })} />
                <GrupoChips rotulo="Situação" opcoes={contar(linhas, (l) => l.situacaoOs)} valor={filtros.situacao} total={linhas.length} onChange={(v) => set({ situacao: v })} />
                {linhas.some((l) => l.movimento) ? (
                  <div className="sala-recorte-grupo" role="group" aria-label="Movimento">
                    <span className="sala-recorte-grupo-rotulo">Movimento</span>
                    {[undefined, "Aberta", "Fechada"].map((mov) => (
                      <Chip key={mov ?? "todas"} ativo={filtros.movimento === mov} onClick={() => set({ movimento: mov })}>
                        {mov ? `${mov}s` : "Todas"}
                      </Chip>
                    ))}
                  </div>
                ) : null}
                <div className="sala-recorte-grupo" role="group" aria-label="Período">
                  <span className="sala-recorte-grupo-rotulo">Período</span>
                  <Chip ativo={!filtros.periodo} onClick={() => set({ periodo: undefined })}>
                    Todos
                  </Chip>
                  {PERIODOS.map((p) => {
                    const qtd = linhas.filter((l) => l.idadeDias != null && p.ok(l.idadeDias)).length;
                    return (
                      <Chip key={p.id} ativo={filtros.periodo === p.id} desabilitado={qtd === 0 && filtros.periodo !== p.id} onClick={() => set({ periodo: filtros.periodo === p.id ? undefined : p.id })}>
                        {p.rotulo} ({qtd})
                      </Chip>
                    );
                  })}
                  <span className="sala-recorte-grupo-rotulo">Ordem</span>
                  <Chip ativo={filtros.ordem !== "recente"} onClick={() => set({ ordem: undefined })}>
                    Mais antiga
                  </Chip>
                  <Chip ativo={filtros.ordem === "recente"} onClick={() => set({ ordem: "recente" })}>
                    Mais recente
                  </Chip>
                </div>
                <p className="sala-recorte-exibindo" aria-live="polite">
                  Exibindo {visiveis.length} de {linhas.length}
                </p>
              </div>
            ) : null}
            <div
              className="sala-drill-sheet-lista"
              ref={listaRef}
              onScroll={(evento) => {
                rolagemRef.current = evento.currentTarget.scrollTop;
              }}
            >
              {estado.status === "carregando" ? <Skeleton /> : null}
              {estado.status === "erro" ? (
                <div className="sala-recorte-erro" role="alert">
                  <p>Não foi possível carregar a lista ({estado.mensagem}).</p>
                  <button type="button" className="sala-drill-limpar" onClick={tentarDeNovo}>
                    Tentar de novo
                  </button>
                </div>
              ) : null}
              {dados && linhas.length === 0 ? <p className="sala-vazio">{dados.vazio}</p> : null}
              {dados && linhas.length > 0 && visiveis.length === 0 ? (
                <p className="sala-vazio">Nenhuma OS com estes filtros.</p>
              ) : null}
              {visiveis.map((linha) => (
                <LinhaRecorteTv key={linha.os} linha={linha} fluxo={drill.id.startsWith("fluxo.")} onSelecionar={onSelecionarOs} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ detalhe (C6/C11)

type EstadoDetalhe =
  | { status: "carregando" }
  | { status: "api"; detalhe: OsDetalheSnapshot }
  | { status: "falha"; mensagem: string };

export function SalaOsDetalheRemoto({
  numero,
  cache,
  demo,
  mobile,
  foraDoRecorte,
  onVoltar,
  onFechar,
}: {
  numero: string;
  cache: OsDetalheSnapshot | null;
  demo: boolean;
  mobile: boolean;
  foraDoRecorte?: boolean;
  onVoltar: () => void;
  onFechar: () => void;
}) {
  const [estado, setEstado] = useState<EstadoDetalhe>({ status: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    const controle = new AbortController();
    const timer = window.setTimeout(() => controle.abort(), DETALHE_TIMEOUT_MS);
    fetch(`/api/sala/os-detalhe?numero=${encodeURIComponent(numero)}${demo ? "&demo=drill" : ""}`, {
      cache: "no-store",
      signal: controle.signal,
    })
      .then(async (resposta) => {
        const json = (await resposta.json().catch(() => null)) as { ok?: boolean; detalhe?: OsDetalheSnapshot; error?: string } | null;
        if (!resposta.ok || !json?.ok || !json.detalhe) throw new Error(json?.error ?? `HTTP ${resposta.status}`);
        setEstado({ status: "api", detalhe: json.detalhe });
      })
      .catch((erro: unknown) => {
        const mensagem = controle.signal.aborted ? "tempo esgotado" : erro instanceof Error ? erro.message : "falha";
        setEstado({ status: "falha", mensagem });
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      window.clearTimeout(timer);
      controle.abort();
    };
  }, [numero, demo, tentativa]);

  const avisoRecorte = foraDoRecorte ? ["Esta OS saiu do recorte."] : [];
  if (estado.status === "api") {
    return <SalaOsDetalhePainel detalhe={estado.detalhe} onVoltar={onVoltar} onFechar={onFechar} aviso={avisoRecorte} mobile={mobile} />;
  }
  if (estado.status === "falha" && cache) {
    return (
      <SalaOsDetalhePainel
        detalhe={cache}
        onVoltar={onVoltar}
        onFechar={onFechar}
        aviso={["dados do cache", ...avisoRecorte]}
        mobile={mobile}
      />
    );
  }
  return (
    <div className={mobile ? "sala-os-detalhe-overlay sala-recorte-mobile" : "sala-os-detalhe-overlay"} role="dialog" aria-modal="true" aria-label={`OS ${numero}`}>
      <button type="button" className="sala-drill-backdrop" onClick={onFechar} aria-label="Fechar" tabIndex={-1} />
      <div className="sala-os-detalhe-sheet sala-os-detalhe-sheet-curto">
        <div className="sala-drill-sheet-cabecalho">
          <div>
            <span className="sala-drill-sheet-chip">detalhe da OS</span>
            <div className="sala-numero sala-os-detalhe-numero">{numero}</div>
          </div>
          <div className="sala-os-detalhe-acoes">
            <button type="button" className="sala-drill-limpar" onClick={onVoltar} data-autofoco="1">
              Voltar
            </button>
            <button type="button" className="sala-drill-limpar sala-drill-fechar" onClick={onFechar}>
              Fechar · Esc
            </button>
          </div>
        </div>
        <div className="sala-os-detalhe-corpo">
          {estado.status === "carregando" ? <Skeleton /> : null}
          {estado.status === "falha" ? (
            <div className="sala-recorte-erro" role="alert">
              <p>Não foi possível carregar a OS {numero}.</p>
              <button type="button" className="sala-drill-limpar" onClick={() => {
                  setEstado({ status: "carregando" });
                  setTentativa((n) => n + 1);
                }}>
                Tentar de novo
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

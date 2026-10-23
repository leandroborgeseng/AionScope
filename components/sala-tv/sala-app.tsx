"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { JetBrains_Mono } from "next/font/google";
import {
  AlertOctagon,
  ClockAlert,
  Hand,
  PauseCircle,
  ShoppingCart,
  CalendarRange,
  Timer,
  Volume2,
  VolumeX,
  Hourglass,
  Replace,
} from "lucide-react";
import {
  TELAS_SALA,
  type LinhaDrill,
  type LinhaDrillEquip,
  type LinhaDrillOs,
  type OsDetalheSnapshot,
  type SalaDrillSelecao,
  type SalaSnapshot,
  type TelaSala,
} from "@/lib/ec/snapshot-tipos";
import { idsOsAbertas, novasOsDesde } from "@/lib/ec/novas-os";
import { parseMoeda } from "@/lib/ec/texto";
import { desbloquearSomTv, SALA_SOM_STORAGE, tocarChimeNovaOs } from "@/components/sala-tv/som-nova-os";
import { TvTreinamentos } from "@/components/treinamentos/tv-treinamentos";
import { TelaEvolucao } from "@/components/sala-tv/tela-evolucao";
import type { PainelTreinamentos } from "@/lib/treinamentos/types";
import { SalaOsDetalhePainel } from "@/components/sala-tv/sala-os-detalhe";
import {
  DRILL_IDLE_MS,
  escreverUrlDrill,
  isRecorteDrill,
  lerUrlDrill,
  SalaOsDetalheRemoto,
  SalaRecorteOverlay,
  type FiltrosRecorte,
} from "@/components/sala-tv/sala-recorte";
import "@/app/sala/sala.css";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-jetbrains",
});

const SELO: Record<string, { color: string; background: string; border: string }> = {
  GRAVE: { color: "#A3123A", background: "#FDF1F4", border: "#E7A3B6" },
  ATRASADA: { color: "#A8460A", background: "#FFF6EE", border: "#F0BD8E" },
  "VENCE LOGO": { color: "#8A5A00", background: "#FFF6D6", border: "#EBCB6A" },
  "NO PRAZO": { color: "#4E6079", background: "#EEF2F7", border: "#DCE4EE" },
  "SEM META": { color: "#4E6079", background: "#EEF2F7", border: "#DCE4EE" },
  ATENDIDA: { color: "#3E7A1E", background: "#F3F8EC", border: "#C9DDAE" },
  Atendida: { color: "#3E7A1E", background: "#F3F8EC", border: "#C9DDAE" },
};

const COR_ETAPA: Record<string, string> = {
  "Sem 1º atendimento": "#A3123A",
  "Em atendimento": "#2C66AB",
  "Aguarda peça/compra": "#D9620F",
  "Reparo externo": "#7A8CA6",
  "Contrato/assistência": "#5C6B82",
  "Teste e devolução": "#3E7A1E",
};

const DRILL_AGORA = {
  grave: { id: "agora.grave", titulo: "ATRASO GRAVE" },
  fora: { id: "agora.fora-do-prazo", titulo: "FORA DO PRAZO" },
  semPrimeiro: { id: "agora.sem-primeiro", titulo: "SEM 1º ATENDIMENTO" },
  parados: { id: "agora.parados", titulo: "EQUIP. PARADOS" },
} as const;

type DrillIcone = typeof AlertOctagon;

const DRILL_ICONE: Record<string, DrillIcone> = {
  "agora.grave": AlertOctagon,
  "agora.fora-do-prazo": ClockAlert,
  "agora.sem-primeiro": Hand,
  "agora.parados": PauseCircle,
};

function selo(situacao: string) {
  return SELO[situacao] ?? SELO["NO PRAZO"];
}

function isLinhaOs(linha: LinhaDrill): linha is LinhaDrillOs {
  return "situacao" in linha || "idade" in linha || "criticidade" in linha;
}

function isLinhaEquip(linha: LinhaDrill): linha is LinhaDrillEquip {
  return !isLinhaOs(linha) && "tag" in linha;
}

function Cabecalho({
  tela,
  relogio,
  drill,
  drillContagem,
  onLimparDrill,
  ocultarMenu = false,
}: {
  tela: TelaSala;
  relogio: string;
  drill: SalaDrillSelecao | null;
  drillContagem?: number;
  onLimparDrill?: () => void;
  /** Telas fixas em URL dedicada usam o miolo em tela cheia (sem pills). */
  ocultarMenu?: boolean;
}) {
  const atual = TELAS_SALA.find((item) => item.id === tela) ?? TELAS_SALA[0];
  return (
    <header className={ocultarMenu ? "sala-cabecalho sala-cabecalho-limpo" : "sala-cabecalho"}>
      <img src="/aion-logo.png" alt="Aion Engenharia" />
      <div className="sala-divisor" />
      <div className="sala-cabecalho-marca">
        <div className="sala-rotulo">{atual.rotulo}</div>
        <div className="sala-titulo">{atual.titulo}</div>
      </div>
      {drill ? (
        <div className="sala-drill-chip" role="status">
          <span className="sala-drill-chip-texto">
            {drill.titulo}
            {drillContagem != null ? ` · ${drillContagem}${isRecorteDrill(drill.id) ? " OS" : ""}` : ""}
          </span>
          <button type="button" className="sala-drill-limpar" onClick={onLimparDrill}>
            Limpar
          </button>
        </div>
      ) : null}
      {ocultarMenu ? null : (
        <nav className="sala-pills" aria-label="Telas">
          {TELAS_SALA.map((item) => (
            <a key={item.id} className={item.id === tela ? "sala-pill ativa" : "sala-pill"} href={`/sala/${item.id}`}>
              {item.label}
            </a>
          ))}
        </nav>
      )}
      <div className="sala-relogio">{relogio}</div>
    </header>
  );
}

function Selo({ situacao }: { situacao: string }) {
  const cor = selo(situacao);
  return (
    <span className="sala-selo" style={{ color: cor.color, background: cor.background, border: `1px solid ${cor.border}` }}>
      {situacao}
    </span>
  );
}

function MetaTags({
  parado,
  compra,
  criticidade,
}: {
  parado?: boolean;
  compra?: boolean;
  criticidade?: string;
}) {
  return (
    <div className="sala-meta">
      {parado ? (
        <span className="sala-meta-badge parado" title="Equipamento parado">
          <PauseCircle size={18} strokeWidth={2.4} aria-hidden />
          <span>PARADO</span>
        </span>
      ) : null}
      {compra ? (
        <span className="sala-meta-badge compra" title="Aguarda compra">
          <ShoppingCart size={18} strokeWidth={2.4} aria-hidden />
          <span>COMPRA</span>
        </span>
      ) : null}
      {criticidade ? <span className="sala-meta-crit">{criticidade}</span> : null}
    </div>
  );
}

function LinhaOsTv({
  os,
  situacao,
  equipamento,
  tag,
  setor,
  parado,
  compra,
  criticidade,
  idade,
  destaque,
  nova,
  denso,
  onSelecionar,
}: {
  os: string;
  situacao?: string;
  equipamento: string;
  tag: string;
  setor: string;
  parado?: boolean;
  compra?: boolean;
  criticidade?: string;
  idade?: string;
  destaque?: boolean;
  nova?: boolean;
  denso?: boolean;
  onSelecionar?: (os: string) => void;
}) {
  const clicavel = Boolean(onSelecionar);
  const classe = [
    denso ? "sala-linha sala-linha-densa" : "sala-linha",
    clicavel ? "sala-linha-clicavel" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      className={classe}
      data-destaque={destaque ? "1" : undefined}
      data-nova={nova ? "1" : undefined}
      role={clicavel ? "button" : undefined}
      tabIndex={clicavel ? 0 : undefined}
      onClick={clicavel ? () => onSelecionar?.(os) : undefined}
      onKeyDown={
        clicavel
          ? (evento) => {
              if (evento.key === "Enter" || evento.key === " ") {
                evento.preventDefault();
                onSelecionar?.(os);
              }
            }
          : undefined
      }
    >
      <div className="sala-linha-status">
        {situacao ? <Selo situacao={situacao} /> : <span className="sala-selo sala-selo-vazio">—</span>}
        <small className="sala-numero sala-linha-os">{os}</small>
      </div>
      <div className="sala-linha-corpo">
        <div className="sala-linha-equip">
          <strong>{equipamento}</strong>
        </div>
        <div className="sala-linha-sub">
          <small>
            {tag} · {setor}
          </small>
          <MetaTags parado={parado} compra={compra} criticidade={criticidade} />
        </div>
      </div>
      <span className="sala-numero sala-linha-idade">{idade ?? "—"}</span>
    </div>
  );
}

function LinhaEquipTv({
  equipamento,
  tag,
  setor,
  os,
  tempo,
  onSelecionar,
}: {
  equipamento: string;
  tag: string;
  setor: string;
  os?: string;
  tempo?: string;
  onSelecionar?: (os: string) => void;
}) {
  const clicavel = Boolean(os && onSelecionar);
  return (
    <div
      className={clicavel ? "sala-linha sala-linha-equip-only sala-linha-clicavel" : "sala-linha sala-linha-equip-only"}
      role={clicavel ? "button" : undefined}
      tabIndex={clicavel ? 0 : undefined}
      onClick={clicavel ? () => onSelecionar?.(os!) : undefined}
      onKeyDown={
        clicavel
          ? (evento) => {
              if (evento.key === "Enter" || evento.key === " ") {
                evento.preventDefault();
                onSelecionar?.(os!);
              }
            }
          : undefined
      }
    >
      <div className="sala-linha-status">
        <span className="sala-meta-badge parado">
          <PauseCircle size={18} strokeWidth={2.4} aria-hidden />
          <span>PARADO</span>
        </span>
        {os ? <small className="sala-numero sala-linha-os">{os}</small> : null}
      </div>
      <div className="sala-linha-corpo">
        <div className="sala-linha-equip">
          <strong>{equipamento}</strong>
        </div>
        <div className="sala-linha-sub">
          <small>
            {tag} · {setor}
          </small>
        </div>
      </div>
      <span className="sala-numero sala-linha-idade">{tempo ?? "—"}</span>
    </div>
  );
}

type CicloAnoBucket = SalaSnapshot["ciclo"]["previsaoEol"][number];
type CicloAnoItem = CicloAnoBucket["itens"][number];

function isCicloAnoDrill(id: string): boolean {
  return /^ciclo\.(eol|eos)\.\d{4}$/.test(id);
}

function cicloDrillModo(id: string): "eol" | "eos" | null {
  const match = /^ciclo\.(eol|eos)\.\d{4}$/.exec(id);
  return match ? (match[1] as "eol" | "eos") : null;
}

function bucketCicloAno(dados: SalaSnapshot, drillId: string): CicloAnoBucket | null {
  const match = /^ciclo\.(eol|eos)\.(\d{4})$/.exec(drillId);
  if (!match) return null;
  const modo = match[1] as "eol" | "eos";
  const ano = match[2];
  const lista = modo === "eos" ? dados.ciclo.previsaoEos : dados.ciclo.previsaoEol;
  return lista.find((item) => item.ano === ano) ?? null;
}

function itensCicloAno(dados: SalaSnapshot, drillId: string): CicloAnoItem[] {
  return bucketCicloAno(dados, drillId)?.itens ?? [];
}

function totalValorItensCiclo(itens: CicloAnoItem[], investimento?: number) {
  if (typeof investimento === "number" && Number.isFinite(investimento) && investimento > 0) {
    return investimento;
  }
  return itens.reduce((soma, item) => soma + (parseMoeda(item.valorSubstituicao) ?? 0), 0);
}

function SalaCicloAnoOverlay({
  drill,
  itens,
  investimento,
  onLimpar,
}: {
  drill: SalaDrillSelecao;
  itens: CicloAnoItem[];
  investimento?: number;
  onLimpar: () => void;
}) {
  const modo = cicloDrillModo(drill.id) ?? "eol";
  const rotuloData = modo === "eos" ? "EOS" : "EOL";
  const quantidade = itens.length;
  const totalValor = totalValorItensCiclo(itens, investimento);
  const totalValorFmt = formatoMoedaCurto(totalValor);
  const vazio =
    modo === "eos"
      ? "Nenhum equipamento com fim de serviço neste ano."
      : "Nenhum equipamento com fim de vida neste ano.";
  return (
    <div className="sala-drill-overlay" role="dialog" aria-modal="true" aria-label={`Detalhe: ${drill.titulo}`}>
      <button type="button" className="sala-drill-backdrop" onClick={onLimpar} aria-label="Fechar detalhe" />
      <div className="sala-drill-sheet sala-ciclo-ano-sheet">
        <div className="sala-drill-sheet-cabecalho">
          <div className="sala-drill-sheet-titulo">
            <span className={`sala-drill-sheet-chip sala-ciclo-chip-${modo}`}>{drill.titulo}</span>
            <div className="sala-drill-sheet-heading">
              <span className={`sala-drill-sheet-icone sala-ciclo-icone-${modo}`} aria-hidden>
                <CalendarRange size={32} strokeWidth={2.2} />
              </span>
              <div>
                <div className="sala-rotulo-bloco">
                  {modo === "eos" ? "FIM DE SERVIÇO" : "FIM DE VIDA"}
                </div>
                <div className="sala-ciclo-ano-resumo" aria-label={`${quantidade} equipamentos, ${totalValorFmt}`}>
                  <div className="sala-ciclo-ano-resumo-item">
                    <span className="sala-ciclo-ano-resumo-rotulo">QUANTIDADE</span>
                    <span className="sala-numero sala-drill-sheet-qtd">{quantidade}</span>
                  </div>
                  <div className="sala-ciclo-ano-resumo-sep" aria-hidden />
                  <div className="sala-ciclo-ano-resumo-item">
                    <span className="sala-ciclo-ano-resumo-rotulo">VALOR DE SUBSTITUIÇÃO</span>
                    <span className={`sala-numero sala-ciclo-ano-resumo-valor sala-ciclo-ano-resumo-valor-${modo}`}>
                      {totalValorFmt}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <button type="button" className="sala-drill-limpar sala-drill-fechar" onClick={onLimpar}>
            Fechar · Esc
          </button>
        </div>
        <div className="sala-ciclo-ano-cabeca" aria-hidden>
          <span>Equipamento</span>
          <span>{rotuloData}</span>
          <span>Valor</span>
        </div>
        <div className="sala-drill-sheet-lista sala-ciclo-ano-lista">
          {itens.length === 0 ? <p className="sala-vazio">{vazio}</p> : null}
          {itens.map((item) => (
            <div key={item.tag} className="sala-ciclo-ano-linha">
              <div className="sala-ciclo-ano-linha-txt">
                <strong>{item.equipamento}</strong>
                <small>
                  {item.tag} · {item.setor}
                </small>
              </div>
              <span className="sala-numero sala-ciclo-ano-data">{item.data}</span>
              <span className="sala-numero sala-ciclo-ano-valor">{item.valorSubstituicao}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SalaDrillOverlay({
  drill,
  linhas,
  onLimpar,
  onSelecionarOs,
}: {
  drill: SalaDrillSelecao;
  linhas: LinhaDrill[];
  onLimpar: () => void;
  onSelecionarOs?: (os: string) => void;
}) {
  const parados = drill.id === "agora.parados";
  const Icone = DRILL_ICONE[drill.id] ?? AlertOctagon;
  return (
    <div className="sala-drill-overlay" role="dialog" aria-modal="true" aria-label={`Detalhe: ${drill.titulo}`}>
      <button type="button" className="sala-drill-backdrop" onClick={onLimpar} aria-label="Fechar detalhe" />
      <div className="sala-drill-sheet">
        <div className="sala-drill-sheet-cabecalho">
          <div className="sala-drill-sheet-titulo">
            <span className="sala-drill-sheet-chip">selecionado</span>
            <div className="sala-drill-sheet-heading">
              <span className="sala-drill-sheet-icone" aria-hidden>
                <Icone size={32} strokeWidth={2.2} />
              </span>
              <div>
                <div className="sala-rotulo-bloco">{drill.titulo}</div>
                <div className="sala-numero sala-drill-sheet-qtd">{linhas.length}</div>
              </div>
            </div>
          </div>
          <button type="button" className="sala-drill-limpar sala-drill-fechar" onClick={onLimpar}>
            Fechar · Esc
          </button>
        </div>
        <div className="sala-drill-sheet-lista">
          {linhas.length === 0 ? <p className="sala-vazio">Nenhum item neste recorte.</p> : null}
          {linhas.map((linha, index) => {
            if (parados && isLinhaEquip(linha)) {
              return (
                <LinhaEquipTv
                  key={`${linha.tag}-${linha.os ?? index}`}
                  equipamento={linha.equipamento}
                  tag={linha.tag}
                  setor={linha.setor}
                  os={linha.os}
                  tempo={linha.tempo}
                  onSelecionar={onSelecionarOs}
                />
              );
            }
            if (isLinhaOs(linha)) {
              return (
                <LinhaOsTv
                  key={`${linha.os}-${index}`}
                  os={linha.os}
                  situacao={linha.situacao}
                  equipamento={linha.equipamento}
                  tag={linha.tag}
                  setor={linha.setor}
                  parado={linha.parado}
                  compra={linha.compra}
                  criticidade={linha.criticidade}
                  idade={linha.idade}
                  denso
                  onSelecionar={onSelecionarOs}
                />
              );
            }
            return null;
          })}
        </div>
      </div>
    </div>
  );
}

function legendaParque(pct: number | null, valor: number | string, parque: number) {
  if (pct == null || !parque) return null;
  const n = typeof valor === "number" ? valor : Number.parseInt(String(valor), 10);
  if (Number.isFinite(n) && pct < 1) {
    return `${n.toLocaleString("pt-BR")} de ${parque.toLocaleString("pt-BR")}`;
  }
  return `${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do parque`;
}

function TelaAgora({
  dados,
  destaque,
  novasOs,
  drill,
  onDrill,
  onSelecionarOs,
}: {
  dados: SalaSnapshot;
  destaque: string | null;
  novasOs: ReadonlySet<string>;
  drill: SalaDrillSelecao | null;
  onDrill: (id: string, titulo: string, contagem?: number) => void;
  onSelecionarOs?: (os: string) => void;
}) {
  const contadores: Array<{
    id: string;
    titulo: string;
    valor: number | string;
    pct: number | null;
    cor: string;
    fundo: string;
    borda: string;
    icone: DrillIcone;
  }> = [
    {
      ...DRILL_AGORA.grave,
      valor: dados.agora.grave,
      pct: dados.agora.gravePct,
      cor: "#A3123A",
      fundo: "#FDF1F4",
      borda: "#E7A3B6",
      icone: AlertOctagon,
    },
    {
      ...DRILL_AGORA.fora,
      valor: dados.agora.foraDoPrazo,
      pct: dados.agora.foraDoPrazoPct,
      cor: "#A8460A",
      fundo: "#FFF6EE",
      borda: "#F0BD8E",
      icone: ClockAlert,
    },
    {
      ...DRILL_AGORA.semPrimeiro,
      valor: dados.agora.semPrimeiro,
      pct: dados.agora.semPrimeiroPct,
      cor: "#8A5A00",
      fundo: "#FFFFFF",
      borda: "#DCE4EE",
      icone: Hand,
    },
    {
      ...DRILL_AGORA.parados,
      valor: dados.agora.parados == null ? "—" : dados.agora.parados,
      pct: dados.agora.paradosPct,
      cor: "#2C66AB",
      fundo: "#FFFFFF",
      borda: "#DCE4EE",
      icone: PauseCircle,
    },
  ];
  const drillAtivo = Boolean(drill);
  return (
    <div className={drillAtivo ? "sala-agora com-drill" : "sala-agora"}>
      <div className="sala-grid-2">
        <div className="sala-coluna sala-agora-lat">
          <div className={dados.plantao ? "sala-aviso sala-plantao" : "sala-cartao sala-plantao sala-plantao-ok"}>
            <Timer size={22} strokeWidth={2.2} aria-hidden className="sala-plantao-icone" />
            <span>{dados.plantaoTexto}</span>
          </div>
          <div className="sala-contadores">
            {contadores.map((item) => {
              const ativo = drill?.id === item.id;
              const Icone = item.icone;
              const legenda = legendaParque(item.pct, item.valor, dados.agora.parque);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={
                    ativo
                      ? "sala-contador sala-contador-drill ativo"
                      : drillAtivo
                        ? "sala-contador sala-contador-drill dim"
                        : "sala-contador sala-contador-drill"
                  }
                  style={{ background: item.fundo, border: `2px solid ${ativo ? item.cor : item.borda}`, color: item.cor }}
                  aria-pressed={ativo}
                  onClick={() => onDrill(item.id, item.titulo)}
                >
                  <span className="sala-contador-topo">
                    <span className="sala-contador-icone" aria-hidden>
                      <Icone size={22} strokeWidth={2.3} />
                    </span>
                    <span className="sala-rotulo-bloco" style={{ color: item.cor }}>
                      {item.titulo}
                    </span>
                  </span>
                  <span className="sala-numero">{item.valor}</span>
                  {legenda ? (
                    <span
                      className="sala-contador-pct"
                      title={dados.agora.parque ? `Do parque médico ativo (${dados.agora.parque})` : undefined}
                    >
                      {legenda}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="sala-cartao sala-bloco-parados" style={{ flex: 1 }}>
            <div className="sala-bloco-cabeca">
              <PauseCircle size={20} strokeWidth={2.2} aria-hidden />
              <div className="sala-rotulo-bloco">PARADOS HÁ MAIS TEMPO</div>
            </div>
            <p className="sala-bloco-sub">{dados.agora.proxyParada}</p>
            {dados.agora.paradosMaisTempo.length === 0 ? (
              <p className="sala-vazio sala-vazio-compacto">
                {dados.agora.parados == null ? "Sem dados de disponibilidade." : "Nenhum equipamento parado agora."}
              </p>
            ) : (
              <div className="sala-parados-lista">
                {dados.agora.paradosMaisTempo.map((item) => (
                  <div key={item.nome} className="sala-parados-linha">
                    <div className="sala-linha-equip">
                      <strong>{item.nome}</strong>
                      <small>{item.setor}</small>
                    </div>
                    <span className="sala-numero sala-linha-idade">{item.tempo}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="sala-cartao sala-coluna sala-fila-painel">
          <div className="sala-bloco-cabeca sala-fila-cabeca">
            <AlertOctagon size={20} strokeWidth={2.2} aria-hidden />
            <div className="sala-rotulo-bloco">FILA DE AÇÃO</div>
            <span className="sala-fila-qtd sala-numero">{dados.agora.fila.length}</span>
          </div>
          <div className="sala-fila">
            {dados.agora.fila.length === 0 ? <p className="sala-vazio">Nenhuma OS sem primeiro atendimento.</p> : null}
            {dados.agora.fila.map((item) => (
              <LinhaOsTv
                key={item.os}
                os={item.os}
                situacao={item.situacao}
                equipamento={item.equipamento}
                tag={item.tag}
                setor={item.setor}
                parado={item.parado}
                compra={item.compra}
                criticidade={item.criticidade}
                idade={item.idade}
                destaque={destaque === item.os}
                nova={novasOs.has(item.os)}
                onSelecionar={onSelecionarOs}
              />
            ))}
            {dados.agora.filaOcultas > 0 ? (
              <button
                type="button"
                className="sala-fila-ocultas"
                onClick={() => onDrill(DRILL_AGORA.semPrimeiro.id, DRILL_AGORA.semPrimeiro.titulo)}
              >
                + {dados.agora.filaOcultas} ocultas · ver fila completa
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

type OnDrill = (id: string, titulo: string, contagem?: number) => void;

function slugTv(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Alvo clicável do drill (D10): <button> com aria-label; contagem 0 = desabilitado (D5). */
function AlvoDrill({
  id,
  titulo,
  contagem,
  drill,
  onDrill,
  rotuloAria,
  className,
  style,
  children,
}: {
  id: string;
  titulo: string;
  contagem: number | null | undefined;
  drill: SalaDrillSelecao | null;
  onDrill: OnDrill;
  rotuloAria: string;
  className?: string;
  style?: CSSProperties;
  children: React.ReactNode;
}) {
  const vazio = contagem === 0 || contagem == null;
  const ativo = drill?.id === id;
  return (
    <button
      type="button"
      className={["sala-alvo", ativo ? "ativo" : "", className ?? ""].filter(Boolean).join(" ")}
      style={style}
      disabled={vazio}
      aria-pressed={ativo}
      aria-label={rotuloAria}
      data-drill={id}
      onClick={() => onDrill(id, titulo, contagem ?? undefined)}
    >
      {children}
    </button>
  );
}

function TelaFluxo({
  dados,
  drill,
  onDrill,
  onSelecionarOs,
}: {
  dados: SalaSnapshot;
  drill: SalaDrillSelecao | null;
  onDrill: OnDrill;
  onSelecionarOs?: (os: string) => void;
}) {
  return (
    <div className="sala-coluna" style={{ flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <AlvoDrill
          id="fluxo.entraram"
          titulo="ENTRARAM HOJE"
          contagem={dados.fluxo.entraramHoje}
          drill={drill}
          onDrill={onDrill}
          rotuloAria={`Ver ${dados.fluxo.entraramHoje} OS que entraram hoje`}
          className="sala-rotulo-bloco"
        >
          ENTRARAM HOJE · {dados.fluxo.entraramHoje}
        </AlvoDrill>
        <AlvoDrill
          id="fluxo.encerradas"
          titulo="ENCERRADAS HOJE"
          contagem={dados.fluxo.encerradasHoje}
          drill={drill}
          onDrill={onDrill}
          rotuloAria={`Ver ${dados.fluxo.encerradasHoje} OS encerradas hoje`}
          className="sala-rotulo-bloco"
        >
          ENCERRADAS HOJE · {dados.fluxo.encerradasHoje}
        </AlvoDrill>
      </div>
      <div className="sala-etapas">
        {dados.fluxo.etapas.map((etapa) => (
          <AlvoDrill
            key={etapa.etapa}
            id={`fluxo.etapa.${slugTv(etapa.etapa)}`}
            titulo={etapa.etapa.toUpperCase()}
            contagem={etapa.quantidade}
            drill={drill}
            onDrill={onDrill}
            rotuloAria={`Ver ${etapa.quantidade} OS na etapa ${etapa.etapa}`}
            className="sala-etapa"
          >
            <span style={{ display: "block", fontSize: 16, fontWeight: 700, color: COR_ETAPA[etapa.etapa] ?? "#2C66AB" }}>{etapa.etapa}</span>
            <span className="sala-numero q" style={{ display: "block" }}>{etapa.quantidade}</span>
            <small style={{ color: "#4E6079" }}>mais antiga {etapa.maisAntiga}</small>
            {etapa.exemplos.map((exemplo) => (
              <span key={exemplo} style={{ display: "block", fontSize: 16, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{exemplo}</span>
            ))}
          </AlvoDrill>
        ))}
      </div>
      <div className="sala-cartao" style={{ flex: 1 }}>
        <div className="sala-rotulo-bloco">ENTRARAM HOJE · PRECISAM DE ATENDIMENTO</div>
        {dados.fluxo.entraram.length === 0 ? <p className="sala-vazio">Nenhuma OS aberta hoje neste recorte.</p> : null}
        {dados.fluxo.entraram.map((item) => (
          <button
            key={item.os}
            type="button"
            className="sala-linha sala-alvo sala-alvo-linha"
            style={{ marginTop: 8 }}
            aria-label={`Abrir OS ${item.os}, ${item.equipamento}`}
            onClick={() => onSelecionarOs?.(item.os)}
          >
            <span className="sala-numero" style={{ fontSize: 24 }}>{item.hora}</span>
            <span style={{ display: "block", textAlign: "left" }}>
              <strong style={{ display: "block" }}>{item.equipamento}</strong>
              <small>{item.os} · {item.setor}</small>
            </span>
            <small>{item.prioridade}</small>
            <Selo situacao={item.situacao} />
          </button>
        ))}
        {dados.fluxo.entraramOcultas > 0 ? (
          <AlvoDrill
            id="fluxo.entraram"
            titulo="ENTRARAM HOJE"
            contagem={dados.fluxo.entraramHoje}
            drill={drill}
            onDrill={onDrill}
            rotuloAria={`Ver todas as ${dados.fluxo.entraramHoje} OS que entraram hoje, incluindo mais ${dados.fluxo.entraramOcultas}`}
            className="sala-vazio"
          >
            + {dados.fluxo.entraramOcultas} · ver todas
          </AlvoDrill>
        ) : null}
      </div>
      <div className="sala-aviso">{dados.fluxo.equipeAviso}</div>
    </div>
  );
}

function TelaEnvelhecimento({
  dados,
  drill,
  onDrill,
}: {
  dados: SalaSnapshot;
  drill: SalaDrillSelecao | null;
  onDrill: OnDrill;
}) {
  const maximo = Math.max(1, ...dados.envelhecimento.faixas.map((faixa) => faixa.total));
  const env = dados.envelhecimento;
  const kpis: Array<{ rotulo: string; valor: number | string; id?: string; contagem?: number | null }> = [
    { rotulo: "IDADE MÉDIA", valor: env.idadeMediaDias == null ? "—" : `${env.idadeMediaDias}d` },
    { rotulo: "AGUARDANDO TERCEIROS", valor: env.aguardandoTerceiros, id: "envelhecimento.kpi.aguardando-terceiros", contagem: env.aguardandoTerceiros },
    {
      rotulo: "SEM MOVIMENTO > 7 DIAS",
      valor: env.semMovimentoMais7 == null ? "—" : env.semMovimentoMais7,
      id: "envelhecimento.kpi.sem-movimento-7",
      contagem: env.semMovimentoMais7,
    },
    { rotulo: "PENDENTES SEM MOTIVO", valor: env.pendenciaSemMotivo, id: "envelhecimento.kpi.pendentes-sem-motivo", contagem: env.pendenciaSemMotivo },
  ];
  return (
    <div className="sala-coluna" style={{ flex: 1 }}>
      <p style={{ margin: 0, fontSize: 16, color: "#4E6079" }}>{env.proxy}</p>
      <div className="sala-kpis">
        {kpis.map((kpi) =>
          kpi.id ? (
            <AlvoDrill
              key={kpi.rotulo}
              id={kpi.id}
              titulo={kpi.rotulo}
              contagem={kpi.contagem}
              drill={drill}
              onDrill={onDrill}
              rotuloAria={`Ver ${kpi.valor} OS: ${kpi.rotulo.toLowerCase()}`}
              className="sala-cartao"
            >
              <span className="sala-rotulo-bloco" style={{ display: "block" }}>{kpi.rotulo}</span>
              <span className="sala-numero" style={{ display: "block", fontSize: 48 }}>{kpi.valor}</span>
            </AlvoDrill>
          ) : (
            <div key={kpi.rotulo} className="sala-cartao">
              <div className="sala-rotulo-bloco">{kpi.rotulo}</div>
              <div className="sala-numero" style={{ fontSize: 48 }}>{kpi.valor}</div>
            </div>
          ),
        )}
      </div>
      <div className="sala-cartao">
        <div className="sala-rotulo-bloco">IDADE DAS OS ABERTAS</div>
        {env.faixas.map((faixa) => {
          const idFaixa = `envelhecimento.faixa.${faixa.id}`;
          const tituloFaixa = `IDADE ${faixa.label.toUpperCase()}`;
          const aria = `Ver ${faixa.total} OS com idade ${faixa.label}`;
          return (
            <div key={faixa.id} style={{ display: "grid", gridTemplateColumns: "180px 1fr 90px", gap: 12, alignItems: "center", marginTop: 10 }}>
              <AlvoDrill id={idFaixa} titulo={tituloFaixa} contagem={faixa.total} drill={drill} onDrill={onDrill} rotuloAria={aria} className="sala-alvo-texto">
                {faixa.label}
              </AlvoDrill>
              <div style={{ display: "flex", height: 30, background: "#E3EAF3", borderRadius: 6, overflow: "hidden" }}>
                {faixa.partes.map((parte) => (
                  <AlvoDrill
                    key={parte.etapa}
                    id={`${idFaixa}.etapa.${slugTv(parte.etapa)}`}
                    titulo={`${tituloFaixa} · ${parte.etapa.toUpperCase()}`}
                    contagem={parte.quantidade}
                    drill={drill}
                    onDrill={onDrill}
                    rotuloAria={`Ver ${parte.quantidade} OS com idade ${faixa.label} na etapa ${parte.etapa}`}
                    className="sala-alvo-segmento"
                    style={{ width: `${(parte.quantidade / maximo) * 100}%`, background: COR_ETAPA[parte.etapa] ?? "#2C66AB" }}
                  >
                    <span className="sala-sr">{parte.etapa}</span>
                  </AlvoDrill>
                ))}
              </div>
              <AlvoDrill id={idFaixa} titulo={tituloFaixa} contagem={faixa.total} drill={drill} onDrill={onDrill} rotuloAria={aria} className="sala-alvo-texto sala-numero" style={{ fontSize: 22, fontWeight: 700 }}>
                {faixa.total}
              </AlvoDrill>
            </div>
          );
        })}
      </div>
      <div className="sala-cartao" style={{ flex: 1 }}>
        <div className="sala-rotulo-bloco">AS MAIS ANTIGAS · PROXY DE MOVIMENTO</div>
        {env.maisAntigas.map((item) => (
          <div key={item.os} className="sala-linha" style={{ marginTop: 8 }}>
            <span className="sala-numero" style={{ fontSize: 22 }}>{item.os}</span>
            <div style={{ minWidth: 0 }}>
              <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.equipamento}
              </strong>
              <small>{item.setor} · {item.etapa}</small>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="sala-numero" style={{ fontSize: 26 }}>{item.idade}</div>
              <small style={{ color: "#4E6079" }}>{item.semMovimento}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TelaAviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="sala-cartao" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="sala-rotulo-bloco">{titulo}</div>
      <p style={{ fontSize: 28, maxWidth: 1100, margin: 0, lineHeight: 1.35 }}>{texto}</p>
    </div>
  );
}

function formatoMoedaCurto(valor: number) {
  if (!Number.isFinite(valor) || valor <= 0) return "—";
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function pctParque(investimento: number, valorParque: number) {
  if (!valorParque || valorParque <= 0 || !investimento) return 0;
  return Math.round((investimento / valorParque) * 1000) / 10;
}

function TelaCiclo({
  dados,
  drill,
  onDrill,
}: {
  dados: SalaSnapshot;
  drill: SalaDrillSelecao | null;
  onDrill: (id: string, titulo: string, contagem?: number) => void;
}) {
  const ciclo = dados.ciclo;
  const previsaoEol = ciclo.previsaoEol;
  const previsaoEos = ciclo.previsaoEos ?? [];
  const maxEol = Math.max(1, ...previsaoEol.map((item) => item.quantidade));
  const maxEos = Math.max(1, ...previsaoEos.map((item) => item.quantidade));
  const maximoIdade = Math.max(1, ...ciclo.histograma.map((faixa) => faixa.emVida + faixa.alem));
  const proximoEol = previsaoEol[0];
  const proximoEos = previsaoEos[0];
  const vencem10 = ciclo.vencem10Anos ?? previsaoEol.reduce((s, i) => s + i.quantidade, 0);
  const vencemEos10 = ciclo.vencemEos10Anos ?? previsaoEos.reduce((s, i) => s + i.quantidade, 0);
  const valorParqueNum = ciclo.valorSubstituicaoParqueNumero ?? 0;
  const valorParqueFmt = ciclo.valorSubstituicaoParque ?? (valorParqueNum > 0 ? formatoMoedaCurto(valorParqueNum) : "—");
  const drillAtivo = Boolean(drill && isCicloAnoDrill(drill.id));
  const modoDrill = drill ? cicloDrillModo(drill.id) : null;

  return (
    <div className={drillAtivo ? "sala-ciclo com-drill" : "sala-ciclo"}>
      <div className="sala-ciclo-acoes no-print">
        <div className="sala-ciclo-parque" aria-label="Valor de substituição do parque">
          <Replace size={18} strokeWidth={2.2} aria-hidden />
          <div>
            <div className="sala-ciclo-parque-rotulo">VALOR DE SUBSTITUIÇÃO DO PARQUE</div>
            <div className="sala-numero sala-ciclo-parque-valor">{valorParqueFmt}</div>
          </div>
        </div>
        <a
          className="sala-ciclo-btn-relatorio"
          href="/sala/ciclo-de-vida/investimentos"
          target="_blank"
          rel="noopener noreferrer"
        >
          Relatório de investimentos
        </a>
      </div>

      <section className="sala-ciclo-hero sala-ciclo-hero-eol" aria-label="Horizonte EOL · 10 anos">
        <div className="sala-ciclo-hero-topo">
          <div className="sala-ciclo-hero-titulo">
            <div className="sala-bloco-cabeca">
              <CalendarRange size={20} strokeWidth={2.2} aria-hidden className="sala-ciclo-icone" />
              <div className="sala-rotulo-bloco">EOL · FIM DE VIDA · 10 ANOS</div>
            </div>
            <p className="sala-ciclo-hero-sub">
              Clique em um ano para listar equipamentos com EndOfLife no período. % = investimento do ano ÷ valor do parque.
            </p>
          </div>
          <div className="sala-ciclo-resumo">
            <div className="sala-ciclo-kpi">
              <span className="sala-ciclo-kpi-rotulo">próximo ano</span>
              <span className="sala-numero sala-ciclo-kpi-valor destaque">
                {proximoEol?.quantidade ?? 0}
              </span>
              <span className="sala-ciclo-kpi-ano">{proximoEol?.ano ?? "—"}</span>
            </div>
            <div className="sala-ciclo-kpi">
              <span className="sala-ciclo-kpi-rotulo">no horizonte</span>
              <span className="sala-numero sala-ciclo-kpi-valor">{vencem10}</span>
              <span className="sala-ciclo-kpi-ano">10 anos</span>
            </div>
            <div className="sala-ciclo-kpi">
              <span className="sala-ciclo-kpi-rotulo">em ciclo</span>
              <span className="sala-numero sala-ciclo-kpi-valor azul">{ciclo.emCiclo}</span>
              <span className="sala-ciclo-kpi-ano">antes do EOL</span>
            </div>
          </div>
        </div>

        <div className="sala-ciclo-barras" role="list" aria-label="Previsão EOL por ano — clique para filtrar">
          {previsaoEol.map((item, index) => {
            const urgencia = index < 3;
            const altura = item.quantidade
              ? Math.max(12, Math.round((item.quantidade / maxEol) * 100))
              : 4;
            const drillId = `ciclo.eol.${item.ano}`;
            const ativo = drill?.id === drillId;
            const dim = drillAtivo && !ativo;
            const invest = item.investimento ?? 0;
            const pct = pctParque(invest, valorParqueNum);
            const tip = `EOL ${item.ano}: ${item.quantidade} equip. · ${formatoMoedaCurto(invest)} (${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do parque)`;
            return (
              <button
                key={`eol-${item.ano}`}
                type="button"
                role="listitem"
                className={`sala-ciclo-barra-col${urgencia ? " urgente" : ""}${item.quantidade ? "" : " vazia"}${ativo ? " ativo" : ""}${dim ? " dim" : ""}`}
                style={
                  {
                    "--atraso": `${index * 40}ms`,
                    "--altura": `${altura}%`,
                  } as CSSProperties
                }
                aria-pressed={ativo}
                aria-label={tip}
                title={tip}
                onClick={() => onDrill(drillId, `EOL ${item.ano}`)}
              >
                <span className="sala-numero sala-ciclo-barra-qtd">
                  {item.quantidade || "·"}
                </span>
                <span className="sala-ciclo-barra-pct">
                  {item.quantidade ? `${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "·"}
                </span>
                <div className="sala-ciclo-barra-trilho">
                  <div className="sala-ciclo-barra-fill" />
                </div>
                <span className="sala-ciclo-barra-ano">{item.ano}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="sala-ciclo-hero sala-ciclo-hero-eos" aria-label="Horizonte EOS · 10 anos">
        <div className="sala-ciclo-hero-topo">
          <div className="sala-ciclo-hero-titulo">
            <div className="sala-bloco-cabeca">
              <Hourglass size={20} strokeWidth={2.2} aria-hidden className="sala-ciclo-icone eos" />
              <div className="sala-rotulo-bloco">EOS · FIM DE SERVIÇO · 10 ANOS</div>
            </div>
            <p className="sala-ciclo-hero-sub">
              Mais crítico para peça e suporte — clique no ano para filtrar por EndOfService. % = investimento do ano ÷ valor do parque.
            </p>
          </div>
          <div className="sala-ciclo-resumo">
            <div className="sala-ciclo-kpi">
              <span className="sala-ciclo-kpi-rotulo">próximo ano</span>
              <span className="sala-numero sala-ciclo-kpi-valor destaque">
                {proximoEos?.quantidade ?? 0}
              </span>
              <span className="sala-ciclo-kpi-ano">{proximoEos?.ano ?? "—"}</span>
            </div>
            <div className="sala-ciclo-kpi">
              <span className="sala-ciclo-kpi-rotulo">no horizonte</span>
              <span className="sala-numero sala-ciclo-kpi-valor">{vencemEos10}</span>
              <span className="sala-ciclo-kpi-ano">10 anos</span>
            </div>
            <div className="sala-ciclo-kpi">
              <span className="sala-ciclo-kpi-rotulo">modo</span>
              <span className="sala-numero sala-ciclo-kpi-valor azul" style={{ fontSize: 28 }}>
                {modoDrill === "eos" ? "filtro" : "EOS"}
              </span>
              <span className="sala-ciclo-kpi-ano">sem peça</span>
            </div>
          </div>
        </div>

        <div className="sala-ciclo-barras" role="list" aria-label="Previsão EOS por ano — clique para filtrar">
          {previsaoEos.map((item, index) => {
            const urgencia = index < 3;
            const altura = item.quantidade
              ? Math.max(12, Math.round((item.quantidade / maxEos) * 100))
              : 4;
            const drillId = `ciclo.eos.${item.ano}`;
            const ativo = drill?.id === drillId;
            const dim = drillAtivo && !ativo;
            const invest = item.investimento ?? 0;
            const pct = pctParque(invest, valorParqueNum);
            const tip = `EOS ${item.ano}: ${item.quantidade} equip. · ${formatoMoedaCurto(invest)} (${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do parque)`;
            return (
              <button
                key={`eos-${item.ano}`}
                type="button"
                role="listitem"
                className={`sala-ciclo-barra-col eos${urgencia ? " urgente" : ""}${item.quantidade ? "" : " vazia"}${ativo ? " ativo" : ""}${dim ? " dim" : ""}`}
                style={
                  {
                    "--atraso": `${index * 40}ms`,
                    "--altura": `${altura}%`,
                  } as CSSProperties
                }
                aria-pressed={ativo}
                aria-label={tip}
                title={tip}
                onClick={() => onDrill(drillId, `EOS ${item.ano}`)}
              >
                <span className="sala-numero sala-ciclo-barra-qtd">
                  {item.quantidade || "·"}
                </span>
                <span className="sala-ciclo-barra-pct">
                  {item.quantidade ? `${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "·"}
                </span>
                <div className="sala-ciclo-barra-trilho">
                  <div className="sala-ciclo-barra-fill" />
                </div>
                <span className="sala-ciclo-barra-ano">{item.ano}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="sala-ciclo-secundario">
        <section className="sala-cartao sala-ciclo-lista" aria-label="Fim de serviço próximo">
          <div className="sala-ciclo-lista-cabeca">
            <div className="sala-bloco-cabeca">
              <Hourglass size={18} strokeWidth={2.2} aria-hidden />
              <div className="sala-rotulo-bloco">FIM DE SERVIÇO PRÓXIMO · {ciclo.quantidadeFimDeVida}</div>
            </div>
            <div className="sala-ciclo-valor-sub">
              <Replace size={16} strokeWidth={2.2} aria-hidden />
              <div>
                <div className="sala-ciclo-valor-rotulo">VALOR SUBSTITUIÇÃO</div>
                <div className="sala-numero sala-ciclo-valor-numero">{ciclo.valorSubstituicaoFimDeVida}</div>
              </div>
            </div>
          </div>
          {ciclo.fimDeVida.length === 0 ? (
            <p className="sala-vazio">Nenhum equipamento com EndOfService no horizonte ou vencido.</p>
          ) : (
            <div className="sala-ciclo-lista-itens">
              {ciclo.fimDeVida.slice(0, 5).map((item) => (
                <div key={item.tag} className="sala-ciclo-linha">
                  <div className="sala-ciclo-linha-txt">
                    <strong>{item.equipamento}</strong>
                    <small>
                      {item.tag} · {item.criterios}
                    </small>
                  </div>
                  <span className="sala-numero sala-ciclo-linha-valor">{item.valorSubstituicao}</span>
                  <span className="sala-numero sala-ciclo-linha-pts">{item.pontos}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="sala-cartao sala-ciclo-idade" aria-label="Idade do parque">
          <div className="sala-rotulo-bloco">IDADE DO PARQUE</div>
          <p className="sala-bloco-sub">Azul em vida · laranja além do EndOfLife</p>
          {ciclo.histograma.map((faixa) => {
            const total = faixa.emVida + faixa.alem;
            return (
              <div key={faixa.faixa} className="sala-ciclo-idade-linha">
                <span>{faixa.faixa}</span>
                <div className="sala-ciclo-idade-trilho">
                  <div style={{ width: `${(faixa.emVida / maximoIdade) * 100}%` }} className="em" />
                  <div style={{ width: `${(faixa.alem / maximoIdade) * 100}%` }} className="alem" />
                </div>
                <b className="sala-numero">{total}</b>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}

function TelaIndicadores({ dados }: { dados: SalaSnapshot }) {
  return (
    <div className="sala-cards" style={{ flex: 1 }}>
      {dados.indicadores.cartoes.map((cartao) => {
        const numeros = cartao.serie.filter((item): item is number => item != null);
        const topo = Math.max(1, ...numeros);
        return (
          <div key={cartao.titulo} className="sala-cartao" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="sala-rotulo-bloco">{cartao.titulo}</div>
            <div className="sala-numero" style={{ fontSize: 56 }}>{cartao.valor}</div>
            <div className="sala-spark" aria-hidden>
              {cartao.serie.map((valor, index) => (
                <i key={dados.indicadores.meses[index]} style={{ height: valor == null ? 4 : `${Math.max(8, (valor / topo) * 54)}px`, opacity: valor == null ? 0.35 : 1 }} />
              ))}
            </div>
            <small style={{ color: "#4E6079", fontSize: 16 }}>{dados.indicadores.meses.join("  ")}</small>
            <p style={{ margin: 0, fontSize: 18, color: "#4E6079" }}>{cartao.detalhe}</p>
          </div>
        );
      })}
    </div>
  );
}

function GraficoProgramadas({
  comparativo,
  drill,
  onDrill,
}: {
  comparativo: NonNullable<SalaSnapshot["programadas"]["comparativo"]>;
  drill: SalaDrillSelecao | null;
  onDrill: OnDrill;
}) {
  const maximo = Math.max(1, ...comparativo.meses.flatMap((m) => m.porOficina.flatMap((c) => [c.abertas, c.fechadas])));
  const rotuloOficina = new Map(comparativo.oficinas.map((o) => [o.chave, o.rotulo]));
  const CORES = ["#2C66AB", "#3E7A1E", "#D9620F"];
  return (
    <div className="sala-cartao sala-prog-grafico" style={{ overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div className="sala-rotulo-bloco">OFICINAS · PLANO · ABERTAS × FECHADAS · {comparativo.ano}</div>
        <div className="sala-prog-legenda">
          {comparativo.oficinas.map((o, i) => (
            <span key={o.chave}>
              <i style={{ background: CORES[i % CORES.length] }} /> {o.rotulo}
            </span>
          ))}
          <span>barra cheia = abertas · clara = fechadas</span>
        </div>
      </div>
      <div className="sala-prog-meses">
        {comparativo.meses.map((mes) => (
          <div key={mes.chave} className="sala-prog-mes">
            <div className="sala-prog-barras">
              {mes.porOficina.map((cel, i) => {
                const rotulo = rotuloOficina.get(cel.chave) ?? cel.chave;
                return (["abertas", "fechadas"] as const).map((modo) => {
                  const valor = cel[modo];
                  return (
                    <AlvoDrill
                      key={`${cel.chave}-${modo}`}
                      id={`programadas.${cel.chave}.${mes.chave}.${modo}`}
                      titulo={`${rotulo.toUpperCase()} · ${mes.rotulo} · ${modo.toUpperCase()}`}
                      contagem={valor}
                      drill={drill}
                      onDrill={onDrill}
                      rotuloAria={`Ver ${valor} OS ${modo} de ${rotulo} em ${mes.rotulo}`}
                      className={`sala-prog-barra ${modo}`}
                      style={{ height: `${Math.max(4, (valor / maximo) * 100)}%`, background: CORES[i % CORES.length] }}
                    >
                      <span className="sala-prog-valor">{valor}</span>
                    </AlvoDrill>
                  );
                });
              })}
            </div>
            <AlvoDrill
              id={`programadas.consolidado.${mes.chave}.todas`}
              titulo={`CONSOLIDADO · ${mes.rotulo}`}
              contagem={mes.consolidado.abertas + mes.consolidado.fechadas}
              drill={drill}
              onDrill={(id, titulo) => onDrill(id, titulo)}
              rotuloAria={`Ver OS abertas e fechadas das três oficinas em ${mes.rotulo}`}
              className="sala-alvo-texto sala-prog-mes-rotulo"
            >
              {mes.rotulo}
              <small>
                {mes.consolidado.abertas}↑ {mes.consolidado.fechadas}↓
              </small>
            </AlvoDrill>
          </div>
        ))}
      </div>
    </div>
  );
}

function TelaProgramadas({
  dados,
  drill,
  onDrill,
}: {
  dados: SalaSnapshot;
  drill: SalaDrillSelecao | null;
  onDrill: OnDrill;
}) {
  const p = dados.programadas;
  return (
    <div className="sala-coluna" style={{ flex: 1, minHeight: 0 }}>
      <p style={{ margin: 0, fontSize: 16, color: "#4E6079" }}>{p.proxy}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr", gap: 16 }}>
        <div className="sala-cartao" style={{ background: "#2C66AB", color: "#fff", border: "none" }}>
          <div className="sala-rotulo-bloco" style={{ color: "#DCE8F7" }}>CUMPRIMENTO · MÊS</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <span className="sala-numero" style={{ fontSize: 72 }}>
              {p.cumprimento == null ? "—" : `${p.cumprimento}%`}
            </span>
            <span style={{ fontSize: 22, color: "#DCE8F7" }}>
              {p.executados} de {p.previstos}
            </span>
          </div>
          <AlvoDrill
            id="programadas.impedimentos"
            titulo="IMPEDIMENTOS"
            contagem={p.impedimentos.length}
            drill={drill}
            onDrill={onDrill}
            rotuloAria={`Ver ${p.impedimentos.length} impedimento(s)`}
            className="sala-alvo-texto sala-alvo-claro"
            style={{ fontSize: 18 }}
          >
            {p.impedimentos.length} impedimento(s) à parte
          </AlvoDrill>
        </div>
        {p.porTipo.map((tipo) => (
          <AlvoDrill
            key={tipo.tipo}
            id={`programadas.tipo.${slugTv(tipo.tipo)}`}
            titulo={`${tipo.tipo.toUpperCase()} · EXECUTADAS NO MÊS`}
            contagem={tipo.executados}
            drill={drill}
            onDrill={onDrill}
            rotuloAria={`Ver ${tipo.executados} OS de ${tipo.tipo} executadas no mês`}
            className="sala-cartao"
          >
            <span className="sala-rotulo-bloco" style={{ display: "block" }}>{tipo.tipo.toUpperCase()}</span>
            <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span className="sala-numero" style={{ fontSize: 48 }}>
                {tipo.executados}
                <span style={{ fontSize: 24, color: "#4E6079" }}>/{tipo.previstos}</span>
              </span>
              <span style={{ fontSize: 20, fontWeight: 600, color: tipo.faltam ? "#A8460A" : "#3E7A1E" }}>
                {tipo.faltam ? `faltam ${tipo.faltam}` : "ok"}
              </span>
            </span>
            <span style={{ display: "block", height: 10, borderRadius: 6, background: "#E3EAF3", overflow: "hidden", marginTop: 8 }}>
              <span style={{ display: "block", height: 10, borderRadius: 6, background: "#2C66AB", width: `${tipo.percentual ?? 0}%` }} />
            </span>
          </AlvoDrill>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2.2fr) minmax(0, 1fr)", gap: 16, flex: 1, minHeight: 0 }}>
        {p.comparativo ? (
          <GraficoProgramadas comparativo={p.comparativo} drill={drill} onDrill={onDrill} />
        ) : (
          <div className="sala-cartao">
            <p className="sala-vazio">{p.aviso}</p>
          </div>
        )}
        <div className="sala-cartao" style={{ overflow: "hidden" }}>
          <AlvoDrill
            id="programadas.impedimentos"
            titulo="IMPEDIMENTOS"
            contagem={p.impedimentos.length}
            drill={drill}
            onDrill={onDrill}
            rotuloAria={`Ver ${p.impedimentos.length} impedimento(s)`}
            className="sala-rotulo-bloco sala-alvo-texto"
          >
            IMPEDIMENTOS · {p.impedimentos.length}
          </AlvoDrill>
          {p.impedimentos.length === 0 ? (
            <p className="sala-vazio">Nenhum impedimento ativo. Cadastre em /sala/registros.</p>
          ) : (
            p.impedimentos.map((item) => (
              <div
                key={`${item.tag}-${item.motivo}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "100px minmax(0, 1fr) 110px",
                  gap: 10,
                  alignItems: "center",
                  padding: "10px 0",
                  borderBottom: "1px solid #E6ECF3",
                }}
              >
                <strong style={{ color: "#2C66AB", fontSize: 18 }}>{item.tag}</strong>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 20, fontWeight: 600 }}>{item.equipamento}</div>
                  <div style={{ fontSize: 16, color: "#4E6079" }}>{item.motivo}</div>
                </div>
                <div style={{ textAlign: "right", fontSize: 16, color: "#6B1029" }}>
                  nova data
                  <div className="sala-numero" style={{ fontSize: 20 }}>{item.novaData}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const COMPRAS_POR_PAGINA = 7;
const GRID_COMPRAS =
  "110px 120px minmax(0,1.2fr) 88px 88px 100px 132px 64px 140px 128px";

type OsSugestaoTv = {
  os: string;
  equipamento: string;
  tag: string;
  setor: string;
  situacao: string;
  etapa: string;
};

function tomSituacaoCompras(situacao: string) {
  if (situacao.includes("cobrar")) return "#A3123A";
  if (situacao.includes("aguarda resposta")) return "#8A5A00";
  if (situacao.includes("aguarda entrega")) return "#2C66AB";
  return "#3E7A1E";
}

function exibirNumeroOs(valor: string | undefined | null) {
  const t = (valor ?? "").trim();
  return t || "—";
}

function valorEditavelOs(valor: string | undefined | null) {
  const t = (valor ?? "").trim();
  return t === "—" ? "" : t;
}

function CelulaOsEditavel({
  numeroOrdem,
  valor,
  desabilitado,
  onInteragir,
  onSalvo,
  onFimEdicao,
}: {
  numeroOrdem: string;
  valor: string;
  desabilitado?: boolean;
  onInteragir?: () => void;
  onSalvo: (numeroOs: string) => void | Promise<void>;
  onFimEdicao?: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sugestoes, setSugestoes] = useState<OsSugestaoTv[]>([]);
  const [buscando, setBuscando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const caixaRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);
  const ignorarBlurRef = useRef(false);

  const valorAtual = valorEditavelOs(valor);

  useEffect(() => {
    if (!editando) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editando]);

  useEffect(() => {
    if (!editando) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void (async () => {
        setBuscando(true);
        try {
          const resposta = await fetch(
            `/api/sala/os-abertas?q=${encodeURIComponent(rascunho.trim())}&limit=8`,
            { cache: "no-store" },
          );
          if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
          const json = (await resposta.json()) as { itens?: OsSugestaoTv[] };
          setSugestoes(json.itens ?? []);
        } catch {
          setSugestoes([]);
        } finally {
          setBuscando(false);
        }
      })();
    }, 280);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [editando, rascunho]);

  const iniciarEdicao = () => {
    if (desabilitado || salvando) return;
    onInteragir?.();
    setErro(null);
    setRascunho(valorAtual);
    setSugestoes([]);
    setEditando(true);
  };

  const cancelar = () => {
    setEditando(false);
    setErro(null);
    setSugestoes([]);
    setRascunho(valorAtual);
    onFimEdicao?.();
  };

  const salvar = async (valorFinal?: string) => {
    if (salvando) return;
    const numeroOs = (valorFinal ?? rascunho).trim();
    if (numeroOs === valorAtual) {
      cancelar();
      return;
    }
    onInteragir?.();
    setSalvando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/sala/ordens-compra", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numero_ordem: numeroOrdem,
          numero_os: numeroOs || null,
        }),
      });
      if (!resposta.ok) {
        const json = (await resposta.json().catch(() => null)) as { message?: string; erro?: string } | null;
        throw new Error(json?.message ?? json?.erro ?? `HTTP ${resposta.status}`);
      }
      setEditando(false);
      setSugestoes([]);
      await onSalvo(numeroOs);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "falha ao salvar OS");
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } finally {
      setSalvando(false);
    }
  };

  if (!editando) {
    return (
      <button
        type="button"
        className="sala-compras-os-btn"
        disabled={desabilitado}
        title="Clique para editar o nº da OS"
        onClick={iniciarEdicao}
      >
        <span className="sala-numero" style={{ fontSize: 17 }}>
          {exibirNumeroOs(valor)}
        </span>
      </button>
    );
  }

  return (
    <div ref={caixaRef} className="sala-compras-os-editar">
      <input
        ref={inputRef}
        className="sala-compras-os-input"
        value={rascunho}
        disabled={salvando}
        placeholder="nº OS…"
        autoComplete="off"
        aria-label={`Editar OS da OC ${numeroOrdem}`}
        onChange={(e) => setRascunho(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void salvar();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancelar();
          }
        }}
        onBlur={() => {
          if (ignorarBlurRef.current || salvando) return;
          void salvar();
        }}
      />
      {salvando ? <span className="sala-compras-os-status">salvando…</span> : null}
      {erro ? <span className="sala-compras-os-erro">{erro}</span> : null}
      {!salvando ? (
        <div className="sala-compras-os-sugestoes">
          {buscando ? (
            <p className="sala-compras-os-sugestao-vazio">Buscando OS…</p>
          ) : sugestoes.length === 0 ? (
            <p className="sala-compras-os-sugestao-vazio">
              Digite e Enter para salvar · Esc cancela
            </p>
          ) : (
            <ul>
              {sugestoes.map((item) => (
                <li key={item.os}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      ignorarBlurRef.current = true;
                    }}
                    onClick={() => {
                      setRascunho(item.os);
                      ignorarBlurRef.current = false;
                      void salvar(item.os);
                    }}
                  >
                    <span className="sala-numero">{item.os}</span>
                    <span>
                      {item.equipamento} · {item.tag}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function TelaCompras({
  dados,
  onInteracaoChange,
  onAtualizar,
}: {
  dados: SalaSnapshot;
  /** true enquanto edita OS / confirma entrega — pausa rotação só nesse intervalo */
  onInteracaoChange?: (ativa: boolean) => void;
  onAtualizar?: () => void | Promise<void>;
}) {
  const c = dados.compras;
  const [pagina, setPagina] = useState(0);
  const [ocultas, setOcultas] = useState<string[]>([]);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [erroEntrega, setErroEntrega] = useState<string | null>(null);
  const [osLocal, setOsLocal] = useState<Record<string, string>>({});
  const [editandoOs, setEditandoOs] = useState(false);

  useEffect(() => {
    onInteracaoChange?.(editandoOs || Boolean(confirmando) || Boolean(busy));
  }, [editandoOs, confirmando, busy, onInteracaoChange]);

  const pedidosVisiveis = c.pedidos.filter((p) => !ocultas.includes(p.numeroOrdem));
  const totalPaginas = Math.max(1, Math.ceil(pedidosVisiveis.length / COMPRAS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas - 1);
  const inicio = paginaAtual * COMPRAS_POR_PAGINA;
  const paginaPedidos = pedidosVisiveis.slice(inicio, inicio + COMPRAS_POR_PAGINA);

  useEffect(() => {
    setPagina((atual) => Math.min(atual, Math.max(0, totalPaginas - 1)));
  }, [totalPaginas]);

  useEffect(() => {
    if (!confirmando) return;
    const id = window.setTimeout(() => setConfirmando(null), 5_000);
    return () => window.clearTimeout(id);
  }, [confirmando]);

  const marcarEntregue = async (numeroOrdem: string) => {
    setBusy(numeroOrdem);
    setErroEntrega(null);
    try {
      const resposta = await fetch("/api/sala/ordens-compra", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numero_ordem: numeroOrdem,
          marcar_entregue: true,
          itens_entregues: null,
        }),
      });
      if (!resposta.ok) {
        const json = (await resposta.json().catch(() => null)) as { message?: string; erro?: string } | null;
        throw new Error(json?.message ?? json?.erro ?? `HTTP ${resposta.status}`);
      }
      setOcultas((atual) => (atual.includes(numeroOrdem) ? atual : [...atual, numeroOrdem]));
      setConfirmando(null);
      await onAtualizar?.();
    } catch (falha) {
      setErroEntrega(falha instanceof Error ? falha.message : "falha ao marcar entregue");
    } finally {
      setBusy(null);
    }
  };

  const cliqueEntrega = (numeroOrdem: string) => {
    if (confirmando === numeroOrdem) {
      void marcarEntregue(numeroOrdem);
      return;
    }
    setConfirmando(numeroOrdem);
  };

  const osDaLinha = (pedido: { numeroOrdem: string; numeroOs: string }) =>
    osLocal[pedido.numeroOrdem] ?? pedido.numeroOs;

  return (
    <div className="sala-coluna" style={{ flex: 1, minHeight: 0 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 100px 1fr 100px 1fr 320px",
          gap: 12,
          alignItems: "stretch",
        }}
      >
        <div className="sala-cartao" style={{ border: "2px solid #EBCB6A" }}>
          <div className="sala-rotulo-bloco" style={{ color: "#8A5A00" }}>1 · PEDIDO (E-MAIL)</div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>Aguardando resposta / OC</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span className="sala-numero" style={{ fontSize: 56, color: "#8A5A00" }}>{c.aguardaResposta}</span>
            <span style={{ color: "#4E6079", fontSize: 18 }}>
              {c.aguardaRespostaMaisAntigo != null ? `mais antigo ${c.aguardaRespostaMaisAntigo}d` : "—"}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
          <span className="sala-numero" style={{ fontSize: 22 }}>{c.mediaPedidoOrdem == null ? "—" : `${c.mediaPedidoOrdem} d`}</span>
          <span style={{ color: "#4E6079", fontSize: 14 }}>média</span>
        </div>
        <div className="sala-cartao" style={{ border: "2px solid #B9CBE3" }}>
          <div className="sala-rotulo-bloco">2 · RESPOSTA / OC</div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>Aguardando entrega</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span className="sala-numero" style={{ fontSize: 56 }}>{c.aguardaEntrega}</span>
            <span style={{ color: "#4E6079", fontSize: 18 }}>
              {c.aguardaEntregaMaisAntiga != null ? `mais antiga ${c.aguardaEntregaMaisAntiga}d` : "—"}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
          <span className="sala-numero" style={{ fontSize: 22 }}>{c.mediaOrdemEntrega == null ? "—" : `${c.mediaOrdemEntrega} d`}</span>
          <span style={{ color: "#4E6079", fontSize: 14 }}>média</span>
        </div>
        <div className="sala-cartao" style={{ border: "2px solid #A9CC8E" }}>
          <div className="sala-rotulo-bloco" style={{ color: "#3E7A1E" }}>3 · ENTREGA</div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>No mês</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span className="sala-numero" style={{ fontSize: 56, color: "#3E7A1E" }}>{c.entreguesMes}</span>
            <span style={{ color: "#4E6079", fontSize: 18 }}>
              {c.mediaPontaAPonta == null ? "—" : `ponta a ponta ${c.mediaPontaAPonta} d`}
            </span>
          </div>
        </div>
        <div className="sala-cartao" style={{ background: "#2C66AB", color: "#fff", border: "none" }}>
          <div className="sala-rotulo-bloco" style={{ color: "#DCE8F7" }}>PADRONIZAÇÃO</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span className="sala-numero" style={{ fontSize: 56 }}>
              {c.percentualComOs == null ? "—" : `${c.percentualComOs}%`}
            </span>
            <span style={{ color: "#DCE8F7", fontSize: 18 }}>com nº de OS</span>
          </div>
          <div style={{ color: "#DCE8F7", fontSize: 18 }}>{c.semOs} OC(s) aberta(s) sem OS</div>
        </div>
      </div>

      <div
        className="sala-cartao"
        style={{
          marginTop: 8,
          padding: "10px 14px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 12,
          border: "1px solid #B9CBE3",
          background: "#F4F8FC",
        }}
      >
        <div style={{ flex: 1, minWidth: 280 }}>
          <div className="sala-rotulo-bloco" style={{ marginBottom: 2 }}>
            ORDENS FORMAIS · ROBÔ E-MAILS COMPRAS
          </div>
          <div style={{ fontSize: 17, color: "#1D4A80" }}>
            Clique no nº da OS para editar · marque entrega (dois toques) · detalhes em{" "}
            <a href="/sala/ordens-compra" style={{ fontWeight: 700, color: "#2C66AB", textDecoration: "underline" }}>
              /sala/ordens-compra
            </a>
            . Pedido (e-mail) · Resposta / OC · Entrega = data real.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span className="sala-numero" style={{ fontSize: 40, color: "#2C66AB" }}>{c.totalOrdens}</span>
          <span style={{ color: "#4E6079", fontSize: 16 }}>no banco</span>
        </div>
        {c.pedidosLegadoAbertos > 0 ? (
          <div style={{ width: "100%", fontSize: 15, color: "#4E6079" }}>
            Funil legado e-mail→SC: {c.pedidosLegadoAbertos} aberto(s) em{" "}
            <a href="/sala/pedidos" style={{ color: "#2C66AB", fontWeight: 600 }}>
              /sala/pedidos
            </a>
            .
          </div>
        ) : null}
      </div>

      <div
        className="sala-cartao"
        style={{ flex: 1, overflow: "hidden", marginTop: 8, display: "flex", flexDirection: "column", minHeight: 0 }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <div className="sala-rotulo-bloco">OCs EM ABERTO · {pedidosVisiveis.length}</div>
          {pedidosVisiveis.length > COMPRAS_POR_PAGINA ? (
            <span style={{ color: "#4E6079", fontSize: 16 }}>
              página {paginaAtual + 1}/{totalPaginas}
            </span>
          ) : null}
        </div>
        {c.aviso ? <p className="sala-vazio">{c.aviso}</p> : null}
        {erroEntrega ? (
          <p className="sala-vazio" style={{ color: "#A3123A" }}>
            Entrega: {erroEntrega}
          </p>
        ) : null}
        {pedidosVisiveis.length === 0 && !c.aviso ? (
          <p className="sala-vazio">Nenhuma OC aberta. Registre entrega aqui ou em /sala/ordens-compra.</p>
        ) : null}
        {pedidosVisiveis.length > 0 ? (
          <>
            <div className="sala-compras-lista">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: GRID_COMPRAS,
                  gap: 10,
                  padding: "8px 0",
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: 1,
                  color: "#4E6079",
                  borderBottom: "1px solid #DCE4EE",
                  position: "sticky",
                  top: 0,
                  background: "var(--cartao, #fff)",
                  zIndex: 1,
                }}
              >
                <span>OC</span>
                <span>CATEGORIA</span>
                <span>FORNECEDOR</span>
                <span>PEDIDO</span>
                <span>RESP./OC</span>
                <span>VALOR</span>
                <span>OS</span>
                <span style={{ textAlign: "right" }}>PARADO</span>
                <span style={{ textAlign: "right" }}>SITUAÇÃO</span>
                <span style={{ textAlign: "right" }}>ENTREGA</span>
              </div>
              {paginaPedidos.map((pedido) => {
                const tom = tomSituacaoCompras(pedido.situacao);
                const emConfirmacao = confirmando === pedido.numeroOrdem;
                const carregando = busy === pedido.numeroOrdem;
                return (
                  <div
                    key={pedido.numeroOrdem}
                    style={{
                      display: "grid",
                      gridTemplateColumns: GRID_COMPRAS,
                      gap: 10,
                      alignItems: "center",
                      padding: "10px 0",
                      borderBottom: "1px solid #E6ECF3",
                      background: pedido.situacao.includes("cobrar") ? "#FDF1F4" : "transparent",
                    }}
                  >
                    <div>
                      <div className="sala-numero" style={{ fontSize: 18 }}>{pedido.numeroOrdem}</div>
                      <div style={{ fontSize: 13, color: "#4E6079" }}>{pedido.confianca}</div>
                    </div>
                    <span style={{ fontSize: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {pedido.categoria}
                    </span>
                    <span style={{ fontSize: 17, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {pedido.fornecedor}
                    </span>
                    <span className="sala-numero" style={{ fontSize: 17 }}>{pedido.dataPedido}</span>
                    <span className="sala-numero" style={{ fontSize: 17 }}>{pedido.dataOrdem}</span>
                    <span style={{ fontSize: 16 }}>{pedido.valor}</span>
                    <CelulaOsEditavel
                      numeroOrdem={pedido.numeroOrdem}
                      valor={osDaLinha(pedido)}
                      desabilitado={Boolean(busy)}
                      onInteragir={() => setEditandoOs(true)}
                      onFimEdicao={() => setEditandoOs(false)}
                      onSalvo={async (numeroOs) => {
                        setOsLocal((atual) => ({
                          ...atual,
                          [pedido.numeroOrdem]: numeroOs.trim() || "—",
                        }));
                        setEditandoOs(false);
                        await onAtualizar?.();
                      }}
                    />
                    <span className="sala-numero" style={{ fontSize: 22, textAlign: "right", color: tom }}>
                      {pedido.paradoDias}d
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 700, textAlign: "right", color: tom }}>
                      {pedido.situacao}
                    </span>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        className={`sala-compras-btn-entrega${emConfirmacao ? " confirmar" : ""}`}
                        disabled={Boolean(busy) || editandoOs}
                        onClick={() => cliqueEntrega(pedido.numeroOrdem)}
                      >
                        {carregando ? "…" : emConfirmacao ? "Confirmar?" : "Entregue"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {totalPaginas > 1 ? (
              <div className="sala-compras-pager">
                <button
                  type="button"
                  disabled={paginaAtual <= 0}
                  onClick={() => setPagina((atual) => Math.max(0, atual - 1))}
                >
                  ← Anterior
                </button>
                <span style={{ fontSize: 18, color: "#4E6079", fontWeight: 600 }}>
                  página {paginaAtual + 1}/{totalPaginas} · {pedidosVisiveis.length} abertas
                </span>
                <button
                  type="button"
                  disabled={paginaAtual >= totalPaginas - 1}
                  onClick={() => setPagina((atual) => Math.min(totalPaginas - 1, atual + 1))}
                >
                  Próxima →
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

function Conteudo({
  tela,
  dados,
  destaque,
  novasOs,
  drill,
  onDrill,
  onSelecionarOs,
  onInteracaoChange,
  onAtualizar,
}: {
  tela: TelaSala;
  dados: SalaSnapshot;
  destaque: string | null;
  novasOs: ReadonlySet<string>;
  drill: SalaDrillSelecao | null;
  onDrill: (id: string, titulo: string, contagem?: number) => void;
  onSelecionarOs?: (os: string) => void;
  onInteracaoChange?: (ativa: boolean) => void;
  onAtualizar?: () => void | Promise<void>;
}) {
  if (tela === "agora") {
    return (
      <TelaAgora
        dados={dados}
        destaque={destaque}
        novasOs={novasOs}
        drill={drill}
        onDrill={onDrill}
        onSelecionarOs={onSelecionarOs}
      />
    );
  }
  if (tela === "fluxo") return <TelaFluxo dados={dados} drill={drill} onDrill={onDrill} onSelecionarOs={onSelecionarOs} />;
  if (tela === "envelhecimento") return <TelaEnvelhecimento dados={dados} drill={drill} onDrill={onDrill} />;
  if (tela === "compras") {
    return (
      <TelaCompras dados={dados} onInteracaoChange={onInteracaoChange} onAtualizar={onAtualizar} />
    );
  }
  if (tela === "programadas") return <TelaProgramadas dados={dados} drill={drill} onDrill={onDrill} />;
  if (tela === "ciclo-de-vida") {
    return <TelaCiclo dados={dados} drill={drill} onDrill={onDrill} />;
  }
  if (tela === "indicadores") return <TelaIndicadores dados={dados} />;
  if (tela === "treinamentos") {
    return <TvTreinamentos onInteracaoChange={onInteracaoChange} />;
  }
  if (tela === "evolucao") {
    return <TelaEvolucao />;
  }
  return <TelaAgora dados={dados} destaque={destaque} novasOs={novasOs} drill={drill} onDrill={onDrill} onSelecionarOs={onSelecionarOs} />;
}

export function SalaApp({
  telaFixa,
  painelTreinamentos,
}: {
  telaFixa?: TelaSala;
  /** Dados SSR da tela Treinamentos (evita tela em branco enquanto o snapshot PBI carrega). */
  painelTreinamentos?: PainelTreinamentos | null;
}) {
  const [dados, setDados] = useState<SalaSnapshot | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [falhaDesde, setFalhaDesde] = useState<number | null>(null);
  const [indice, setIndice] = useState(0);
  /** Pausa manual (Espaço / botão). Overlays e edição de Compras pausam à parte. */
  const [pausadoManual, setPausadoManual] = useState(false);
  /** Edição OS / confirmação de entrega na tela Compras — só enquanto ativo. */
  const [interacaoCompras, setInteracaoCompras] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [destaque, setDestaque] = useState<string | null>(null);
  const [novasOs, setNovasOs] = useState<string[]>([]);
  /** Drill-down Fase 1 (Agora): docs/sala/drill-down-tv.md */
  const [drill, setDrill] = useState<SalaDrillSelecao | null>(null);
  /** Detalhe operacional de uma OS (clique na fila / linha do drill). */
  const [osSelecionada, setOsSelecionada] = useState<string | null>(null);
  /** Filtros de visualização do drill (C5) — espelhados na URL (C9). */
  const [filtrosDrill, setFiltrosDrill] = useState<FiltrosRecorte>({});
  /** Resultado do recorte aberto: título/total do servidor + detalhe "do cache" (C11). */
  const [recorteInfo, setRecorteInfo] = useState<{
    id: string;
    titulo: string;
    total: number;
    detalhes: Record<string, OsDetalheSnapshot>;
    oss: string[];
  } | null>(null);
  const [mobile, setMobile] = useState(false);
  const [demoDrill, setDemoDrill] = useState(false);
  /** Elementos clicados, para devolver o foco ao fechar (D10). */
  const focoDrillRef = useRef<HTMLElement | null>(null);
  const focoOsRef = useRef<HTMLElement | null>(null);
  const urlProntaRef = useRef(false);
  const [escala, setEscala] = useState(1);
  const [deslocamento, setDeslocamento] = useState(0);
  /**
   * Relógio de parede da TV: hora local America/Sao_Paulo no *cliente*, tick 1s.
   * Independente de `dados.relogio` / fuso do container do servidor (snapshot).
   * `atualizadoEm` e demais timestamps do snapshot continuam vindos do servidor.
   */
  const [relogio, setRelogio] = useState("—");
  const [somLigado, setSomLigado] = useState(false);
  const [somPronto, setSomPronto] = useState(false);
  const idsAnterioresRef = useRef<string[] | null>(null);
  const somLigadoRef = useRef(false);
  const somProntoRef = useRef(false);
  const novasTimerRef = useRef<number | null>(null);

  useEffect(() => {
    somLigadoRef.current = somLigado;
  }, [somLigado]);
  useEffect(() => {
    somProntoRef.current = somPronto;
  }, [somPronto]);

  useEffect(() => {
    try {
      setSomLigado(window.localStorage.getItem(SALA_SOM_STORAGE) === "1");
    } catch {
      setSomLigado(false);
    }
  }, []);

  const devolverFoco = useCallback((ref: { current: HTMLElement | null }) => {
    const alvo = ref.current;
    ref.current = null;
    if (alvo && document.contains(alvo)) window.setTimeout(() => alvo.focus(), 0);
  }, []);

  const limparDrill = useCallback(() => {
    setOsSelecionada(null);
    setDrill(null);
    setFiltrosDrill({});
    setRecorteInfo(null);
    focoOsRef.current = null;
    devolverFoco(focoDrillRef);
  }, [devolverFoco]);

  const fecharOs = useCallback(() => {
    setOsSelecionada(null);
    devolverFoco(focoOsRef);
  }, [devolverFoco]);

  const selecionarOs = useCallback((os: string, el?: HTMLElement) => {
    focoOsRef.current = el ?? (document.activeElement as HTMLElement | null);
    setOsSelecionada(os);
  }, []);

  const onRecorteResolvido = useCallback(
    (info: { titulo: string; total: number; detalhes: Record<string, OsDetalheSnapshot>; oss: string[] }) => {
      setDrill((atual) => {
        if (!atual) return atual;
        setRecorteInfo({ id: atual.id, ...info });
        // Link compartilhado (C9/D9): título vem do servidor.
        if (!atual.titulo) return { ...atual, titulo: info.titulo };
        return atual;
      });
    },
    [],
  );

  const onInteracaoCompras = useCallback((ativa: boolean) => {
    setInteracaoCompras(ativa);
  }, []);

  const persistirSom = useCallback((ligado: boolean) => {
    setSomLigado(ligado);
    somLigadoRef.current = ligado;
    try {
      window.localStorage.setItem(SALA_SOM_STORAGE, ligado ? "1" : "0");
    } catch {
      /* TV sem storage */
    }
  }, []);

  const ativarSomPorGesto = useCallback(async () => {
    const ok = await desbloquearSomTv();
    setSomPronto(ok);
    somProntoRef.current = ok;
    if (ok && window.localStorage.getItem(SALA_SOM_STORAGE) !== "0") {
      persistirSom(true);
    }
    return ok;
  }, [persistirSom]);

  const alternarSom = useCallback(async () => {
    const ok = await desbloquearSomTv();
    setSomPronto(ok);
    somProntoRef.current = ok;
    persistirSom(!somLigadoRef.current);
  }, [persistirSom]);

  const carregar = useCallback(async () => {
    try {
      const demoParam = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("demo") : null;
      const url =
        demoParam === "1" ? "/api/sala/snapshot?demo=1" : demoParam === "drill" ? "/api/sala/snapshot?demo=drill" : "/api/sala/snapshot";
      const resposta = await fetch(url, {
        cache: "no-store",
      });
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      const json = (await resposta.json()) as SalaSnapshot;
      const ids = idsOsAbertas(json);
      const novas = novasOsDesde(idsAnterioresRef.current, ids);
      idsAnterioresRef.current = ids;
      if (novas.length > 0) {
        if (somLigadoRef.current && somProntoRef.current) tocarChimeNovaOs();
        setNovasOs(novas);
        if (novasTimerRef.current) window.clearTimeout(novasTimerRef.current);
        novasTimerRef.current = window.setTimeout(() => setNovasOs([]), 12_000);
      }
      setDados(json);
      setErro(null);
      setFalhaDesde(null);
      const alerta = json.alertas[0];
      if (alerta && !telaFixa) {
        setDestaque(alerta.os);
        setIndice(0);
        window.setTimeout(() => setDestaque(null), 60_000);
      }
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "sem conexão");
      setFalhaDesde((atual) => atual ?? Date.now());
    }
  }, [telaFixa]);

  useEffect(() => {
    const id = window.setTimeout(() => void carregar(), 0);
    const timer = window.setInterval(() => void carregar(), 60_000);
    return () => {
      window.clearTimeout(id);
      window.clearInterval(timer);
    };
  }, [carregar]);

  useEffect(() => {
    if (!falhaDesde) return;
    const timer = window.setInterval(() => {
      if (Date.now() - falhaDesde > 5 * 60_000) window.location.reload();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [falhaDesde]);

  useEffect(() => {
    // Wall clock: always America/Sao_Paulo from the TV browser clock (not snapshot.relogio).
    const formatador = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const tick = () => setRelogio(formatador.format(new Date()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const ajustar = () => setEscala(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    ajustar();
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, []);

  useEffect(() => {
    const atualizar = () => setDeslocamento(1 + (new Date().getHours() % 2));
    atualizar();
    const timer = window.setInterval(atualizar, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const sequencia = dados?.sequencia?.length ? dados.sequencia : TELAS_SALA.map((item) => item.id);
  const tela = telaFixa ?? sequencia[indice % sequencia.length] ?? "agora";
  const segundos = dados?.segundos || 30;
  /** Rotação pausa só com overlay/edição ativa ou pausa manual — limpar retoma. */
  const pausado =
    pausadoManual || Boolean(drill) || Boolean(osSelecionada) || interacaoCompras;

  const selecionarDrill = useCallback(
    (id: string, titulo: string, contagem?: number) => {
      if (drill?.id === id) {
        limparDrill();
        return;
      }
      focoDrillRef.current = document.activeElement as HTMLElement | null;
      setOsSelecionada(null);
      setFiltrosDrill({});
      setRecorteInfo(null);
      setDrill({ tela, id, titulo, contagem });
    },
    [tela, drill, limparDrill],
  );

  const telaAnteriorRef = useRef(tela);
  useEffect(() => {
    if (telaAnteriorRef.current === tela) return;
    telaAnteriorRef.current = tela;
    setOsSelecionada(null);
    setDrill(null);
    setFiltrosDrill({});
    setRecorteInfo(null);
    setInteracaoCompras(false);
  }, [tela]);

  // Esc fecha um nível (detalhe → lista) e devolve o foco ao elemento clicado (D4/D10).
  useEffect(() => {
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        if (osSelecionada) {
          fecharOs();
          return;
        }
        if (drill) limparDrill();
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [osSelecionada, drill, fecharOs, limparDrill]);

  // Celular (≤ 600 px): sheet em tela cheia fora do palco escalado (C10/D7).
  useEffect(() => {
    const consulta = window.matchMedia("(max-width: 600px)");
    const aplicar = () => setMobile(consulta.matches);
    aplicar();
    consulta.addEventListener("change", aplicar);
    return () => consulta.removeEventListener("change", aplicar);
  }, []);

  // URL → estado (C9/D9) no carregamento e no voltar/avançar do navegador (C7).
  useEffect(() => {
    const aplicar = () => {
      const estado = lerUrlDrill(window.location.search);
      setDemoDrill(new URLSearchParams(window.location.search).get("demo") === "drill");
      if (estado.drill && isRecorteDrill(estado.drill)) {
        setDrill((atual) => (atual?.id === estado.drill ? atual : { tela, id: estado.drill as string, titulo: "" }));
        setFiltrosDrill(estado.filtros);
        setOsSelecionada(estado.os);
      } else {
        setDrill((atual) => (atual && isRecorteDrill(atual.id) ? null : atual));
        setOsSelecionada(estado.os);
      }
      urlProntaRef.current = true;
    };
    aplicar();
    window.addEventListener("popstate", aplicar);
    return () => window.removeEventListener("popstate", aplicar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Estado → URL: abrir lista/OS cria entrada no histórico (voltar fecha); filtros só substituem.
  const urlAnteriorRef = useRef<{ drill: string | null; os: string | null }>({ drill: null, os: null });
  useEffect(() => {
    if (!urlProntaRef.current) return;
    const recorte = drill && isRecorteDrill(drill.id) ? drill.id : null;
    const os = recorte ? osSelecionada : null;
    const destino = `${window.location.pathname}${escreverUrlDrill(window.location.search, { drill: recorte, os, filtros: filtrosDrill })}`;
    const atual = `${window.location.pathname}${window.location.search}`;
    if (destino === atual) {
      urlAnteriorRef.current = { drill: recorte, os };
      return;
    }
    const anterior = urlAnteriorRef.current;
    const abriu = (recorte && recorte !== anterior.drill) || (os && os !== anterior.os);
    if (abriu) window.history.pushState(null, "", destino);
    else window.history.replaceState(null, "", destino);
    urlAnteriorRef.current = { drill: recorte, os };
  }, [drill, osSelecionada, filtrosDrill]);

  // Sem interação por 90 s, o drill fecha e a rotação volta — nunca com telaFixa (U1/D6).
  const drillAberto = Boolean(drill) || Boolean(osSelecionada);
  useEffect(() => {
    if (telaFixa || !drillAberto) return;
    let timer = window.setTimeout(() => limparDrill(), DRILL_IDLE_MS);
    const reiniciar = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => limparDrill(), DRILL_IDLE_MS);
    };
    const eventos = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;
    for (const nome of eventos) window.addEventListener(nome, reiniciar, { capture: true, passive: true });
    return () => {
      window.clearTimeout(timer);
      for (const nome of eventos) window.removeEventListener(nome, reiniciar, { capture: true });
    };
  }, [telaFixa, drillAberto, limparDrill]);

  useEffect(() => {
    if (telaFixa || pausado) return;
    const inicio = Date.now();
    const timer = window.setInterval(() => {
      const fracao = (Date.now() - inicio) / (segundos * 1000);
      if (fracao >= 1) {
        setIndice((atual) => atual + 1);
        setProgresso(0);
      } else {
        setProgresso(fracao);
      }
    }, 200);
    return () => window.clearInterval(timer);
  }, [indice, pausado, segundos, telaFixa]);

  useEffect(() => {
    if (telaFixa) return;
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") return;
      if (evento.key === "ArrowRight") {
        setOsSelecionada(null);
        setDrill(null);
        setIndice((atual) => atual + 1);
      }
      if (evento.key === "ArrowLeft") {
        setOsSelecionada(null);
        setDrill(null);
        setIndice((atual) => (atual + sequencia.length - 1) % sequencia.length);
      }
      if (evento.key === " ") {
        evento.preventDefault();
        // Com overlay/edição: Espaço limpa e retoma. Sem overlay: pausa/continua manual.
        if (drill || osSelecionada || interacaoCompras) {
          setOsSelecionada(null);
          setDrill(null);
          setInteracaoCompras(false);
          setPausadoManual(false);
        } else {
          setPausadoManual((atual) => !atual);
        }
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [sequencia.length, telaFixa, drill, osSelecionada, interacaoCompras]);

  const atualizadoHaMin = dados ? Math.max(0, Math.round((Date.now() - new Date(dados.atualizadoEm).getTime()) / 60_000)) : null;
  const desatualizado = atualizadoHaMin != null && atualizadoHaMin >= 20;
  const proxima = sequencia[(indice + 1) % sequencia.length];
  const proximaLabel = TELAS_SALA.find((item) => item.id === proxima)?.label ?? proxima;
  const restante = Math.max(0, Math.ceil((1 - progresso) * segundos));
  const recorteAtivo = Boolean(drill && isRecorteDrill(drill.id));
  const drillLinhas = drill
    ? isCicloAnoDrill(drill.id) || recorteAtivo
      ? []
      : (dados?.detalhes?.[drill.id] ?? [])
    : [];
  const cicloBucket = drill && dados && isCicloAnoDrill(drill.id) ? bucketCicloAno(dados, drill.id) : null;
  const cicloItens = cicloBucket?.itens ?? [];
  const recorteDoDrill = recorteInfo && drill && recorteInfo.id === drill.id ? recorteInfo : null;
  const drillContagem = drill
    ? isCicloAnoDrill(drill.id)
      ? cicloItens.length
      : recorteAtivo
        ? (recorteDoDrill?.total ?? drill.contagem)
        : drillLinhas.length
    : undefined;
  /** Telas com detalhe buscado na API (D-SD1); as demais seguem só com o snapshot. */
  const detalheRemoto = recorteAtivo || tela === "fluxo" || tela === "envelhecimento" || tela === "programadas";
  const osDetalhe = osSelecionada && !detalheRemoto ? (dados?.osDetalhes?.[osSelecionada] ?? null) : null;
  const cacheOs = osSelecionada
    ? (recorteDoDrill?.detalhes[osSelecionada] ?? dados?.osDetalhes?.[osSelecionada] ?? null)
    : null;
  const osForaDoRecorte = Boolean(osSelecionada && recorteDoDrill && !recorteDoDrill.oss.includes(osSelecionada));

  return (
    <div className={`${mono.variable} sala-root`}>
      <div className="sala-viewport">
        <div
          className="sala-stage"
          style={{
            width: Math.round(1920 * escala),
            height: Math.round(1080 * escala),
          }}
        >
          <div
            className="sala-frame"
            onPointerDown={() => {
              if (!somProntoRef.current) void ativarSomPorGesto();
            }}
            style={{
              transform: `translate(${deslocamento}px, ${deslocamento}px) scale(${escala})`,
            }}
          >
          <div className="sala-faixa" />
          <Cabecalho
            tela={tela}
            relogio={relogio}
            drill={drill}
            drillContagem={drillContagem}
            onLimparDrill={limparDrill}
          />
          <div className="sala-miolo">
            {desatualizado ? <div className="sala-desatualizado">Dados desatualizados há {atualizadoHaMin} min</div> : null}
            <div className="sala-miolo-row">
              <div className="sala-miolo-main">
                {tela === "treinamentos" ? (
                  <TvTreinamentos
                    painel={painelTreinamentos}
                    onInteracaoChange={onInteracaoCompras}
                  />
                ) : tela === "evolucao" ? (
                  <TelaEvolucao />
                ) : (
                  <>
                    {erro && !dados ? <p className="sala-vazio">Sem conexão com o snapshot ({erro}).</p> : null}
                    {!dados && !erro ? <p className="sala-vazio">Carregando a sala…</p> : null}
                    {dados ? (
                      <Conteudo
                        tela={tela}
                        dados={dados}
                        destaque={destaque}
                        novasOs={new Set(novasOs)}
                        drill={drill}
                        onDrill={selecionarDrill}
                        onSelecionarOs={selecionarOs}
                        onInteracaoChange={onInteracaoCompras}
                        onAtualizar={carregar}
                      />
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
          {drill && !osDetalhe && isCicloAnoDrill(drill.id) ? (
            <SalaCicloAnoOverlay
              drill={drill}
              itens={cicloItens}
              investimento={cicloBucket?.investimento}
              onLimpar={limparDrill}
            />
          ) : null}
          {drill && recorteAtivo && dados && !mobile ? (
            <SalaRecorteOverlay
              drill={drill}
              demo={demoDrill}
              versao={dados.atualizadoEm}
              filtros={filtrosDrill}
              mobile={false}
              impedimentos={dados.programadas.impedimentos}
              onFiltros={setFiltrosDrill}
              onLimpar={limparDrill}
              onSelecionarOs={selecionarOs}
              onResolvido={onRecorteResolvido}
            />
          ) : null}
          {osSelecionada && detalheRemoto && !mobile ? (
            <SalaOsDetalheRemoto
              key={osSelecionada}
              numero={osSelecionada}
              cache={cacheOs}
              demo={demoDrill}
              mobile={false}
              foraDoRecorte={osForaDoRecorte}
              onVoltar={fecharOs}
              onFechar={limparDrill}
            />
          ) : null}
          {drill && !osDetalhe && !isCicloAnoDrill(drill.id) && !recorteAtivo ? (
            <SalaDrillOverlay
              drill={drill}
              linhas={drillLinhas}
              onLimpar={limparDrill}
              onSelecionarOs={selecionarOs}
            />
          ) : null}
          {osSelecionada && osDetalhe ? (
            <SalaOsDetalhePainel
              detalhe={osDetalhe}
              onVoltar={() => setOsSelecionada(null)}
              onFechar={() => {
                setOsSelecionada(null);
                setDrill(null);
              }}
            />
          ) : null}
          {osSelecionada && !osDetalhe && !detalheRemoto ? (
            <div className="sala-os-detalhe-overlay" role="dialog" aria-modal="true" aria-label={`OS ${osSelecionada}`}>
              <button
                type="button"
                className="sala-drill-backdrop"
                onClick={() => setOsSelecionada(null)}
                aria-label="Fechar"
              />
              <div className="sala-os-detalhe-sheet sala-os-detalhe-sheet-curto">
                <div className="sala-drill-sheet-cabecalho">
                  <div>
                    <span className="sala-drill-sheet-chip">detalhe da OS</span>
                    <div className="sala-numero sala-os-detalhe-numero">{osSelecionada}</div>
                    <p className="sala-vazio" style={{ marginTop: 8 }}>
                      Sem detalhe operacional no snapshot para esta OS.
                    </p>
                  </div>
                  <button type="button" className="sala-drill-limpar sala-drill-fechar" onClick={() => setOsSelecionada(null)}>
                    Fechar · Esc
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          <footer className="sala-rodape">
            {dados ? (
              <div className="sala-rodape-metricas">
                <span>hoje <b>{dados.agora.hojeAbertas}</b>↑ <b>{dados.agora.hojeFechadas}</b>↓</span>
                <span>semana <b>{dados.agora.semanaAbertas}</b>↑ <b>{dados.agora.semanaFechadas}</b>↓</span>
                <span>1º at. 30d <b>{dados.agora.primeiroNoPrazo30d == null ? "—" : `${dados.agora.primeiroNoPrazo30d}%`}</b></span>
                <span>TMEF 30d <b>{dados.agora.tpm30d == null ? "—" : `${dados.agora.tpm30d}h`}</b></span>
                <span>críticos <b>{dados.agora.disponibilidadeCriticos == null ? "—" : `${dados.agora.disponibilidadeCriticos}%`}</b></span>
                <span>
                  {atualizadoHaMin == null ? "" : `atualizado há ${atualizadoHaMin} min`}
                  {erro ? ` · sem conexão (${erro})` : ""}
                </span>
              </div>
            ) : (
              <span>sala</span>
            )}
            <div className="sala-rodape-acoes">
              <button
                type="button"
                className={somLigado && somPronto ? "sala-rodape-btn" : "sala-rodape-btn mudo"}
                onPointerDown={(evento) => evento.stopPropagation()}
                onClick={() => void alternarSom()}
                aria-pressed={somLigado && somPronto}
                title={somLigado && somPronto ? "Silenciar alertas de nova OS" : "Ativar som de nova OS"}
              >
                {somLigado && somPronto ? <Volume2 size={20} strokeWidth={2.2} aria-hidden /> : <VolumeX size={20} strokeWidth={2.2} aria-hidden />}
                {somLigado && somPronto ? "Som ligado" : "Som: toque para ativar alertas de nova OS"}
              </button>
              {telaFixa ? null : (
                <button
                  type="button"
                  className="sala-rodape-btn"
                  onClick={() => {
                    if (pausado) {
                      setOsSelecionada(null);
                      setDrill(null);
                      setInteracaoCompras(false);
                      setPausadoManual(false);
                    } else {
                      setPausadoManual(true);
                    }
                  }}
                >
                  {pausado ? "continuar" : "pausar"} · próxima: {proximaLabel} em 0:{String(restante).padStart(2, "0")}
                </button>
              )}
            </div>
            <div className="sala-rodape-progresso" aria-hidden>
              <i style={{ width: `${(telaFixa ? 0 : progresso) * 100}%` }} />
            </div>
          </footer>
          </div>
        </div>
      </div>
      {mobile && drill && recorteAtivo && dados ? (
        <SalaRecorteOverlay
          drill={drill}
          demo={demoDrill}
          versao={dados.atualizadoEm}
          filtros={filtrosDrill}
          mobile
          impedimentos={dados.programadas.impedimentos}
          onFiltros={setFiltrosDrill}
          onLimpar={limparDrill}
          onSelecionarOs={selecionarOs}
          onResolvido={onRecorteResolvido}
        />
      ) : null}
      {mobile && osSelecionada && detalheRemoto ? (
        <SalaOsDetalheRemoto
          key={osSelecionada}
          numero={osSelecionada}
          cache={cacheOs}
          demo={demoDrill}
          mobile
          foraDoRecorte={osForaDoRecorte}
          onVoltar={fecharOs}
          onFechar={limparDrill}
        />
      ) : null}
    </div>
  );
}

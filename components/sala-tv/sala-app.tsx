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
import { desbloquearSomTv, SALA_SOM_STORAGE, tocarChimeNovaOs } from "@/components/sala-tv/som-nova-os";
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
}: {
  tela: TelaSala;
  relogio: string;
  drill: SalaDrillSelecao | null;
  drillContagem?: number;
  onLimparDrill?: () => void;
}) {
  const atual = TELAS_SALA.find((item) => item.id === tela) ?? TELAS_SALA[0];
  return (
    <header className="sala-cabecalho">
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
            {drillContagem != null ? ` · ${drillContagem}` : ""}
          </span>
          <button type="button" className="sala-drill-limpar" onClick={onLimparDrill}>
            Limpar
          </button>
        </div>
      ) : null}
      <nav className="sala-pills" aria-label="Telas">
        {TELAS_SALA.map((item) => (
          <a key={item.id} className={item.id === tela ? "sala-pill ativa" : "sala-pill"} href={`/sala/${item.id}`}>
            {item.label}
          </a>
        ))}
      </nav>
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

function CampoDetalhe({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="sala-os-campo">
      <span className="sala-os-campo-rotulo">{rotulo}</span>
      <span className="sala-os-campo-valor">{valor || "—"}</span>
    </div>
  );
}

function SalaOsDetalhePainel({
  detalhe,
  onVoltar,
  onFechar,
}: {
  detalhe: OsDetalheSnapshot;
  onVoltar: () => void;
  onFechar: () => void;
}) {
  return (
    <div className="sala-os-detalhe-overlay" role="dialog" aria-modal="true" aria-label={`OS ${detalhe.os}`}>
      <button type="button" className="sala-drill-backdrop" onClick={onFechar} aria-label="Fechar detalhe da OS" />
      <div className="sala-os-detalhe-sheet">
        <div className="sala-drill-sheet-cabecalho">
          <div className="sala-drill-sheet-titulo">
            <span className="sala-drill-sheet-chip">detalhe da OS</span>
            <div className="sala-drill-sheet-heading">
              <div>
                <div className="sala-numero sala-os-detalhe-numero">{detalhe.os}</div>
                <div className="sala-os-detalhe-equip">{detalhe.equipamento}</div>
                <small className="sala-os-detalhe-meta">
                  {detalhe.tag} · {detalhe.setor}
                </small>
              </div>
            </div>
          </div>
          <div className="sala-os-detalhe-acoes">
            <button type="button" className="sala-drill-limpar" onClick={onVoltar}>
              Voltar
            </button>
            <button type="button" className="sala-drill-limpar sala-drill-fechar" onClick={onFechar}>
              Fechar · Esc
            </button>
          </div>
        </div>
        <div className="sala-os-detalhe-corpo">
          <div className="sala-os-flags">
            {detalhe.manutencaoExterna ? (
              <span className="sala-os-flag externa">Manutenção externa / EXT</span>
            ) : null}
            {detalhe.pendenciaCompra ? (
              <span className="sala-os-flag compra">Pendência de compra</span>
            ) : null}
            {!detalhe.aberto ? <span className="sala-os-flag fechada">OS fechada</span> : null}
            <span className="sala-os-flag etapa">{detalhe.etapa}</span>
          </div>

          <section className="sala-os-secao">
            <h3 className="sala-os-secao-titulo">Solicitação</h3>
            <p className="sala-os-texto">{detalhe.solicitacao}</p>
            {detalhe.ocorrencia !== "—" && detalhe.ocorrencia !== detalhe.solicitacao ? (
              <p className="sala-os-texto secundario">
                <strong>Ocorrência:</strong> {detalhe.ocorrencia}
              </p>
            ) : null}
            {detalhe.observacaoOs !== "—" && detalhe.observacaoOs !== detalhe.solicitacao ? (
              <p className="sala-os-texto secundario">
                <strong>Observação:</strong> {detalhe.observacaoOs}
              </p>
            ) : null}
          </section>

          {(detalhe.pendencia !== "—" || detalhe.observacaoPendencia !== "—") && (
            <section className="sala-os-secao">
              <h3 className="sala-os-secao-titulo">Pendência</h3>
              <p className="sala-os-texto">{detalhe.pendencia}</p>
              {detalhe.observacaoPendencia !== "—" ? (
                <p className="sala-os-texto secundario">{detalhe.observacaoPendencia}</p>
              ) : null}
            </section>
          )}

          {detalhe.manutencaoExterna ? (
            <section className="sala-os-secao">
              <h3 className="sala-os-secao-titulo">Reparo externo / assistência</h3>
              <p className="sala-os-texto">{detalhe.assistencia !== "—" ? detalhe.assistencia : "Indicada na OS (EXT / assistência)."}</p>
            </section>
          ) : null}

          <div className="sala-os-grade">
            <CampoDetalhe rotulo="Abertura" valor={detalhe.abertura} />
            <CampoDetalhe rotulo="1º atendimento" valor={detalhe.primeiroAtendimento} />
            <CampoDetalhe rotulo="Situação" valor={detalhe.situacaoOs} />
            <CampoDetalhe rotulo="Criticidade" valor={detalhe.criticidade} />
            <CampoDetalhe rotulo="Responsável" valor={detalhe.responsavel} />
            <CampoDetalhe rotulo="Oficina" valor={detalhe.oficina} />
            <CampoDetalhe rotulo="Tag" valor={detalhe.tag} />
            <CampoDetalhe rotulo="Setor" valor={detalhe.setor} />
            <CampoDetalhe rotulo="Tipo" valor={detalhe.tipoManutencao} />
            <CampoDetalhe rotulo="Prioridade" valor={detalhe.prioridade} />
            <CampoDetalhe rotulo="Requisitante" valor={detalhe.requisitante} />
            <CampoDetalhe rotulo="Fechamento" valor={detalhe.fechamento} />
          </div>
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
  onDrill: (id: string, titulo: string) => void;
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
          <div className="sala-cartao sala-bloco-plano">
            <div className="sala-bloco-cabeca">
              <CalendarRange size={20} strokeWidth={2.2} aria-hidden />
              <div className="sala-rotulo-bloco">PLANO DO MÊS</div>
            </div>
            {dados.agora.plano.every((item) => item.faltam == null && item.percentual == null) ? (
              <p className="sala-vazio sala-vazio-compacto">{dados.agora.planoAviso}</p>
            ) : (
              <>
                <p className="sala-bloco-sub">{dados.agora.planoAviso}</p>
                <div className="sala-plano-lista">
                  {dados.agora.plano.map((item) => (
                    <div key={item.tipo} className="sala-plano-linha">
                      <strong>{item.tipo}</strong>
                      <span className="sala-numero">
                        {item.executados ?? "—"}/{item.previstos ?? "—"}
                        {item.faltam != null && item.faltam > 0 ? ` · faltam ${item.faltam}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
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

function TelaFluxo({ dados }: { dados: SalaSnapshot }) {
  return (
    <div className="sala-coluna" style={{ flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="sala-rotulo-bloco">ENTRARAM HOJE · {dados.fluxo.entraramHoje}</span>
        <span className="sala-rotulo-bloco">ENCERRADAS HOJE · {dados.fluxo.encerradasHoje}</span>
      </div>
      <div className="sala-etapas">
        {dados.fluxo.etapas.map((etapa) => (
          <div key={etapa.etapa} className="sala-etapa">
            <div style={{ fontSize: 16, fontWeight: 700, color: COR_ETAPA[etapa.etapa] ?? "#2C66AB" }}>{etapa.etapa}</div>
            <div className="sala-numero q">{etapa.quantidade}</div>
            <small style={{ color: "#4E6079" }}>mais antiga {etapa.maisAntiga}</small>
            {etapa.exemplos.map((exemplo) => (
              <div key={exemplo} style={{ fontSize: 16, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{exemplo}</div>
            ))}
          </div>
        ))}
      </div>
      <div className="sala-cartao" style={{ flex: 1 }}>
        <div className="sala-rotulo-bloco">ENTRARAM HOJE · PRECISAM DE ATENDIMENTO</div>
        {dados.fluxo.entraram.length === 0 ? <p className="sala-vazio">Nenhuma OS aberta hoje neste recorte.</p> : null}
        {dados.fluxo.entraram.map((item) => (
          <div key={item.os} className="sala-linha" style={{ marginTop: 8 }}>
            <span className="sala-numero" style={{ fontSize: 24 }}>{item.hora}</span>
            <div>
              <strong>{item.equipamento}</strong>
              <small>{item.os} · {item.setor}</small>
            </div>
            <small>{item.prioridade}</small>
            <Selo situacao={item.situacao} />
          </div>
        ))}
        {dados.fluxo.entraramOcultas > 0 ? <p className="sala-vazio">+ {dados.fluxo.entraramOcultas}</p> : null}
      </div>
      <div className="sala-aviso">{dados.fluxo.equipeAviso}</div>
    </div>
  );
}

function TelaEnvelhecimento({ dados }: { dados: SalaSnapshot }) {
  const maximo = Math.max(1, ...dados.envelhecimento.faixas.map((faixa) => faixa.total));
  return (
    <div className="sala-coluna" style={{ flex: 1 }}>
      <p style={{ margin: 0, fontSize: 16, color: "#4E6079" }}>{dados.envelhecimento.proxy}</p>
      <div className="sala-kpis">
        {[
          ["IDADE MÉDIA", dados.envelhecimento.idadeMediaDias == null ? "—" : `${dados.envelhecimento.idadeMediaDias}d`],
          ["AGUARDANDO TERCEIROS", dados.envelhecimento.aguardandoTerceiros],
          ["SEM MOVIMENTO > 7 DIAS", dados.envelhecimento.semMovimentoMais7 == null ? "—" : dados.envelhecimento.semMovimentoMais7],
          ["PENDENTES SEM MOTIVO", dados.envelhecimento.pendenciaSemMotivo],
        ].map(([rotulo, valor]) => (
          <div key={String(rotulo)} className="sala-cartao">
            <div className="sala-rotulo-bloco">{rotulo}</div>
            <div className="sala-numero" style={{ fontSize: 48 }}>{valor}</div>
          </div>
        ))}
      </div>
      <div className="sala-cartao">
        <div className="sala-rotulo-bloco">IDADE DAS OS ABERTAS</div>
        {dados.envelhecimento.faixas.map((faixa) => (
          <div key={faixa.id} style={{ display: "grid", gridTemplateColumns: "160px 1fr 70px", gap: 12, alignItems: "center", marginTop: 10 }}>
            <span>{faixa.label}</span>
            <div style={{ display: "flex", height: 22, background: "#E3EAF3", borderRadius: 6, overflow: "hidden" }}>
              {faixa.partes.map((parte) => (
                <div
                  key={parte.etapa}
                  title={parte.etapa}
                  style={{ width: `${(parte.quantidade / maximo) * 100}%`, background: COR_ETAPA[parte.etapa] ?? "#2C66AB" }}
                />
              ))}
            </div>
            <b className="sala-numero" style={{ fontSize: 22 }}>{faixa.total}</b>
          </div>
        ))}
      </div>
      <div className="sala-cartao" style={{ flex: 1 }}>
        <div className="sala-rotulo-bloco">AS MAIS ANTIGAS · PROXY DE MOVIMENTO</div>
        {dados.envelhecimento.maisAntigas.map((item) => (
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

function TelaCiclo({ dados }: { dados: SalaSnapshot }) {
  const ciclo = dados.ciclo;
  const previsao = ciclo.previsaoEol;
  const maxPrevisao = Math.max(1, ...previsao.map((item) => item.quantidade));
  const maximoIdade = Math.max(1, ...ciclo.histograma.map((faixa) => faixa.emVida + faixa.alem));
  const proximoAno = previsao[0];
  const vencem10 = ciclo.vencem10Anos ?? previsao.reduce((s, i) => s + i.quantidade, 0);

  return (
    <div className="sala-ciclo">
      <section className="sala-ciclo-hero" aria-label="Horizonte de 10 anos">
        <div className="sala-ciclo-hero-topo">
          <div className="sala-ciclo-hero-titulo">
            <div className="sala-bloco-cabeca">
              <CalendarRange size={22} strokeWidth={2.2} aria-hidden className="sala-ciclo-icone" />
              <div className="sala-rotulo-bloco">HORIZONTE · 10 ANOS</div>
            </div>
            <p className="sala-ciclo-hero-sub">
              Equipamentos ativos com EndOfLife no próximo ano e nos nove seguintes.
            </p>
          </div>
          <div className="sala-ciclo-resumo">
            <div className="sala-ciclo-kpi">
              <span className="sala-ciclo-kpi-rotulo">próximo ano</span>
              <span className="sala-numero sala-ciclo-kpi-valor destaque">
                {proximoAno?.quantidade ?? 0}
              </span>
              <span className="sala-ciclo-kpi-ano">{proximoAno?.ano ?? "—"}</span>
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

        <div className="sala-ciclo-barras" role="img" aria-label="Previsão de fim de vida por ano">
          {previsao.map((item, index) => {
            const urgencia = index < 3;
            const altura = item.quantidade
              ? Math.max(12, Math.round((item.quantidade / maxPrevisao) * 100))
              : 4;
            return (
              <div
                key={item.ano}
                className={`sala-ciclo-barra-col${urgencia ? " urgente" : ""}${item.quantidade ? "" : " vazia"}`}
                style={
                  {
                    "--atraso": `${index * 45}ms`,
                    "--altura": `${altura}%`,
                  } as CSSProperties
                }
              >
                <span className="sala-numero sala-ciclo-barra-qtd">
                  {item.quantidade || "·"}
                </span>
                <div className="sala-ciclo-barra-trilho">
                  <div className="sala-ciclo-barra-fill" />
                </div>
                <span className="sala-ciclo-barra-ano">{item.ano}</span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="sala-ciclo-secundario">
        <section className="sala-cartao sala-ciclo-lista" aria-label="Fim de vida próximo">
          <div className="sala-ciclo-lista-cabeca">
            <div className="sala-bloco-cabeca">
              <Hourglass size={20} strokeWidth={2.2} aria-hidden />
              <div className="sala-rotulo-bloco">FIM DE VIDA PRÓXIMO · {ciclo.quantidadeFimDeVida}</div>
            </div>
            <div className="sala-ciclo-valor-sub">
              <Replace size={18} strokeWidth={2.2} aria-hidden />
              <div>
                <div className="sala-ciclo-valor-rotulo">VALOR SUBSTITUIÇÃO</div>
                <div className="sala-numero sala-ciclo-valor-numero">{ciclo.valorSubstituicaoFimDeVida}</div>
              </div>
            </div>
          </div>
          {ciclo.fimDeVida.length === 0 ? (
            <p className="sala-vazio">Nenhum equipamento ativo bateu os critérios.</p>
          ) : (
            <div className="sala-ciclo-lista-itens">
              {ciclo.fimDeVida.map((item) => (
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

function TelaProgramadas({ dados }: { dados: SalaSnapshot }) {
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
          <span style={{ fontSize: 18, color: "#DCE8F7" }}>
            {p.impedimentos.length} impedimento(s) à parte
          </span>
        </div>
        {p.porTipo.map((tipo) => (
          <div key={tipo.tipo} className="sala-cartao">
            <div className="sala-rotulo-bloco">{tipo.tipo.toUpperCase()}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span className="sala-numero" style={{ fontSize: 48 }}>
                {tipo.executados}
                <span style={{ fontSize: 24, color: "#4E6079" }}>/{tipo.previstos}</span>
              </span>
              <span style={{ fontSize: 20, fontWeight: 600, color: tipo.faltam ? "#A8460A" : "#3E7A1E" }}>
                {tipo.faltam ? `faltam ${tipo.faltam}` : "ok"}
              </span>
            </div>
            <div style={{ height: 10, borderRadius: 6, background: "#E3EAF3", overflow: "hidden", marginTop: 8 }}>
              <div
                style={{
                  height: 10,
                  borderRadius: 6,
                  background: "#2C66AB",
                  width: `${tipo.percentual ?? 0}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="sala-grid-2" style={{ flex: 1, minHeight: 0 }}>
        <div className="sala-cartao" style={{ overflow: "hidden" }}>
          <div className="sala-rotulo-bloco">PENDENTES NO MÊS · {p.pendentes.length}</div>
          {p.pendentes.length === 0 ? <p className="sala-vazio">{p.aviso}</p> : null}
          {p.pendentes.map((item) => (
            <div
              key={`${item.tipo}-${item.tag}-${item.equipamento}`}
              style={{
                display: "grid",
                gridTemplateColumns: "90px minmax(0, 1fr)",
                gap: 12,
                alignItems: "center",
                padding: "10px 0",
                borderBottom: "1px solid #E6ECF3",
              }}
            >
              <strong style={{ color: "#2C66AB", fontSize: 16 }}>{item.tipo}</strong>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.equipamento}
                </div>
                <div style={{ fontSize: 16, color: "#4E6079" }}>{item.setor}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="sala-cartao" style={{ overflow: "hidden" }}>
          <div className="sala-rotulo-bloco">IMPEDIMENTOS · {p.impedimentos.length}</div>
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

function TelaProcessos({ dados }: { dados: SalaSnapshot }) {
  return (
    <div className="sala-grid-2" style={{ flex: 1 }}>
      <div className="sala-cards" style={{ gridTemplateColumns: "1fr 1fr 1fr", alignContent: "start" }}>
        {dados.processos.itens.map((item) => (
          <div key={item.id} className="sala-cartao">
            <div className="sala-rotulo-bloco">{item.id} · {item.fonte.toUpperCase()}</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{item.nome}</div>
            <div className="sala-numero" style={{ fontSize: 48 }}>{item.quantidade}</div>
          </div>
        ))}
        <div className="sala-cartao" style={{ gridColumn: "1 / -1" }}>
          <div className="sala-rotulo-bloco">FORA DO HORÁRIO NESTE MÊS</div>
          <div className="sala-numero" style={{ fontSize: 56 }}>{dados.processos.foraDoHorario}</div>
          <p className="sala-vazio">OS abertas antes das 7h, depois das 17h, no fim de semana ou em feriado.</p>
        </div>
      </div>
      <div className="sala-coluna">
        <div className="sala-cartao" style={{ flex: 1, overflow: "hidden" }}>
          <div className="sala-rotulo-bloco">MELHORIAS DO ITEM 15</div>
          <p style={{ fontSize: 22, margin: "8px 0 12px" }}>{dados.processos.melhorias}</p>
          {dados.processos.melhoriasLista.length === 0 ? (
            <p className="sala-vazio">Opcional — cadastre em /sala/registros. P04–P07 não entram na TV.</p>
          ) : (
            <div style={{ overflow: "auto" }}>
              {dados.processos.melhoriasLista.map((item) => (
                <div
                  key={item.item}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                    padding: "10px 0",
                    borderBottom: "1px solid #E6ECF3",
                  }}
                >
                  <span style={{ fontSize: 22, fontWeight: 600 }}>{item.item}</span>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      letterSpacing: 1,
                      padding: "3px 8px",
                      borderRadius: 6,
                      background: item.status === "feito" ? "#F3F8EC" : item.status === "pendente" ? "#FFF6D6" : "#E8F0FA",
                      color: item.status === "feito" ? "#3E7A1E" : item.status === "pendente" ? "#5C4300" : "#1D4A80",
                      whiteSpace: "nowrap",
                      textTransform: "uppercase",
                    }}
                  >
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Linhas por página na TV 1920×1080 (cabeçalho + KPIs + banner). */
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
  onDrill: (id: string, titulo: string) => void;
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
  if (tela === "fluxo") return <TelaFluxo dados={dados} />;
  if (tela === "envelhecimento") return <TelaEnvelhecimento dados={dados} />;
  if (tela === "compras") {
    return (
      <TelaCompras dados={dados} onInteracaoChange={onInteracaoChange} onAtualizar={onAtualizar} />
    );
  }
  if (tela === "programadas") return <TelaProgramadas dados={dados} />;
  if (tela === "ciclo-de-vida") return <TelaCiclo dados={dados} />;
  if (tela === "indicadores") return <TelaIndicadores dados={dados} />;
  return <TelaProcessos dados={dados} />;
}

export function SalaApp({ telaFixa }: { telaFixa?: TelaSala }) {
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

  const limparDrill = useCallback(() => {
    setOsSelecionada(null);
    setDrill(null);
  }, []);

  const selecionarOs = useCallback((os: string) => {
    setOsSelecionada(os);
  }, []);

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
      const demo =
        typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1";
      const resposta = await fetch(demo ? "/api/sala/snapshot?demo=1" : "/api/sala/snapshot", {
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
    (id: string, titulo: string) => {
      setDrill((atual) => {
        if (atual?.id === id) return null;
        return { tela, id, titulo };
      });
    },
    [tela],
  );

  useEffect(() => {
    setOsSelecionada(null);
    setDrill(null);
    setInteracaoCompras(false);
  }, [tela]);

  useEffect(() => {
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        if (osSelecionada) {
          setOsSelecionada(null);
          return;
        }
        setDrill(null);
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [osSelecionada]);

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
  const drillLinhas = drill ? (dados?.detalhes?.[drill.id] ?? []) : [];
  const osDetalhe = osSelecionada ? (dados?.osDetalhes?.[osSelecionada] ?? null) : null;

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
            drillContagem={drill ? drillLinhas.length : undefined}
            onLimparDrill={limparDrill}
          />
          <div className="sala-miolo">
            {desatualizado ? <div className="sala-desatualizado">Dados desatualizados há {atualizadoHaMin} min</div> : null}
            <div className="sala-miolo-row">
              <div className="sala-miolo-main">
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
              </div>
            </div>
          </div>
          {drill && !osDetalhe ? (
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
          {osSelecionada && !osDetalhe ? (
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
    </div>
  );
}

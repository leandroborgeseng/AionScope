"use client";

import { useCallback, useEffect, useState } from "react";
import { JetBrains_Mono } from "next/font/google";
import {
  AlertOctagon,
  ClockAlert,
  Hand,
  PauseCircle,
  ShoppingCart,
  CalendarRange,
  Timer,
} from "lucide-react";
import {
  TELAS_SALA,
  type LinhaDrill,
  type LinhaDrillEquip,
  type LinhaDrillOs,
  type SalaDrillSelecao,
  type SalaSnapshot,
  type TelaSala,
} from "@/lib/ec/snapshot-tipos";
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
      <nav className="sala-pills" aria-label="Telas">
        {TELAS_SALA.map((item) => (
          <a key={item.id} className={item.id === tela ? "sala-pill ativa" : "sala-pill"} href={`/sala/${item.id}`}>
            {item.label}
          </a>
        ))}
      </nav>
      {drill ? (
        <div className="sala-drill-chip" role="status">
          <span className="sala-drill-chip-texto">
            selecionado: {drill.titulo}
            {drillContagem != null ? ` · ${drillContagem}` : ""}
          </span>
          <button type="button" className="sala-drill-limpar" onClick={onLimparDrill}>
            Limpar
          </button>
        </div>
      ) : null}
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
  denso,
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
  denso?: boolean;
}) {
  return (
    <div className={denso ? "sala-linha sala-linha-densa" : "sala-linha"} data-destaque={destaque ? "1" : undefined}>
      <div className="sala-linha-status">
        {situacao ? <Selo situacao={situacao} /> : <span className="sala-selo sala-selo-vazio">—</span>}
        <small className="sala-numero sala-linha-os">{os}</small>
      </div>
      <div className="sala-linha-equip">
        <strong>{equipamento}</strong>
        <small>
          {tag} · {setor}
        </small>
      </div>
      <MetaTags parado={parado} compra={compra} criticidade={criticidade} />
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
}: {
  equipamento: string;
  tag: string;
  setor: string;
  os?: string;
  tempo?: string;
}) {
  return (
    <div className="sala-linha sala-linha-equip-only">
      <div className="sala-linha-status">
        <span className="sala-meta-badge parado">
          <PauseCircle size={18} strokeWidth={2.4} aria-hidden />
          <span>PARADO</span>
        </span>
        {os ? <small className="sala-numero sala-linha-os">{os}</small> : null}
      </div>
      <div className="sala-linha-equip">
        <strong>{equipamento}</strong>
        <small>
          {tag} · {setor}
        </small>
      </div>
      <span className="sala-meta" />
      <span className="sala-numero sala-linha-idade">{tempo ?? "—"}</span>
    </div>
  );
}

function SalaDrillOverlay({
  drill,
  linhas,
  onLimpar,
}: {
  drill: SalaDrillSelecao;
  linhas: LinhaDrill[];
  onLimpar: () => void;
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

function TelaAgora({
  dados,
  destaque,
  drill,
  onDrill,
}: {
  dados: SalaSnapshot;
  destaque: string | null;
  drill: SalaDrillSelecao | null;
  onDrill: (id: string, titulo: string) => void;
}) {
  const formatarPct = (pct: number | null) =>
    pct == null ? "—" : `${pct.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%`;
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
                  <span
                    className="sala-contador-pct"
                    title={dados.agora.parque ? `% do parque (${dados.agora.parque} ativos)` : "% do parque indisponível"}
                  >
                    {formatarPct(item.pct)}
                  </span>
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
  const maximo = Math.max(1, ...dados.ciclo.histograma.map((faixa) => faixa.emVida + faixa.alem));
  const maxPrevisao = Math.max(1, ...dados.ciclo.previsaoEol.map((item) => item.quantidade));
  return (
    <div className="sala-coluna" style={{ flex: 1, minHeight: 0 }}>
      <div className="sala-etapas" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
        {dados.ciclo.trilha.map((item) => (
          <div key={item.etapa} className="sala-etapa">
            <div className="sala-rotulo-bloco">{item.etapa}</div>
            <div className="sala-numero q">{item.quantidade == null ? "—" : item.quantidade}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 1fr 1.2fr",
          gap: 16,
          flex: 1,
          minHeight: 0,
        }}
      >
        <div className="sala-cartao" style={{ overflow: "hidden" }}>
          <div className="sala-rotulo-bloco">IDADE DO PARQUE</div>
          {dados.ciclo.histograma.map((faixa) => (
            <div
              key={faixa.faixa}
              style={{ display: "grid", gridTemplateColumns: "120px 1fr 64px", gap: 8, alignItems: "center", marginTop: 8 }}
            >
              <span style={{ fontSize: 18 }}>{faixa.faixa}</span>
              <div style={{ display: "flex", height: 16, background: "#E3EAF3", borderRadius: 6, overflow: "hidden" }}>
                <div style={{ width: `${(faixa.emVida / maximo) * 100}%`, background: "#2C66AB" }} />
                <div style={{ width: `${(faixa.alem / maximo) * 100}%`, background: "#D9620F" }} />
              </div>
              <b className="sala-numero" style={{ fontSize: 18 }}>{faixa.emVida + faixa.alem}</b>
            </div>
          ))}
          <p className="sala-vazio" style={{ marginTop: 10 }}>
            Laranja: passou do EndOfLife (Anvisa).
          </p>
        </div>

        <div className="sala-cartao" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div className="sala-rotulo-bloco">FIM DE VIDA · PRÓXIMOS 5 ANOS</div>
          <div style={{ display: "flex", gap: 16, margin: "8px 0 12px" }}>
            <div>
              <div style={{ fontSize: 16, color: "#4E6079" }}>em ciclo</div>
              <div className="sala-numero" style={{ fontSize: 40, color: "#2C66AB" }}>{dados.ciclo.emCiclo}</div>
            </div>
            <div>
              <div style={{ fontSize: 16, color: "#4E6079" }}>vencem em 5 anos</div>
              <div className="sala-numero" style={{ fontSize: 40, color: "#A8460A" }}>{dados.ciclo.vencem5Anos}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flex: 1, minHeight: 160 }}>
            {dados.ciclo.previsaoEol.map((item) => (
              <div key={item.ano} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
                <span className="sala-numero" style={{ fontSize: 18 }}>{item.quantidade}</span>
                <div
                  style={{
                    width: "100%",
                    maxWidth: 48,
                    height: `${Math.max(8, (item.quantidade / maxPrevisao) * 120)}px`,
                    background: item.quantidade ? "#A8460A" : "#E3EAF3",
                    borderRadius: "8px 8px 4px 4px",
                  }}
                />
                <span style={{ fontSize: 16, fontWeight: 600, color: "#4E6079" }}>{item.ano}</span>
              </div>
            ))}
          </div>
          <p className="sala-vazio" style={{ marginTop: 8 }}>
            Quantidade por ano de EndOfLife. Em ciclo = ativos ainda antes do fim de vida.
          </p>
        </div>

        <div className="sala-cartao sala-coluna" style={{ overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
            <div className="sala-rotulo-bloco">FIM DE VIDA · {dados.ciclo.quantidadeFimDeVida}</div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 14, color: "#4E6079", letterSpacing: 1, fontWeight: 700 }}>VALOR SUBSTITUIÇÃO</div>
              <div className="sala-numero" style={{ fontSize: 28, color: "#A3123A" }}>
                {dados.ciclo.valorSubstituicaoFimDeVida}
              </div>
            </div>
          </div>
          <p className="sala-vazio" style={{ margin: "4px 0 8px" }}>{dados.ciclo.avisoDescontinuado}</p>
          {dados.ciclo.fimDeVida.length === 0 ? (
            <p className="sala-vazio">Nenhum equipamento ativo bateu os critérios.</p>
          ) : null}
          <div style={{ overflow: "auto", flex: 1 }}>
            {dados.ciclo.fimDeVida.map((item) => (
              <div
                key={item.tag}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) 110px 40px",
                  gap: 10,
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: "1px solid #E6ECF3",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: 20 }}>{item.equipamento}</strong>
                  <small style={{ display: "block", color: "#4E6079", fontSize: 15 }}>
                    {item.tag} · {item.criterios}
                  </small>
                </div>
                <span className="sala-numero" style={{ fontSize: 18, textAlign: "right" }}>
                  {item.valorSubstituicao}
                </span>
                <span className="sala-numero" style={{ fontSize: 24, textAlign: "right" }}>{item.pontos}</span>
              </div>
            ))}
          </div>
        </div>
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
  "110px 120px minmax(0,1.2fr) 88px 88px 100px 90px 64px 140px 128px";

function tomSituacaoCompras(situacao: string) {
  if (situacao.includes("cobrar")) return "#A3123A";
  if (situacao.includes("aguarda resposta")) return "#8A5A00";
  if (situacao.includes("aguarda entrega")) return "#2C66AB";
  return "#3E7A1E";
}

function TelaCompras({
  dados,
  onInteragir,
  onAtualizar,
}: {
  dados: SalaSnapshot;
  onInteragir?: () => void;
  onAtualizar?: () => void | Promise<void>;
}) {
  const c = dados.compras;
  const [pagina, setPagina] = useState(0);
  const [ocultas, setOcultas] = useState<string[]>([]);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [erroEntrega, setErroEntrega] = useState<string | null>(null);

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

  const tocar = () => onInteragir?.();

  const marcarEntregue = async (numeroOrdem: string) => {
    tocar();
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
    tocar();
    if (confirmando === numeroOrdem) {
      void marcarEntregue(numeroOrdem);
      return;
    }
    setConfirmando(numeroOrdem);
  };

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
            Marque entrega nesta TV (dois toques) ou edite OS/categoria em{" "}
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
                    <span className="sala-numero" style={{ fontSize: 17 }}>{pedido.numeroOs}</span>
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
                        disabled={Boolean(busy)}
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
                  onClick={() => {
                    tocar();
                    setPagina((atual) => Math.max(0, atual - 1));
                  }}
                >
                  ← Anterior
                </button>
                <span style={{ fontSize: 18, color: "#4E6079", fontWeight: 600 }}>
                  página {paginaAtual + 1}/{totalPaginas} · {pedidosVisiveis.length} abertas
                </span>
                <button
                  type="button"
                  disabled={paginaAtual >= totalPaginas - 1}
                  onClick={() => {
                    tocar();
                    setPagina((atual) => Math.min(totalPaginas - 1, atual + 1));
                  }}
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
  drill,
  onDrill,
  onInteragir,
  onAtualizar,
}: {
  tela: TelaSala;
  dados: SalaSnapshot;
  destaque: string | null;
  drill: SalaDrillSelecao | null;
  onDrill: (id: string, titulo: string) => void;
  onInteragir?: () => void;
  onAtualizar?: () => void | Promise<void>;
}) {
  if (tela === "agora") return <TelaAgora dados={dados} destaque={destaque} drill={drill} onDrill={onDrill} />;
  if (tela === "fluxo") return <TelaFluxo dados={dados} />;
  if (tela === "envelhecimento") return <TelaEnvelhecimento dados={dados} />;
  if (tela === "compras") {
    return <TelaCompras dados={dados} onInteragir={onInteragir} onAtualizar={onAtualizar} />;
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
  const [pausado, setPausado] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [destaque, setDestaque] = useState<string | null>(null);
  /** Drill-down Fase 1 (Agora): docs/sala/drill-down-tv.md */
  const [drill, setDrill] = useState<SalaDrillSelecao | null>(null);
  const [escala, setEscala] = useState(1);
  const [deslocamento, setDeslocamento] = useState(0);
  const [relogio, setRelogio] = useState("—");

  const limparDrill = useCallback(() => setDrill(null), []);

  const carregar = useCallback(async () => {
    try {
      const resposta = await fetch("/api/sala/snapshot", { cache: "no-store" });
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      const json = (await resposta.json()) as SalaSnapshot;
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
    const tick = () => {
      setRelogio(
        new Intl.DateTimeFormat("pt-BR", {
          timeZone: "America/Sao_Paulo",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).format(new Date()),
      );
    };
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

  const selecionarDrill = useCallback(
    (id: string, titulo: string) => {
      setPausado(true);
      setDrill((atual) => {
        if (atual?.id === id) return null;
        return { tela, id, titulo };
      });
    },
    [tela],
  );

  useEffect(() => {
    setDrill(null);
  }, [tela]);

  useEffect(() => {
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        setDrill(null);
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

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
        setDrill(null);
        setIndice((atual) => atual + 1);
      }
      if (evento.key === "ArrowLeft") {
        setDrill(null);
        setIndice((atual) => (atual + sequencia.length - 1) % sequencia.length);
      }
      if (evento.key === " ") {
        evento.preventDefault();
        setPausado((atual) => !atual);
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [sequencia.length, telaFixa]);

  const atualizadoHaMin = dados ? Math.max(0, Math.round((Date.now() - new Date(dados.atualizadoEm).getTime()) / 60_000)) : null;
  const desatualizado = atualizadoHaMin != null && atualizadoHaMin >= 20;
  const proxima = sequencia[(indice + 1) % sequencia.length];
  const proximaLabel = TELAS_SALA.find((item) => item.id === proxima)?.label ?? proxima;
  const restante = Math.max(0, Math.ceil((1 - progresso) * segundos));
  const drillLinhas = drill ? (dados?.detalhes?.[drill.id] ?? []) : [];

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
                    drill={drill}
                    onDrill={selecionarDrill}
                    onInteragir={() => setPausado(true)}
                    onAtualizar={carregar}
                  />
                ) : null}
              </div>
            </div>
          </div>
          {drill ? <SalaDrillOverlay drill={drill} linhas={drillLinhas} onLimpar={limparDrill} /> : null}
          <footer className="sala-rodape">
            {dados ? (
              <>
                <span>hoje <b>{dados.agora.hojeAbertas}</b>↑ <b>{dados.agora.hojeFechadas}</b>↓</span>
                <span>semana <b>{dados.agora.semanaAbertas}</b>↑ <b>{dados.agora.semanaFechadas}</b>↓</span>
                <span>1º at. 30d <b>{dados.agora.primeiroNoPrazo30d == null ? "—" : `${dados.agora.primeiroNoPrazo30d}%`}</b></span>
                <span>TMEF 30d <b>{dados.agora.tpm30d == null ? "—" : `${dados.agora.tpm30d}h`}</b></span>
                <span>críticos <b>{dados.agora.disponibilidadeCriticos == null ? "—" : `${dados.agora.disponibilidadeCriticos}%`}</b></span>
                <span style={{ marginLeft: "auto" }}>
                  {atualizadoHaMin == null ? "" : `atualizado há ${atualizadoHaMin} min`}
                  {erro ? ` · sem conexão desde agora (${erro})` : ""}
                </span>
              </>
            ) : <span>sala</span>}
            {telaFixa ? null : (
              <button type="button" onClick={() => setPausado((atual) => !atual)} style={{ minHeight: 44, marginLeft: 12 }}>
                {pausado ? "continuar" : "pausar"} · próxima: {proximaLabel} em 0:{String(restante).padStart(2, "0")}
              </button>
            )}
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 8, background: "#E3EAF3" }}>
              <div style={{ width: `${(telaFixa ? 0 : progresso) * 100}%`, height: 8, background: "#2C66AB" }} />
            </div>
          </footer>
          </div>
        </div>
      </div>
    </div>
  );
}

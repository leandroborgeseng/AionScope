"use client";

import { useCallback, useEffect, useState } from "react";
import { JetBrains_Mono } from "next/font/google";
import { TELAS_SALA, type SalaSnapshot, type TelaSala } from "@/lib/ec/snapshot-tipos";
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

function selo(situacao: string) {
  return SELO[situacao] ?? SELO["NO PRAZO"];
}

function Cabecalho({ tela, relogio }: { tela: TelaSala; relogio: string }) {
  const atual = TELAS_SALA.find((item) => item.id === tela) ?? TELAS_SALA[0];
  return (
    <header className="sala-cabecalho">
      <img src="/aion-logo.png" alt="Aion" />
      <div className="sala-divisor" />
      <div>
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

function TelaAgora({ dados, destaque }: { dados: SalaSnapshot; destaque: string | null }) {
  const contadores = [
    ["ATRASO GRAVE", dados.agora.grave, "#A3123A", "#FDF1F4", "#E7A3B6"],
    ["FORA DO PRAZO", dados.agora.foraDoPrazo, "#A8460A", "#FFF6EE", "#F0BD8E"],
    ["SEM 1º ATENDIMENTO", dados.agora.semPrimeiro, "#8A5A00", "#FFFFFF", "#DCE4EE"],
    ["EQUIP. PARADOS", dados.agora.parados == null ? "—" : dados.agora.parados, "#2C66AB", "#FFFFFF", "#DCE4EE"],
  ] as const;
  return (
    <>
      <div className="sala-grid-2">
        <div className="sala-coluna">
          <div className={dados.plantao ? "sala-aviso" : "sala-cartao"}>{dados.plantaoTexto}</div>
          <div className="sala-contadores">
            {contadores.map(([rotulo, valor, cor, fundo, borda]) => (
              <div key={rotulo} className="sala-contador" style={{ background: fundo, border: `2px solid ${borda}`, color: cor }}>
                <span className="sala-rotulo-bloco" style={{ color: cor }}>{rotulo}</span>
                <span className="sala-numero">{valor}</span>
              </div>
            ))}
          </div>
          <div className="sala-cartao">
            <div className="sala-rotulo-bloco">PLANO DO MÊS</div>
            <p className="sala-vazio">{dados.agora.planoAviso}</p>
          </div>
          <div className="sala-cartao" style={{ flex: 1 }}>
            <div className="sala-rotulo-bloco">PARADOS HÁ MAIS TEMPO</div>
            {dados.agora.paradosMaisTempo.length === 0 ? (
              <p className="sala-vazio">{dados.agora.parados == null ? "Sem dados de disponibilidade." : "Nenhum equipamento parado no mês."}</p>
            ) : (
              dados.agora.paradosMaisTempo.map((item) => (
                <div key={item.nome} style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ fontSize: 22 }}>{item.nome}</strong>
                    <small style={{ display: "block", color: "#4E6079", fontSize: 18 }}>{item.setor}</small>
                  </div>
                  <span className="sala-numero" style={{ fontSize: 26 }}>{item.tempo}</span>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="sala-cartao sala-coluna">
          <div className="sala-rotulo-bloco">FILA DE AÇÃO</div>
          <div className="sala-fila">
            {dados.agora.fila.length === 0 ? <p className="sala-vazio">Nenhuma OS sem primeiro atendimento.</p> : null}
            {dados.agora.fila.map((item) => (
              <div
                key={item.os}
                className="sala-linha"
                style={destaque === item.os ? { outline: "3px solid #A3123A" } : undefined}
              >
                <div>
                  <Selo situacao={item.situacao} />
                  <small className="sala-numero">{item.os}</small>
                </div>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.equipamento}
                  </strong>
                  <small>{item.tag} · {item.setor}</small>
                </div>
                <div>
                  {item.parado ? <span className="tag-extra">PARADO</span> : null}
                  {item.compra ? <span className="tag-extra">COMPRA</span> : null}
                  <small>{item.criticidade}</small>
                </div>
                <span className="sala-numero" style={{ fontSize: 26 }}>{item.idade}</span>
              </div>
            ))}
            {dados.agora.filaOcultas > 0 ? <p className="sala-vazio">+ {dados.agora.filaOcultas}</p> : null}
          </div>
        </div>
      </div>
    </>
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
        <div className="sala-rotulo-bloco">AS MAIS ANTIGAS · DIAS SEM MOVIMENTAÇÃO NÃO VÊM NA API</div>
        {dados.envelhecimento.maisAntigas.map((item) => (
          <div key={item.os} className="sala-linha" style={{ marginTop: 8 }}>
            <span className="sala-numero" style={{ fontSize: 22 }}>{item.os}</span>
            <div>
              <strong>{item.equipamento}</strong>
              <small>{item.setor}</small>
            </div>
            <small>{item.etapa}</small>
            <span className="sala-numero" style={{ fontSize: 26 }}>{item.idade}</span>
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
  return (
    <div className="sala-coluna" style={{ flex: 1 }}>
      <div className="sala-etapas" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
        {dados.ciclo.trilha.map((item) => (
          <div key={item.etapa} className="sala-etapa">
            <div className="sala-rotulo-bloco">{item.etapa}</div>
            <div className="sala-numero q">{item.quantidade == null ? "—" : item.quantidade}</div>
          </div>
        ))}
      </div>
      <div className="sala-grid-2" style={{ flex: 1 }}>
        <div className="sala-cartao">
          <div className="sala-rotulo-bloco">IDADE DO PARQUE</div>
          {dados.ciclo.histograma.map((faixa) => (
            <div key={faixa.faixa} style={{ display: "grid", gridTemplateColumns: "150px 1fr 80px", gap: 10, alignItems: "center", marginTop: 10 }}>
              <span>{faixa.faixa}</span>
              <div style={{ display: "flex", height: 18, background: "#E3EAF3", borderRadius: 6, overflow: "hidden" }}>
                <div style={{ width: `${(faixa.emVida / maximo) * 100}%`, background: "#2C66AB" }} />
                <div style={{ width: `${(faixa.alem / maximo) * 100}%`, background: "#D9620F" }} />
              </div>
              <b className="sala-numero" style={{ fontSize: 20 }}>{faixa.emVida + faixa.alem}</b>
            </div>
          ))}
          <p className="sala-vazio">Laranja: já passou do fim de vida registrado na Anvisa. {dados.ciclo.avisoDescontinuado}</p>
        </div>
        <div className="sala-cartao sala-coluna">
          <div className="sala-rotulo-bloco">FIM DE VIDA · 3 CRITÉRIOS COM DADO</div>
          {dados.ciclo.fimDeVida.length === 0 ? <p className="sala-vazio">Nenhum equipamento ativo bateu os critérios.</p> : null}
          {dados.ciclo.fimDeVida.map((item) => (
            <div key={item.tag} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <strong>{item.equipamento}</strong>
                <small style={{ display: "block", color: "#4E6079" }}>{item.tag} · {item.criterios}</small>
              </div>
              <span className="sala-numero" style={{ fontSize: 28 }}>{item.pontos}</span>
            </div>
          ))}
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
  return (
    <div className="sala-grid-2" style={{ flex: 1 }}>
      <div className="sala-coluna">
        <div className="sala-cartao" style={{ flex: 1 }}>
          <div className="sala-rotulo-bloco">CUMPRIMENTO DO PLANO</div>
          <div className="sala-numero" style={{ fontSize: 72 }}>—</div>
          <p className="sala-vazio">{dados.programadas.aviso}</p>
        </div>
      </div>
      <div className="sala-cartao" style={{ flex: 1, overflow: "hidden" }}>
        <div className="sala-rotulo-bloco">
          IMPEDIMENTOS JUSTIFICADOS · {dados.programadas.impedimentos.length}
        </div>
        {dados.programadas.impedimentos.length === 0 ? (
          <p className="sala-vazio">Nenhum impedimento ativo. Cadastre em /sala/registros.</p>
        ) : (
          <div style={{ marginTop: 8, overflow: "auto" }}>
            {dados.programadas.impedimentos.map((item) => (
              <div
                key={`${item.tag}-${item.motivo}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "120px minmax(0, 1fr) 140px",
                  gap: 12,
                  alignItems: "center",
                  padding: "12px 0",
                  borderBottom: "1px solid #E6ECF3",
                }}
              >
                <strong style={{ color: "#2C66AB", fontSize: 20 }}>{item.tag}</strong>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 22, fontWeight: 600 }}>{item.equipamento}</div>
                  <div style={{ fontSize: 18, color: "#4E6079" }}>{item.motivo}</div>
                </div>
                <div style={{ textAlign: "right", fontSize: 18, color: "#6B1029" }}>
                  nova data
                  <div className="sala-numero" style={{ fontSize: 24 }}>{item.novaData}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TelaProcessos({ dados }: { dados: SalaSnapshot }) {
  return (
    <div className="sala-grid-2" style={{ flex: 1 }}>
      <div className="sala-cards" style={{ gridTemplateColumns: "1fr 1fr", alignContent: "start" }}>
        {dados.processos.itens.map((item) => (
          <div key={item.id} className="sala-cartao">
            <div className="sala-rotulo-bloco">{item.id} · {item.fonte.toUpperCase()}</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{item.nome}</div>
            <div className="sala-numero" style={{ fontSize: 48 }}>{item.quantidade}</div>
          </div>
        ))}
      </div>
      <div className="sala-coluna">
        <div className="sala-cartao">
          <div className="sala-rotulo-bloco">FORA DO HORÁRIO NESTE MÊS</div>
          <div className="sala-numero" style={{ fontSize: 72 }}>{dados.processos.foraDoHorario}</div>
          <p className="sala-vazio">OS do recorte abertas antes das 7h, depois das 17h, no fim de semana ou em feriado configurado.</p>
        </div>
        <div className="sala-cartao" style={{ flex: 1, overflow: "hidden" }}>
          <div className="sala-rotulo-bloco">MELHORIAS DO ITEM 15</div>
          <p style={{ fontSize: 22, margin: "8px 0 12px" }}>{dados.processos.melhorias}</p>
          {dados.processos.melhoriasLista.length === 0 ? (
            <p className="sala-vazio">Cadastre o status das melhorias em /sala/registros.</p>
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

function Conteudo({ tela, dados, destaque }: { tela: TelaSala; dados: SalaSnapshot; destaque: string | null }) {
  if (tela === "agora") return <TelaAgora dados={dados} destaque={destaque} />;
  if (tela === "fluxo") return <TelaFluxo dados={dados} />;
  if (tela === "envelhecimento") return <TelaEnvelhecimento dados={dados} />;
  if (tela === "compras") return <TelaAviso titulo="COMPRAS" texto={dados.compras.aviso} />;
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
  const [escala, setEscala] = useState(1);
  const [deslocamento, setDeslocamento] = useState(0);
  const [relogio, setRelogio] = useState("—");

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
    const timer = window.setInterval(() => setDeslocamento(new Date().getHours() % 2), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const sequencia = dados?.sequencia?.length ? dados.sequencia : TELAS_SALA.map((item) => item.id);
  const tela = telaFixa ?? sequencia[indice % sequencia.length] ?? "agora";
  const segundos = dados?.segundos || 30;

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
      if (evento.key === "ArrowRight") setIndice((atual) => atual + 1);
      if (evento.key === "ArrowLeft") setIndice((atual) => (atual + sequencia.length - 1) % sequencia.length);
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
          <Cabecalho tela={tela} relogio={relogio} />
          <div className="sala-miolo">
            {desatualizado ? <div className="sala-desatualizado">Dados desatualizados há {atualizadoHaMin} min</div> : null}
            {erro && !dados ? <p className="sala-vazio">Sem conexão com o snapshot ({erro}).</p> : null}
            {!dados && !erro ? <p className="sala-vazio">Carregando a sala…</p> : null}
            {dados ? <Conteudo tela={tela} dados={dados} destaque={destaque} /> : null}
          </div>
          <footer className="sala-rodape">
            {dados ? (
              <>
                <span>hoje <b>{dados.agora.hojeAbertas}</b>↑ <b>{dados.agora.hojeFechadas}</b>↓</span>
                <span>semana <b>{dados.agora.semanaAbertas}</b>↑ <b>{dados.agora.semanaFechadas}</b>↓</span>
                <span>1º at. 30d <b>{dados.agora.primeiroNoPrazo30d == null ? "—" : `${dados.agora.primeiroNoPrazo30d}%`}</b></span>
                <span>TPM 30d <b>—</b></span>
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

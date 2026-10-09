"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { History, Replace, Ticket } from "lucide-react";
import {
  CAMPO_CADASTRO_PARQUE,
  EVOLUCAO_CHAMADOS_REGRA,
  type EvolucaoHistorica,
} from "@/lib/pbi/evolucao-historica";

function moedaCurta(valor: number) {
  if (!Number.isFinite(valor) || valor <= 0) return "—";
  if (valor >= 1_000_000) {
    return `R$ ${(valor / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  }
  if (valor >= 1_000) {
    return `R$ ${(valor / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  }
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function moedaTooltip(valor: number) {
  if (!Number.isFinite(valor)) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

const GRID = "#E3EAF3";
const TICK = "#4E6079";
const AZUL = "#2C66AB";
const VERDE = "#3E7A1E";
const LARANJA = "#D9620F";

type ParqueRow = {
  ano: string;
  quantidade: number;
  valorSubstituicao: number;
  entrantes: number;
};

type ChamadoRow = {
  ano: string;
  quantidade: number;
};

export function TelaEvolucao() {
  const [dados, setDados] = useState<EvolucaoHistorica | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch("/api/sala/evolucao", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as EvolucaoHistorica;
        if (!cancel) {
          setDados(json);
          setErro(null);
        }
      } catch (e) {
        if (!cancel) setErro(e instanceof Error ? e.message : "Falha ao carregar evolução");
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const parqueChart: ParqueRow[] = useMemo(
    () =>
      (dados?.parque ?? []).map((item) => ({
        ano: String(item.ano),
        quantidade: item.quantidade,
        valorSubstituicao: item.valorSubstituicao,
        entrantes: item.entrantes,
      })),
    [dados],
  );

  const chamadosChart: ChamadoRow[] = useMemo(
    () =>
      (dados?.chamados ?? []).map((item) => ({
        ano: String(item.ano),
        quantidade: item.quantidade,
      })),
    [dados],
  );

  if (erro) {
    return (
      <div className="sala-evolucao">
        <p className="sala-vazio">Não foi possível carregar a evolução histórica: {erro}</p>
      </div>
    );
  }

  if (!dados) {
    return (
      <div className="sala-evolucao">
        <p className="sala-vazio">Carregando evolução do parque e dos chamados…</p>
      </div>
    );
  }

  const ultimo = dados.parque[dados.parque.length - 1];
  const picoChamados = Math.max(0, ...dados.chamados.map((c) => c.quantidade));

  return (
    <div className="sala-evolucao">
      <div className="sala-evolucao-topo">
        <div className="sala-evolucao-intro">
          <div className="sala-bloco-cabeca">
            <History size={20} strokeWidth={2.2} aria-hidden className="sala-evolucao-icone" />
            <div className="sala-rotulo-bloco">PARQUE · CADASTRO → HOJE</div>
          </div>
          <p className="sala-evolucao-sub">
            Ano inicial = menor {CAMPO_CADASTRO_PARQUE}
            {dados.anoInicio != null ? ` (${dados.anoInicio})` : ""}. Quantidade e valor são
            acumulados ao fim de cada ano (inativações saem do estoque). Valor = soma atual de
            ValorDeSubstituicao.
          </p>
        </div>
        <div className="sala-evolucao-kpis">
          <div className="sala-evolucao-kpi">
            <span className="sala-evolucao-kpi-rotulo">desde</span>
            <span className="sala-numero sala-evolucao-kpi-valor">{dados.anoInicio ?? "—"}</span>
          </div>
          <div className="sala-evolucao-kpi">
            <span className="sala-evolucao-kpi-rotulo">parque hoje</span>
            <span className="sala-numero sala-evolucao-kpi-valor azul">
              {ultimo?.quantidade?.toLocaleString("pt-BR") ?? "—"}
            </span>
          </div>
          <div className="sala-evolucao-kpi">
            <span className="sala-evolucao-kpi-rotulo">valor hoje</span>
            <span className="sala-numero sala-evolucao-kpi-valor destaque">
              {moedaCurta(ultimo?.valorSubstituicao ?? 0)}
            </span>
          </div>
          <div className="sala-evolucao-kpi">
            <span className="sala-evolucao-kpi-rotulo">chamados EC</span>
            <span className="sala-numero sala-evolucao-kpi-valor">
              {dados.chamadosTotal.toLocaleString("pt-BR")}
            </span>
          </div>
        </div>
      </div>

      <div className="sala-evolucao-graficos">
        <section className="sala-cartao sala-evolucao-painel" aria-label="Evolução do parque">
          <div className="sala-evolucao-painel-cabeca">
            <div className="sala-bloco-cabeca">
              <Replace size={18} strokeWidth={2.2} aria-hidden />
              <div className="sala-rotulo-bloco">EQUIPAMENTOS E VALOR DE SUBSTITUIÇÃO</div>
            </div>
            <span className="sala-evolucao-badge">{parqueChart.length} anos</span>
          </div>
          <div className="sala-evolucao-chart">
            {parqueChart.length === 0 ? (
              <p className="sala-vazio">Sem DataDeCadastro parseável nos equipamentos.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minHeight={280} debounce={1}>
                <ComposedChart data={parqueChart} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="ano" tick={{ fill: TICK, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis
                    yAxisId="qtd"
                    tick={{ fill: TICK, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                  />
                  <YAxis
                    yAxisId="valor"
                    orientation="right"
                    tick={{ fill: TICK, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={64}
                    tickFormatter={(v: number) => moedaCurta(v).replace("R$ ", "")}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#FFFFFF",
                      border: "1px solid #DCE4EE",
                      borderRadius: 10,
                      color: "#12233A",
                      boxShadow: "0 8px 24px rgba(18, 35, 58, 0.12)",
                    }}
                    formatter={(value, name) => {
                      const n = typeof value === "number" ? value : Number(value);
                      if (name === "Valor substituição") return [moedaTooltip(n), name];
                      return [n.toLocaleString("pt-BR"), String(name)];
                    }}
                    labelFormatter={(label) => `Ano ${label}`}
                  />
                  <Legend wrapperStyle={{ color: TICK, fontSize: 13 }} />
                  <Bar
                    yAxisId="qtd"
                    dataKey="quantidade"
                    name="Equipamentos"
                    fill={AZUL}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                    animationDuration={700}
                  />
                  <Line
                    yAxisId="valor"
                    type="monotone"
                    dataKey="valorSubstituicao"
                    name="Valor substituição"
                    stroke={VERDE}
                    strokeWidth={3}
                    dot={{ r: 3, fill: VERDE }}
                    animationDuration={900}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="sala-cartao sala-evolucao-painel" aria-label="Evolução de chamados EC">
          <div className="sala-evolucao-painel-cabeca">
            <div className="sala-bloco-cabeca">
              <Ticket size={18} strokeWidth={2.2} aria-hidden />
              <div className="sala-rotulo-bloco">CHAMADOS ENGENHARIA CLÍNICA / ANO</div>
            </div>
            <span className="sala-evolucao-badge">pico {picoChamados.toLocaleString("pt-BR")}</span>
          </div>
          <p className="sala-evolucao-chamados-regra" title={EVOLUCAO_CHAMADOS_REGRA.join(" · ")}>
            Recorte por TipoDeManutencao EC · ano da Abertura · período API: {dados.chamadosPeriodoApi}
          </p>
          <div className="sala-evolucao-chart sala-evolucao-chart-chamados">
            {chamadosChart.length === 0 ? (
              <p className="sala-vazio">Nenhum chamado EC no período disponível.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minHeight={240} debounce={1}>
                <ComposedChart data={chamadosChart} margin={{ top: 12, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="ano" tick={{ fill: TICK, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: TICK, fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip
                    contentStyle={{
                      background: "#FFFFFF",
                      border: "1px solid #DCE4EE",
                      borderRadius: 10,
                      color: "#12233A",
                      boxShadow: "0 8px 24px rgba(18, 35, 58, 0.12)",
                    }}
                    formatter={(value) => {
                      const n = typeof value === "number" ? value : Number(value);
                      return [n.toLocaleString("pt-BR"), "Chamados"];
                    }}
                    labelFormatter={(label) => `Ano ${label}`}
                  />
                  <Bar
                    dataKey="quantidade"
                    name="Chamados"
                    fill={LARANJA}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                    animationDuration={700}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      {dados.avisos.length > 0 ? (
        <p className="sala-evolucao-avisos">{dados.avisos.join(" · ")}</p>
      ) : null}
    </div>
  );
}

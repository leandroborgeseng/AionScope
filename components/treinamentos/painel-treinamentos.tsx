"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FileText, Search } from "lucide-react";
import { KpiCard } from "@/components/kpi/kpi-card";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/tables/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { META_RECICLAGEM_PCT } from "@/lib/treinamentos/calcular";
import type { PainelTreinamentos, ParticipanteTreinamento } from "@/lib/treinamentos/types";
import { cn } from "@/lib/utils";

const COR_ANTERIOR = "#9fb3bf";
const COR_ATUAL = "#0f7c8c";
const COR_NOVOS = "#d97706";
const COR_OK = "#2f7d4f";
const COR_ATENCAO = "#b5651d";
const COR_CRITICO = "#b23b3b";

function corFaixa(faixa: string) {
  if (faixa === "ok") return COR_OK;
  if (faixa === "atencao") return COR_ATENCAO;
  return COR_CRITICO;
}

function fmtPct(n: number) {
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function fmtNum(n: number) {
  return n.toLocaleString("pt-BR");
}

type EvidenciasUi = {
  tokenObrigatorio: boolean;
  anos: string[];
  liberado: boolean;
};

export function PainelTreinamentosView({
  painel,
  participantes,
  evidencias,
}: {
  painel: PainelTreinamentos;
  participantes: ParticipanteTreinamento[];
  evidencias: EvidenciasUi;
}) {
  const [anoFiltro, setAnoFiltro] = useState<number | "todos">("todos");
  const [setorFiltro, setSetorFiltro] = useState<string | "todos">("todos");
  const [reciclagemFiltro, setReciclagemFiltro] = useState<"todos" | "sim" | "nao" | "na">("todos");
  const [busca, setBusca] = useState("");
  const [buscaDeferred, setBuscaDeferred] = useState("");
  const [, startTransition] = useTransition();
  const [tokenInput, setTokenInput] = useState("");
  const [evidenciaMsg, setEvidenciaMsg] = useState<string | null>(null);
  const [desbloqueado, setDesbloqueado] = useState(evidencias.liberado);
  const [previewAno, setPreviewAno] = useState<string | null>(
    evidencias.liberado ? (evidencias.anos[0] ?? null) : null,
  );
  const [anosDisponiveis, setAnosDisponiveis] = useState(evidencias.anos);

  useEffect(() => {
    void atualizarStatusEvidencias();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- status só no mount
  }, []);

  const anosOpts = painel.anos.map((a) => a.ano);
  const setoresOpts = useMemo(() => {
    const set = new Set<string>();
    for (const p of participantes) {
      if (p.setor) set.add(p.setor);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [participantes]);

  const setoresFiltrados = useMemo(() => {
    if (setorFiltro === "todos") return painel.setores;
    return painel.setores.filter((s) => s.setor === setorFiltro);
  }, [painel.setores, setorFiltro]);

  const maxBarra = Math.max(
    1,
    ...setoresFiltrados.map((s) => Math.max(s.treinados_anterior, s.reciclados_atual + s.novos_atual)),
  );

  const composicao = [
    { name: `Já capacitados / recorrentes (${painel.reciclados_atual})`, value: painel.reciclados_atual },
    { name: `Novos capacitados (${painel.novos_atual})`, value: painel.novos_atual },
  ];

  const comparativo = painel.anos.map((a) => ({
    ano: String(a.ano),
    treinados: a.treinados,
    horas: a.horas_homem,
  }));

  const linhasTabela = useMemo(() => {
    const q = buscaDeferred.trim().toLowerCase();
    return participantes.filter((p) => {
      if (anoFiltro !== "todos" && p.ano !== anoFiltro) return false;
      if (setorFiltro !== "todos" && (p.setor ?? "") !== setorFiltro) return false;
      if (reciclagemFiltro === "sim" && p.reciclagem !== true) return false;
      if (reciclagemFiltro === "nao" && p.reciclagem !== false) return false;
      if (reciclagemFiltro === "na" && p.reciclagem != null) return false;
      if (q) {
        const mat = (p.matricula ?? "").toLowerCase();
        const nome = p.nome.toLowerCase();
        if (!mat.includes(q) && !nome.includes(q)) return false;
      }
      return true;
    });
  }, [participantes, anoFiltro, setorFiltro, reciclagemFiltro, buscaDeferred]);

  const colunas = useMemo<ColumnDef<ParticipanteTreinamento, unknown>[]>(
    () => [
      { accessorKey: "ano", header: "Ano" },
      {
        accessorKey: "periodo_original",
        header: "Data",
      },
      {
        accessorKey: "matricula",
        header: "Matrícula",
        cell: ({ getValue }) => (getValue() as string | null) ?? "—",
      },
      {
        accessorKey: "nome",
        header: "Nome",
        cell: ({ row }) => (
          <span className={cn(row.original.leitura_incerta && "rounded bg-amber-50 px-1 text-amber-900")}>
            {row.original.nome}
            {row.original.leitura_incerta ? (
              <Badge className="ml-2 border-amber-300 bg-amber-100 text-amber-900">leitura incerta</Badge>
            ) : null}
          </span>
        ),
      },
      {
        accessorKey: "setor",
        header: "Setor",
        cell: ({ getValue }) => (getValue() as string | null) ?? "—",
      },
      {
        accessorKey: "carga_min",
        header: "Carga (min)",
        cell: ({ row }) => {
          const v = row.original.carga_min;
          if (v == null) return <span title="estimado">20*</span>;
          return row.original.carga_estimada ? `${v}*` : String(v);
        },
      },
      {
        accessorKey: "reciclagem",
        header: "Reciclagem",
        cell: ({ getValue }) => {
          const v = getValue() as boolean | null;
          if (v === true) return "Sim";
          if (v === false) return "Não";
          return "—";
        },
      },
    ],
    [],
  );

  const aAnt = painel.anos.find((a) => a.ano === painel.ano_anterior);
  const aAtual = painel.anos.find((a) => a.ano === painel.ano_atual);

  async function atualizarStatusEvidencias() {
    const res = await fetch("/api/treinamentos/evidencias/status", { cache: "no-store" });
    if (!res.ok) return;
    const body = (await res.json()) as EvidenciasUi;
    setAnosDisponiveis(body.anos);
    setDesbloqueado(body.liberado);
    if (!previewAno && body.anos[0]) setPreviewAno(body.anos[0]);
  }

  async function desbloquearEvidencias() {
    setEvidenciaMsg(null);
    const res = await fetch("/api/treinamentos/evidencias/desbloquear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: tokenInput }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { erro?: string };
      setEvidenciaMsg(body.erro ?? "Falha ao desbloquear");
      setDesbloqueado(false);
      return;
    }
    setDesbloqueado(true);
    setEvidenciaMsg("Acesso liberado nesta sessão (8 h).");
    setTokenInput("");
    await atualizarStatusEvidencias();
    if (anosDisponiveis[0] || evidencias.anos[0]) {
      setPreviewAno(anosDisponiveis[0] ?? evidencias.anos[0] ?? null);
    }
  }

  function abrirLista(ano: string) {
    setPreviewAno(ano);
    window.open(`/api/treinamentos/evidencias/${ano}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Treinamento em bombas de infusão B. Braun"
        description="Hospital São Joaquim · Unimed Franca · Engenharia Clínica. Capacitação contínua e opcional: quem já domina o equipamento pode não participar — isso é maturidade, não atraso. 2025: listas manuscritas. 2026: Google Forms. Contagem por pessoa única."
      />

      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-aion-ink">
        <strong>Boa notícia, não regressão.</strong> O treinamento não é obrigatório. Se a pessoa não
        veio, em geral é porque <strong>já sabe o que precisa</strong> para operar a bomba. A base{" "}
        {painel.ano_anterior} permanece apta ({fmtNum(painel.aptos_sem_reforco)} sem necessidade de
        reforço). A turma {painel.ano_atual} soma{" "}
        <strong>{fmtNum(painel.reciclados_atual)} recorrentes</strong> (atualização) e{" "}
        <strong>{fmtNum(painel.novos_atual)} novos</strong>.
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-aion-line bg-white p-3">
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-aion-muted">
          Ano
          <select
            className="h-10 min-w-[120px] rounded-lg border border-aion-line bg-white px-3 text-sm text-aion-ink"
            value={anoFiltro === "todos" ? "todos" : String(anoFiltro)}
            onChange={(e) => setAnoFiltro(e.target.value === "todos" ? "todos" : Number(e.target.value))}
          >
            <option value="todos">Todos</option>
            {anosOpts.map((ano) => (
              <option key={ano} value={ano}>
                {ano}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-aion-muted">
          Setor
          <select
            className="h-10 min-w-[220px] rounded-lg border border-aion-line bg-white px-3 text-sm text-aion-ink"
            value={setorFiltro}
            onChange={(e) => setSetorFiltro(e.target.value)}
          >
            <option value="todos">Todos</option>
            {setoresOpts.map((setor) => (
              <option key={setor} value={setor}>
                {setor}
              </option>
            ))}
          </select>
        </label>
        <p className="max-w-xl text-xs leading-relaxed text-aion-muted">{painel.nota_setor}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard
          label={`Base capacitada ${painel.ano_anterior}`}
          value={fmtNum(aAnt?.treinados ?? 0)}
          hint={`Já treinados · ≈ ${fmtNum(aAnt?.horas_homem ?? 0)} h·homem${aAnt?.horas_homem_estimado ? " (est.)" : ""}`}
          tone="ok"
        />
        <KpiCard
          label="Já aptos (sem reforço)"
          value={fmtNum(painel.aptos_sem_reforco)}
          hint={`Da base ${painel.ano_anterior} · sabem operar, não precisaram repetir`}
          tone="ok"
        />
        <KpiCard
          label={`Turma ${painel.ano_atual}`}
          value={fmtNum(aAtual?.treinados ?? 0)}
          hint={`${fmtNum(painel.reciclados_atual)} recorrentes + ${fmtNum(painel.novos_atual)} novos`}
          tone="ok"
        />
        <KpiCard
          label="Atualização (recorrentes)"
          value={fmtPct(painel.taxa_reciclagem_geral_pct)}
          hint={`${fmtNum(painel.reciclados_atual)} voltaram para reforço · meta ${META_RECICLAGEM_PCT}%`}
          tone="ok"
        />
        <KpiCard
          label={`Novos capacitados ${painel.ano_atual}`}
          value={fmtNum(painel.novos_atual)}
          hint={`${fmtPct(painel.taxa_novos_pct)} da turma atual`}
          tone="ok"
        />
        <KpiCard
          label="Horas·homem"
          value={`${fmtNum(aAnt?.horas_homem ?? 0)} / ${fmtNum(aAtual?.horas_homem ?? 0)}`}
          hint={`${painel.ano_anterior} (base) / ${painel.ano_atual} (turma)`}
        />
      </div>

      <Card className="space-y-4 border-aion-blue/25 bg-aion-mist/40 p-4" id="evidencias">
        <div className="flex items-start gap-2">
          <FileText className="mt-0.5 h-5 w-5 shrink-0 text-aion-blue" />
          <div>
            <h2 className="text-lg font-semibold text-aion-ink">Listas de presença (PDF)</h2>
            <p className="text-sm text-aion-muted">
              Evidências originais 2025 (manuscritas) e 2026 (Google Forms). O PDF de 2026 contém CPF e
              e-mail — nomes não aparecem na TV.
            </p>
          </div>
        </div>

        {anosDisponiveis.length === 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Nenhum PDF no volume. Copie{" "}
            <code className="font-mono">2025_lista_presenca_bomba_infusao.pdf</code> e{" "}
            <code className="font-mono">2026_lista_presenca_bomba_infusao.pdf</code> para{" "}
            <code className="font-mono">treinamentos-evidencias</code> (ao lado do SQLite). Token
            opcional: <code className="font-mono">TREINAMENTOS_EVIDENCIAS_TOKEN</code>.
          </p>
        ) : (
          <>
            {evidencias.tokenObrigatorio && !desbloqueado ? (
              <div className="flex flex-wrap items-end gap-2">
                <Input
                  type="password"
                  className="w-64"
                  placeholder="Token de evidências"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void desbloquearEvidencias();
                  }}
                />
                <Button type="button" onClick={() => void desbloquearEvidencias()}>
                  Desbloquear listas
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {anosDisponiveis.map((ano) => (
                  <Button
                    key={ano}
                    type="button"
                    variant={previewAno === ano ? "default" : "outline"}
                    onClick={() => {
                      setPreviewAno(ano);
                      abrirLista(ano);
                    }}
                  >
                    Abrir lista {ano}
                  </Button>
                ))}
                {anosDisponiveis.map((ano) => (
                  <Button
                    key={`prev-${ano}`}
                    type="button"
                    variant="ghost"
                    onClick={() => setPreviewAno(ano)}
                  >
                    Pré-visualizar {ano}
                  </Button>
                ))}
                {evidencias.tokenObrigatorio ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={async () => {
                      await fetch("/api/treinamentos/evidencias/desbloquear", { method: "DELETE" });
                      setDesbloqueado(false);
                      setPreviewAno(null);
                    }}
                  >
                    Bloquear novamente
                  </Button>
                ) : null}
              </div>
            )}

            {desbloqueado && previewAno ? (
              <div className="overflow-hidden rounded-xl border border-aion-line bg-white">
                <div className="flex items-center justify-between gap-2 border-b border-aion-line px-3 py-2 text-sm">
                  <span className="font-semibold text-aion-ink">Lista {previewAno}</span>
                  <a
                    className="text-aion-blue underline-offset-2 hover:underline"
                    href={`/api/treinamentos/evidencias/${previewAno}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir em nova aba
                  </a>
                </div>
                <iframe
                  title={`Lista de presença ${previewAno}`}
                  src={`/api/treinamentos/evidencias/${previewAno}`}
                  className="h-[min(70vh,720px)] w-full bg-slate-100"
                />
              </div>
            ) : null}
          </>
        )}
        {evidenciaMsg ? <p className="text-sm text-aion-muted">{evidenciaMsg}</p> : null}
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="space-y-3 p-4">
          <div>
            <h2 className="text-lg font-semibold text-aion-ink">Evolução por setor · base → turma</h2>
            <p className="text-sm text-aion-muted">
              Fundo: base {painel.ano_anterior} (já aptos). Sobreposição: quem reforçou + novos em{" "}
              {painel.ano_atual}. Quem não voltou permanece capacitado.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-aion-muted">
            <span>
              <i className="mr-1 inline-block h-3 w-3 rounded-sm" style={{ background: COR_ANTERIOR }} />
              Base {painel.ano_anterior} (já sabem)
            </span>
            <span>
              <i className="mr-1 inline-block h-3 w-3 rounded-sm" style={{ background: COR_ATUAL }} />
              Reforço (recorrentes)
            </span>
            <span>
              <i className="mr-1 inline-block h-3 w-3 rounded-sm" style={{ background: COR_NOVOS }} />
              Novos
            </span>
          </div>
          <div className="max-h-[520px] space-y-1.5 overflow-y-auto pr-1">
            {setoresFiltrados.map((s) => {
              const turma = s.reciclados_atual + s.novos_atual;
              return (
                <div
                  key={s.setor}
                  className="grid grid-cols-[minmax(100px,180px)_1fr_88px] items-center gap-2 text-xs"
                >
                  <span className="truncate text-aion-ink" title={s.setor}>
                    {s.setor}
                  </span>
                  <div className="relative h-[20px]">
                    <div
                      className="absolute inset-y-0 left-0 rounded-sm"
                      style={{
                        width: `${(100 * s.treinados_anterior) / maxBarra}%`,
                        background: COR_ANTERIOR,
                      }}
                      title={`Base ${s.treinados_anterior}`}
                    />
                    <div
                      className="absolute top-1 left-0 flex h-2.5 overflow-hidden rounded-sm"
                      style={{ width: `${(100 * turma) / maxBarra}%` }}
                    >
                      <span
                        style={{
                          width: `${turma ? (100 * s.reciclados_atual) / turma : 0}%`,
                          background: COR_ATUAL,
                        }}
                      />
                      <span
                        style={{
                          width: `${turma ? (100 * s.novos_atual) / turma : 0}%`,
                          background: COR_NOVOS,
                        }}
                      />
                    </div>
                  </div>
                  <span
                    className="text-right font-mono text-[11px] text-aion-muted tabular-nums"
                    title={`Base ${s.treinados_anterior} · recorrentes ${s.reciclados_atual} · novos ${s.novos_atual}`}
                  >
                    {s.treinados_anterior} → {s.reciclados_atual}+{s.novos_atual}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="space-y-3 p-4">
          <div>
            <h2 className="text-lg font-semibold text-aion-ink">Atualização por setor</h2>
            <p className="text-sm text-aion-muted">
              % da base {painel.ano_anterior} que optou por reforço em {painel.ano_atual} · meta{" "}
              {META_RECICLAGEM_PCT}%. Taxa menor pode significar domínio — treinamento é opcional.
            </p>
          </div>
          <div className="h-[520px] w-full">
            <ResponsiveContainer>
              <BarChart
                data={[...setoresFiltrados].reverse()}
                layout="vertical"
                margin={{ left: 8, right: 24, top: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <YAxis
                  type="category"
                  dataKey="setor"
                  width={150}
                  tick={{ fontSize: 10 }}
                  interval={0}
                />
                <Tooltip
                  formatter={(value) => [`${value}%`, "Taxa"]}
                  labelFormatter={(label) => String(label)}
                />
                <ReferenceLine
                  x={META_RECICLAGEM_PCT}
                  stroke="#0168b0"
                  strokeDasharray="4 4"
                  label={{ value: "meta", position: "insideTopRight", fill: "#0168b0", fontSize: 11 }}
                />
                <Bar dataKey="taxa_reciclagem_pct" name="Taxa %" radius={[0, 3, 3, 0]} barSize={12}>
                  {setoresFiltrados
                    .slice()
                    .reverse()
                    .map((s) => (
                      <Cell key={s.setor} fill={corFaixa(s.faixa)} />
                    ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3 p-4">
          <h2 className="text-lg font-semibold text-aion-ink">
            Composição da turma {painel.ano_atual} · recorrentes + novos
          </h2>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={composicao}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  <Cell fill={COR_ATUAL} />
                  <Cell fill={COR_NOVOS} />
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="space-y-3 p-4">
          <h2 className="text-lg font-semibold text-aion-ink">Comparativo anual</h2>
          <p className="text-sm text-aion-muted">
            Volume da turma e horas·homem. Turma menor = equipe já apta + reforço pontual + novos —
            sinal positivo de maturidade.
          </p>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={comparativo}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="ano" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="treinados" name="Treinados" fill={COR_ATUAL} radius={[4, 4, 0, 0]} />
                <Bar dataKey="horas" name="Horas·homem" fill={COR_ANTERIOR} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      {/* Cobertura — preparado, oculto até haver quadro RH */}
      {painel.cobertura_disponivel ? (
        <Card className="p-4">
          <h2 className="text-lg font-semibold">Cobertura por setor</h2>
        </Card>
      ) : null}

      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-aion-ink">Participantes</h2>
            <p className="text-sm text-aion-muted">
              {fmtNum(linhasTabela.length)} registro(s) · nomes só nesta tabela (não na TV).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-aion-muted" />
              <Input
                className="w-56 pl-8"
                placeholder="Nome ou matrícula"
                value={busca}
                onChange={(e) => {
                  const v = e.target.value;
                  setBusca(v);
                  startTransition(() => setBuscaDeferred(v));
                }}
              />
            </div>
            <select
              className="h-10 rounded-lg border border-aion-line bg-white px-3 text-sm"
              value={reciclagemFiltro}
              onChange={(e) => setReciclagemFiltro(e.target.value as typeof reciclagemFiltro)}
            >
              <option value="todos">Reciclagem: todas</option>
              <option value="sim">Reciclagem: sim</option>
              <option value="nao">Reciclagem: não</option>
              <option value="na">Reciclagem: N/A (2025)</option>
            </select>
          </div>
        </div>
        <DataTable data={linhasTabela} columns={colunas} pageSize={15} />
      </Card>

      <div className="rounded-r-lg border-l-4 border-amber-500 bg-white px-4 py-3 text-sm text-aion-muted">
        <strong className="text-aion-ink">Limites da base.</strong> Listas de 2025 manuscritas — alguns
        nomes/matrículas com <em>leitura incerta</em>. Setores padronizados no código (
        <code className="font-mono text-xs">lib/treinamentos/setores.ts</code>
        ). Para os próximos anos, incluir o campo Setor no Google Forms.
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/tables/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TableSkeleton } from "@/components/ui/skeleton";
import { ROTA_LOGIN_ADMIN, hrefLoginAdmin } from "@/lib/auth/sessao-ui";
import {
  DURACAO_REVELACAO_MS,
  FILTRO_INICIAL,
  MOTIVO_LIMITE,
  ROTULO_MOTIVO,
  TEXTO_AJUDA_CONFLITO,
  TEXTO_AJUDA_MOTIVO,
  TEXTO_ERRO,
  TEXTO_ESCOLHA_PAPEL,
  TEXTO_PAPEL_PENDENTE,
  TEXTO_SEM_PERMISSAO,
  TEXTO_TENTAR,
  TEXTO_TOAST_REENVIO,
  TEXTO_TOAST_RECUSAR,
  TEXTO_TOAST_REVELAR,
  TEXTO_VAZIO_CADASTRADOS,
  TEXTO_VAZIO_PENDENTES,
  TITULO_INATIVAR,
  TITULO_REATIVAR,
  TITULO_RECUSAR,
  divergeRotulo,
  filtrarUsuarios,
  formatarQuando,
  podeReenviar,
  rotuloAcao,
  rotuloEntrega,
  rotuloSituacao,
  temConflito,
  textoInativar,
  textoReativar,
  textoRecusar,
  textoToastAprovar,
  textoToastInativar,
  textoToastReativar,
  tomEntrega,
  tomSituacao,
  type AbaBot,
  type ConflitoGrupo,
  type EventoAuditoriaTela,
  type FiltroTela,
  type UsuarioBot,
} from "@/lib/bot/apresentacao";
import { formatarTelefoneCompleto } from "@/lib/bot/telefone";
import { cn } from "@/lib/utils";
import { focaveisDe, ModalConfirmacao } from "./modal-confirmacao";

const FOCO =
  "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-aion-blue";
const BORDA = "border-aion-muted";

export type ResultadoAcao = { ok: true } | { ok: false; message: string };
export type ResultadoRevelar = { ok: true; telefone: string } | { ok: false; message: string };
export type AuditoriaCarregada = { dias: number; eventos: EventoAuditoriaTela[] };

type ModalAberto = { tipo: "recusar" | "inativar" | "reativar"; usuario: UsuarioBot; origem: HTMLElement | null };

function textoPuro(valor: string | null | undefined) {
  return valor?.trim() ? valor : "—";
}

export function PainelBotUsuarios({
  fase,
  usuarios,
  papeis,
  conflitos,
  onRecarregar,
  onAcao,
  onRevelar,
  onCarregarAuditoria,
  duracaoRevelacaoMs = DURACAO_REVELACAO_MS,
}: {
  fase: "carregando" | "sem-permissao" | "erro" | "pronto";
  usuarios: UsuarioBot[];
  papeis: string[];
  conflitos: Record<string, ConflitoGrupo>;
  onRecarregar: () => void;
  onAcao: (id: string, corpo: Record<string, string>) => Promise<ResultadoAcao>;
  onRevelar: (id: string) => Promise<ResultadoRevelar>;
  onCarregarAuditoria: (id: string) => Promise<AuditoriaCarregada | null>;
  duracaoRevelacaoMs?: number;
}) {
  const [aba, setAba] = useState<AbaBot>("pendentes");
  const [filtro, setFiltro] = useState<FiltroTela>(FILTRO_INICIAL);
  const [desktop, setDesktop] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [origemDetalhe, setOrigemDetalhe] = useState<HTMLElement | null>(null);
  const [papeisEscolhidos, setPapeisEscolhidos] = useState<Record<string, string>>({});
  const [modal, setModal] = useState<ModalAberto | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erroAcao, setErroAcao] = useState<{ id: string; message: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [revelado, setRevelado] = useState<{ id: string; telefone: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [auditoria, setAuditoria] = useState<AuditoriaCarregada | null>(null);
  const [auditoriaErro, setAuditoriaErro] = useState(false);
  const [hrefLogin, setHrefLogin] = useState(ROTA_LOGIN_ADMIN);
  const detalheRef = useRef<HTMLElement>(null);
  const origemDetalheRef = useRef<HTMLElement | null>(null);

  // A largura só existe no cliente.
  useEffect(() => {
    const mq = window.matchMedia?.("(min-width: 1024px)");
    if (!mq) return;
    const atualizar = () => setDesktop(mq.matches);
    atualizar();
    mq.addEventListener("change", atualizar);
    return () => mq.removeEventListener("change", atualizar);
  }, []);

  useEffect(() => {
    if (!revelado) return;
    const timer = setTimeout(() => {
      setRevelado(null);
      setToast((atual) => (atual === TEXTO_TOAST_REVELAR ? null : atual));
    }, duracaoRevelacaoMs);
    return () => clearTimeout(timer);
  }, [revelado, duracaoRevelacaoMs]);

  useEffect(() => {
    if (!detalheId || modal) return;
    const dialog = detalheRef.current;
    if (!dialog) return;
    const titulo = dialog.querySelector<HTMLElement>("#detalhe-bot-titulo");
    titulo?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setDetalheId(null);
        origemDetalheRef.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;
      const focaveis = focaveisDe(dialog);
      if (!focaveis.length) {
        event.preventDefault();
        return;
      }
      const primeiro = focaveis[0]!;
      const ultimo = focaveis[focaveis.length - 1]!;
      const ativo = document.activeElement;
      if (event.shiftKey && (ativo === primeiro || ativo === titulo || !dialog.contains(ativo))) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && (ativo === ultimo || !dialog.contains(ativo))) {
        event.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [detalheId, modal]);

  // A URL de retorno só existe no cliente.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setHrefLogin(hrefLoginAdmin(`${window.location.pathname}${window.location.search}`)), []);

  const pendentes = filtrarUsuarios(usuarios, "pendentes", { ...filtro, situacao: "todos" });
  const cadastrados = filtrarUsuarios(usuarios, "cadastrados", filtro);
  const linhas = aba === "pendentes" ? pendentes : cadastrados;
  const donos = [...new Set(usuarios.map((usuario) => usuario.dono).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
  const detalhe = usuarios.find((usuario) => usuario.id === detalheId) ?? null;

  function escolherPapel(id: string, papel: string) {
    setPapeisEscolhidos((atual) => ({ ...atual, [id]: papel }));
    setErroAcao((atual) => (atual?.id === id ? null : atual));
  }

  function avisoDe(usuario: UsuarioBot, corpo: Record<string, string>) {
    if (corpo.acao === "aprovar") return textoToastAprovar(usuario.nome, corpo.papel ?? "");
    if (corpo.acao === "recusar") return TEXTO_TOAST_RECUSAR;
    if (corpo.acao === "inativar") return textoToastInativar(usuario.nome);
    if (corpo.acao === "reativar") return textoToastReativar(usuario.nome);
    if (corpo.acao === "reenviar") return TEXTO_TOAST_REENVIO;
    return null;
  }

  async function executar(usuario: UsuarioBot, corpo: Record<string, string>) {
    setOcupado(true);
    setErroAcao(null);
    try {
      const resultado = await onAcao(usuario.id, corpo);
      if (!resultado.ok) setErroAcao({ id: usuario.id, message: resultado.message });
      else {
        setModal(null);
        const aviso = avisoDe(usuario, corpo);
        if (aviso) setToast(aviso);
      }
      return resultado.ok;
    } finally {
      setOcupado(false);
    }
  }

  async function revelar(id: string) {
    const resultado = await onRevelar(id);
    if (!resultado.ok) {
      setErroAcao({ id, message: resultado.message });
      return;
    }
    setRevelado({ id, telefone: resultado.telefone });
    setToast(TEXTO_TOAST_REVELAR);
  }

  function ocultar(id: string) {
    setRevelado((atual) => (atual?.id === id ? null : atual));
    setToast((atual) => (atual === TEXTO_TOAST_REVELAR ? null : atual));
  }

  async function abrir(usuario: UsuarioBot, origem: HTMLElement) {
    origemDetalheRef.current = origem;
    setOrigemDetalhe(origem);
    setDetalheId(usuario.id);
    setAuditoria(null);
    setAuditoriaErro(false);
    const dados = await onCarregarAuditoria(usuario.id);
    setAuditoria(dados);
    setAuditoriaErro(!dados);
  }

  function fecharDetalhe() {
    setDetalheId(null);
    origemDetalhe?.focus();
  }

  function telefoneDe(usuario: UsuarioBot) {
    if (revelado?.id === usuario.id) return formatarTelefoneCompleto(revelado.telefone);
    return usuario.telefone_mascarado;
  }

  function telefone(usuario: UsuarioBot) {
    const visivel = revelado?.id === usuario.id;
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm text-aion-ink">{telefoneDe(usuario)}</span>
        <Button
          type="button"
          variant="outline"
          className={`min-h-11 ${BORDA} ${FOCO}`}
          aria-label={visivel ? `Ocultar telefone de ${usuario.nome}` : `Revelar telefone de ${usuario.nome}`}
          onClick={(event) => {
            event.stopPropagation();
            if (visivel) ocultar(usuario.id);
            else void revelar(usuario.id);
          }}
        >
          {visivel ? null : <Eye className="h-4 w-4" aria-hidden="true" />}
          {visivel ? "Ocultar" : "Revelar"}
        </Button>
      </span>
    );
  }

  function seletorPapel(usuario: UsuarioBot, sufixo: string) {
    const ajudaId = `ajuda-papel-${sufixo}-${usuario.id}`;
    const escolhido = Boolean(papeisEscolhidos[usuario.id]);
    return (
      <div className="grid gap-1" onClick={(event) => event.stopPropagation()}>
        <label className="grid gap-1 text-sm text-aion-ink">
          <span className="font-medium">Papel</span>
          <select
            className={`min-h-11 rounded-lg border ${BORDA} bg-white px-3 text-sm ${FOCO}`}
            aria-label={`Papel de ${usuario.nome}`}
            value={papeisEscolhidos[usuario.id] ?? ""}
            onChange={(event) => escolherPapel(usuario.id, event.target.value)}
          >
            <option value="">Escolha o papel</option>
            {papeis.map((papel) => (
              <option key={papel} value={papel}>
                {papel}
              </option>
            ))}
          </select>
        </label>
        {escolhido ? null : (
          <p id={ajudaId} className="text-sm text-aion-ink">
            {TEXTO_ESCOLHA_PAPEL}
          </p>
        )}
      </div>
    );
  }

  function acoes(usuario: UsuarioBot, noDetalhe = false) {
    const papel = papeisEscolhidos[usuario.id] ?? "";
    return (
      <div className="flex flex-col gap-2" onClick={(event) => event.stopPropagation()}>
        {usuario.situacao === "pendente" ? (
          <>
            {seletorPapel(usuario, noDetalhe ? "detalhe" : "lista")}
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                className={`min-h-11 ${FOCO}`}
                disabled={!papel || ocupado}
                aria-describedby={papel ? undefined : `ajuda-papel-${noDetalhe ? "detalhe" : "lista"}-${usuario.id}`}
                onClick={() => void executar(usuario, { acao: "aprovar", papel })}
              >
                Aprovar
              </Button>
              <Button
                type="button"
                variant="danger"
                className={`min-h-11 ${FOCO}`}
                disabled={ocupado}
                onClick={(event) => {
                  setMotivo("");
                  setModal({ tipo: "recusar", usuario, origem: event.currentTarget });
                }}
              >
                Recusar
              </Button>
            </div>
          </>
        ) : null}
        {usuario.situacao === "ativo" || usuario.situacao === "inativo" ? (
          <div className="grid grid-cols-2 gap-2">
            {podeReenviar(usuario) ? (
              <Button
                type="button"
                variant="outline"
                className={`min-h-11 ${BORDA} ${FOCO}`}
                disabled={ocupado}
                onClick={() => void executar(usuario, { acao: "reenviar" })}
              >
                Reenviar
              </Button>
            ) : null}
            {usuario.situacao === "ativo" ? (
              <Button
                type="button"
                variant="danger"
                className={`min-h-11 ${FOCO}`}
                disabled={ocupado}
                onClick={(event) => setModal({ tipo: "inativar", usuario, origem: event.currentTarget })}
              >
                Inativar
              </Button>
            ) : (
              <Button
                type="button"
                className={`min-h-11 ${FOCO}`}
                disabled={ocupado}
                onClick={(event) => setModal({ tipo: "reativar", usuario, origem: event.currentTarget })}
              >
                Reativar
              </Button>
            )}
          </div>
        ) : null}
        {noDetalhe ? null : (
          <Button
            type="button"
            variant="secondary"
            className={`min-h-11 ${FOCO}`}
            aria-label={`Abrir ${usuario.nome}`}
            onClick={(event) => void abrir(usuario, event.currentTarget)}
          >
            Abrir
          </Button>
        )}
        {erroAcao?.id === usuario.id ? (
          <p role="alert" className="text-sm font-medium text-rose-800">
            {erroAcao.message}
          </p>
        ) : null}
      </div>
    );
  }

  function cartao(usuario: UsuarioBot) {
    const conflito = temConflito(usuario.id, conflitos[usuario.id]);
    return (
      <article key={usuario.id} aria-label={usuario.nome} className="rounded-xl border border-aion-line bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-base font-semibold text-aion-ink">{usuario.nome}</h3>
          <Badge tone={tomSituacao(usuario.situacao)}>{rotuloSituacao(usuario.situacao)}</Badge>
        </div>
        {aba === "pendentes" ? (
          <p className="mt-2 text-sm text-aion-ink">
            {textoPuro(usuario.setor)}
            {usuario.outros_setores ? ` · ${usuario.outros_setores}` : ""}
          </p>
        ) : (
          <p className="mt-2 text-sm text-aion-ink">{usuario.papel || "—"}</p>
        )}
        <div className="mt-3">
          {telefone(usuario)}
        </div>
        <p className="mt-2 text-sm text-aion-muted">
          {aba === "pendentes" ? "Pedido em" : "Atualizado"} {formatarQuando(aba === "pendentes" ? usuario.criado_em : usuario.atualizado_em)}
        </p>
        {aba === "cadastrados" ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="text-sm text-aion-ink">
              Entrega: <Badge tone={tomEntrega(usuario.entrega_status)}>{rotuloEntrega(usuario.entrega_status)}</Badge>
            </span>
            <span className="text-sm text-aion-ink">Dono: {usuario.dono}</span>
          </div>
        ) : null}
        {conflito ? (
          <div className="mt-2">
            <Badge tone="warn">Conflito de número</Badge>
            <p className="mt-1 text-sm text-aion-ink">{TEXTO_AJUDA_CONFLITO}</p>
          </div>
        ) : null}
        <div className="mt-3">
          {acoes(usuario)}
        </div>
      </article>
    );
  }

  const colunas: ColumnDef<UsuarioBot, unknown>[] =
    aba === "pendentes"
      ? [
          { id: "nome", header: "Nome", accessorKey: "nome" },
          { id: "setor", header: "Setor", cell: ({ row }) => textoPuro(row.original.setor) },
          { id: "outros", header: "Outros setores", cell: ({ row }) => textoPuro(row.original.outros_setores) },
          { id: "telefone", header: "Telefone", cell: ({ row }) => telefone(row.original) },
          { id: "pedido", header: "Pedido em", cell: ({ row }) => formatarQuando(row.original.criado_em) },
          {
            id: "conflito",
            header: "Conflito",
            cell: ({ row }) =>
              temConflito(row.original.id, conflitos[row.original.id]) ? (
                <div>
                  <Badge tone="warn">Conflito de número</Badge>
                  <p className="mt-1 text-sm text-aion-ink">{TEXTO_AJUDA_CONFLITO}</p>
                </div>
              ) : (
                "—"
              ),
          },
          { id: "acoes", header: "Ações", cell: ({ row }) => acoes(row.original) },
        ]
      : [
          { id: "nome", header: "Nome", accessorKey: "nome" },
          { id: "papel", header: "Papel", accessorKey: "papel" },
          { id: "telefone", header: "Telefone", cell: ({ row }) => telefone(row.original) },
          {
            id: "situacao",
            header: "Situação",
            cell: ({ row }) => <Badge tone={tomSituacao(row.original.situacao)}>{rotuloSituacao(row.original.situacao)}</Badge>,
          },
          { id: "dono", header: "Dono", accessorKey: "dono" },
          { id: "atualizado", header: "Atualizado", cell: ({ row }) => formatarQuando(row.original.atualizado_em) },
          {
            id: "entrega",
            header: "Entrega",
            cell: ({ row }) => <Badge tone={tomEntrega(row.original.entrega_status)}>{rotuloEntrega(row.original.entrega_status)}</Badge>,
          },
          { id: "acoes", header: "Ações", cell: ({ row }) => acoes(row.original) },
        ];

  const tituloModal = modal?.tipo === "recusar" ? TITULO_RECUSAR : modal?.tipo === "inativar" ? TITULO_INATIVAR : TITULO_REATIVAR;
  const corpoModal = !modal
    ? ""
    : modal.tipo === "recusar"
      ? textoRecusar(modal.usuario.nome)
      : modal.tipo === "inativar"
        ? textoInativar(modal.usuario.nome)
        : textoReativar(modal.usuario.nome);

  let miolo: ReactNode = null;
  if (fase === "sem-permissao") {
    miolo = (
      <Card>
        <CardContent className="space-y-3 py-6">
          <p role="status" className="text-sm font-medium text-aion-ink">
            {TEXTO_SEM_PERMISSAO}
          </p>
          <a href={hrefLogin} className={`inline-flex min-h-11 items-center rounded-lg bg-aion-blue px-4 font-medium text-white ${FOCO}`}>
            Entrar
          </a>
        </CardContent>
      </Card>
    );
  } else if (fase === "carregando") {
    miolo = (
      <Card>
        <CardHeader>
          <CardTitle>{aba === "pendentes" ? "Solicitações pendentes" : "Cadastrados"}</CardTitle>
        </CardHeader>
        <CardContent>
          <TableSkeleton rows={4} />
        </CardContent>
      </Card>
    );
  } else if (fase === "erro") {
    miolo = (
      <Card>
        <CardContent className="space-y-3 py-6">
          <p role="alert" className="text-sm font-medium text-aion-ink">
            {TEXTO_ERRO}
          </p>
          <Button type="button" className={`min-h-11 ${FOCO}`} onClick={onRecarregar}>
            {TEXTO_TENTAR}
          </Button>
        </CardContent>
      </Card>
    );
  } else {
    miolo = (
      <Card>
        <CardHeader>
          <CardTitle>{aba === "pendentes" ? "Solicitações pendentes" : "Cadastrados"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {linhas.length === 0 ? (
            <p role="status" className="text-sm text-aion-ink">
              {aba === "pendentes" ? TEXTO_VAZIO_PENDENTES : TEXTO_VAZIO_CADASTRADOS}
            </p>
          ) : desktop ? (
            <DataTable data={linhas} columns={colunas} pageSize={50} />
          ) : (
            <div className="space-y-3">
              {linhas.map((usuario) => cartao(usuario))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bot · usuários"
        description="Aprovar vínculos do assistente. O telefone fica mascarado até a revelação auditada."
      />
      <div aria-live="polite">
        {toast ? (
          <p role="status" className="rounded-lg border border-aion-line bg-aion-mist px-4 py-3 text-sm text-aion-ink">
            {toast}
          </p>
        ) : null}
      </div>
      {fase !== "sem-permissao" ? (
        <div className="space-y-3">
          <div role="tablist" aria-label="Cadastros do bot" className="flex flex-wrap gap-2">
            {(
              [
                ["pendentes", `Pendentes (${pendentes.length})`],
                ["cadastrados", `Cadastrados (${cadastrados.length})`],
              ] as const
            ).map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                role="tab"
                aria-selected={aba === valor}
                className={cn(
                  `min-h-11 rounded-lg px-4 text-sm font-medium ${FOCO}`,
                  aba === valor ? "bg-aion-blue text-white" : "bg-white text-aion-ink ring-1 ring-aion-line",
                )}
                onClick={() => setAba(valor)}
              >
                {rotulo}
              </button>
            ))}
          </div>
          {fase === "pronto" ? (
            <fieldset aria-label="Filtrar" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="grid gap-1 text-sm text-aion-ink">
                <span className="font-medium">Buscar</span>
                <Input
                  aria-label="Buscar"
                  value={filtro.busca}
                  autoComplete="off"
                  className={`min-h-11 ${BORDA} ${FOCO}`}
                  onChange={(event) => setFiltro((atual) => ({ ...atual, busca: event.target.value }))}
                />
              </label>
              {aba === "cadastrados" ? (
                <label className="grid gap-1 text-sm text-aion-ink">
                  <span className="font-medium">Situação</span>
                  <select
                    aria-label="Filtrar por situação"
                    className={`min-h-11 rounded-lg border ${BORDA} bg-white px-3 text-sm ${FOCO}`}
                    value={filtro.situacao}
                    onChange={(event) =>
                      setFiltro((atual) => ({ ...atual, situacao: event.target.value as FiltroTela["situacao"] }))
                    }
                  >
                    <option value="todos">Todos</option>
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </label>
              ) : null}
              {aba === "cadastrados" ? (
              <label className="grid gap-1 text-sm text-aion-ink">
                <span className="font-medium">Papel</span>
                <select
                  aria-label="Filtrar por papel"
                  className={`min-h-11 rounded-lg border ${BORDA} bg-white px-3 text-sm ${FOCO}`}
                  value={filtro.papel}
                  onChange={(event) => setFiltro((atual) => ({ ...atual, papel: event.target.value }))}
                >
                  <option value="">Todos</option>
                  {papeis.map((papel) => (
                    <option key={papel} value={papel}>
                      {papel}
                    </option>
                  ))}
                </select>
              </label>
              ) : null}
              <label className="grid gap-1 text-sm text-aion-ink">
                <span className="font-medium">Dono</span>
                <select
                  aria-label="Filtrar por dono"
                  className={`min-h-11 rounded-lg border ${BORDA} bg-white px-3 text-sm ${FOCO}`}
                  value={filtro.dono}
                  onChange={(event) => setFiltro((atual) => ({ ...atual, dono: event.target.value }))}
                >
                  <option value="">Todos</option>
                  {donos.map((dono) => (
                    <option key={dono} value={dono}>
                      {dono}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
          ) : null}
        </div>
      ) : null}
      <div role="tabpanel">{miolo}</div>
      {detalhe ? (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-aion-ink/40" onClick={fecharDetalhe} />
          <aside
            ref={detalheRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="detalhe-bot-titulo"
            className="relative flex h-full w-full max-w-full flex-col bg-white lg:max-w-xl lg:border-l lg:border-aion-line"
          >
            <header className="flex items-center justify-between gap-3 border-b border-aion-line px-4 py-3">
              <button type="button" className={`min-h-11 rounded-lg px-3 text-sm font-medium text-aion-blue lg:hidden ${FOCO}`} onClick={fecharDetalhe}>
                Voltar
              </button>
              <h2 id="detalhe-bot-titulo" tabIndex={-1} className="min-w-0 flex-1 truncate text-lg font-semibold text-aion-ink focus:[outline:3px_solid_var(--aion-blue)] focus:[outline-offset:2px]">
                {detalhe.nome}
              </h2>
              <button type="button" className={`hidden min-h-11 rounded-lg px-3 text-sm font-medium text-aion-ink lg:inline-flex lg:items-center ${FOCO}`} aria-label="Fechar detalhe" onClick={fecharDetalhe}>
                Fechar
              </button>
            </header>
            <div className="flex-1 space-y-4 overflow-auto p-4">
              <dl className="grid gap-3 sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-aion-muted">Nome do convite (rótulo)</dt>
                  <dd className="mt-1 text-sm text-aion-ink">{textoPuro(detalhe.rotulo)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-aion-muted">Nome digitado</dt>
                  <dd className="mt-1 text-sm text-aion-ink">{detalhe.nome}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-aion-muted">Telefone digitado</dt>
                  <dd className="mt-1">
                    {telefone(detalhe)}
                  </dd>
                </div>
              </dl>
              {divergeRotulo(detalhe.rotulo, detalhe.nome) ? (
                <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  O nome digitado difere do rótulo do convite.
                </p>
              ) : null}
              <p className="text-sm text-aion-ink">Setor: {textoPuro(detalhe.setor)}</p>
              <p className="text-sm text-aion-ink">Outros setores: {textoPuro(detalhe.outros_setores)}</p>
              <p className="text-sm text-aion-ink">
                Situação: <Badge tone={tomSituacao(detalhe.situacao)}>{rotuloSituacao(detalhe.situacao)}</Badge>
              </p>
              <p className="text-sm text-aion-ink">
                {detalhe.situacao === "pendente" ? TEXTO_PAPEL_PENDENTE : `Papel atual: ${detalhe.papel || "—"}`}
              </p>
              <p className="text-sm text-aion-ink">Dono: {detalhe.dono}</p>
              {detalhe.email_mascarado ? <p className="text-sm text-aion-ink">E-mail: {detalhe.email_mascarado}</p> : null}
              <p className="text-sm text-aion-muted">Criado {formatarQuando(detalhe.criado_em)}</p>
              <p className="text-sm text-aion-muted">Atualizado {formatarQuando(detalhe.atualizado_em)}</p>
              <p className="text-sm text-aion-muted">Verificado {formatarQuando(detalhe.verificado_em)}</p>
              {detalhe.aprovado_por ? <p className="text-sm text-aion-ink">Aprovado por {detalhe.aprovado_por}</p> : null}
              {detalhe.situacao === "ativo" || detalhe.situacao === "inativo" ? (
                <p className="text-sm text-aion-ink">
                  Entrega: <Badge tone={tomEntrega(detalhe.entrega_status)}>{rotuloEntrega(detalhe.entrega_status)}</Badge>
                  {detalhe.entrega_pedido_em ? ` · reenvio pedido ${formatarQuando(detalhe.entrega_pedido_em)}` : ""}
                </p>
              ) : null}
              {temConflito(detalhe.id, conflitos[detalhe.id]) ? (
                <div className="space-y-1">
                  <Badge tone="warn">Conflito de número</Badge>
                  <p className="text-sm text-aion-ink">{TEXTO_AJUDA_CONFLITO}</p>
                  <ul className="list-disc pl-5 text-sm text-aion-ink">
                    {[...(conflitos[detalhe.id]?.pendentes ?? []), ...(conflitos[detalhe.id]?.aprovados ?? [])]
                      .filter((pessoa) => pessoa.id !== detalhe.id)
                      .map((pessoa) => (
                        <li key={pessoa.id}>
                          {pessoa.nome} · {pessoa.telefone_mascarado}
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}
              <section aria-label="Auditoria da pessoa">
                <h3 className="text-sm font-semibold text-aion-ink">Auditoria da pessoa</h3>
                <p className="mt-1 text-sm text-aion-muted">
                  Últimos {auditoria?.dias ?? 90} dias. Sem telefone completo e sem corpo.
                </p>
                {auditoriaErro ? (
                  <p className="mt-2 text-sm text-aion-ink">{TEXTO_ERRO}</p>
                ) : !auditoria ? (
                  <TableSkeleton rows={3} />
                ) : auditoria.eventos.length === 0 ? (
                  <p className="mt-2 text-sm text-aion-ink">Nenhum evento nos últimos {auditoria.dias} dias.</p>
                ) : (
                  <table className="mt-2 w-full text-left text-sm text-aion-ink">
                    <thead>
                      <tr className="text-xs uppercase tracking-wide text-aion-muted">
                        <th className="py-1 pr-2 font-semibold">Quando</th>
                        <th className="py-1 pr-2 font-semibold">Recurso</th>
                        <th className="py-1 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditoria.eventos.map((evento) => (
                        <tr key={evento.id} className="border-t border-aion-line">
                          <td className="py-2 pr-2">{formatarQuando(evento.criado_em)}</td>
                          <td className="py-2 pr-2">
                            {rotuloAcao(evento.acao)} · {evento.recurso}
                          </td>
                          <td className="py-2">{evento.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            </div>
            <footer className="sticky bottom-0 flex flex-wrap gap-2 border-t border-aion-line bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {acoes(detalhe, true)}
            </footer>
          </aside>
        </div>
      ) : null}
      <ModalConfirmacao
        aberto={Boolean(modal)}
        titulo={tituloModal}
        corpo={corpoModal}
        rotuloConfirmar={modal?.tipo === "recusar" ? "Recusar" : modal?.tipo === "inativar" ? "Inativar" : "Reativar"}
        destrutivo={modal?.tipo === "recusar" || modal?.tipo === "inativar"}
        confirmarDesabilitado={ocupado}
        origem={modal?.origem ?? null}
        onFechar={() => setModal(null)}
        onConfirmar={() => {
          if (!modal) return;
          if (modal.tipo === "recusar") {
            const corpo: Record<string, string> = { acao: "recusar" };
            const texto = motivo.trim();
            if (texto) corpo.motivo = texto;
            void executar(modal.usuario, corpo);
            return;
          }
          void executar(modal.usuario, { acao: modal.tipo === "inativar" ? "inativar" : "reativar" });
        }}
      >
        {modal?.tipo === "recusar" ? (
          <label className="grid gap-1 text-sm text-aion-ink">
            <span className="font-medium">{ROTULO_MOTIVO}</span>
            <textarea
              className={`min-h-11 rounded-lg border ${BORDA} px-3 py-2 text-sm ${FOCO}`}
              maxLength={MOTIVO_LIMITE}
              aria-describedby="motivo-ajuda motivo-contador"
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
            />
            <span id="motivo-ajuda" className="text-sm text-aion-muted">
              {TEXTO_AJUDA_MOTIVO}
            </span>
            <span id="motivo-contador" className="text-right text-sm text-aion-muted">
              {motivo.length}/{MOTIVO_LIMITE}
            </span>
          </label>
        ) : null}
        {modal && erroAcao?.id === modal.usuario.id ? (
          <p role="alert" className="mt-3 text-sm font-medium text-rose-800">
            {erroAcao.message}
          </p>
        ) : null}
      </ModalConfirmacao>
    </div>
  );
}

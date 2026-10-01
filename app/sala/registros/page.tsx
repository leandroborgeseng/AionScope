"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Pacote = {
  impedimentos: Array<Record<string, unknown>>;
  aquisicoes: Array<Record<string, unknown>>;
  obras: Array<Record<string, unknown>>;
  treinamentos: Array<Record<string, unknown>>;
  alertas: Array<Record<string, unknown>>;
  melhorias: Array<Record<string, unknown>>;
  feriados: Array<Record<string, unknown>>;
};

function Campo({
  label,
  name,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm text-aion-ink">
      <span className="mb-1 block text-xs font-semibold tracking-wide text-aion-muted uppercase">{label}</span>
      <Input name={name} type={type} required={required} placeholder={placeholder} />
    </label>
  );
}

function Lista({
  titulo,
  linhas,
  onEncerrar,
}: {
  titulo: string;
  linhas: Array<{ id: string; texto: string }>;
  onEncerrar?: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {linhas.length === 0 ? <p className="text-sm text-aion-muted">Nenhum registro.</p> : null}
        {linhas.map((linha) => (
          <div key={linha.id} className="flex items-start justify-between gap-3 border-b border-aion-line py-2 text-sm">
            <span>{linha.texto}</span>
            {onEncerrar ? (
              <button
                type="button"
                className="text-xs font-semibold text-aion-blue"
                onClick={() => onEncerrar(linha.id)}
              >
                encerrar
              </button>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function SalaRegistrosPage() {
  const [dados, setDados] = useState<Pacote | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const resposta = await fetch("/api/sala/registros", { cache: "no-store" });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    setDados((await resposta.json()) as Pacote);
  }, []);

  useEffect(() => {
    void carregar().catch((falha) => setErro(falha instanceof Error ? falha.message : "falha"));
  }, [carregar]);

  async function enviar(evento: FormEvent<HTMLFormElement>, tipo: string) {
    evento.preventDefault();
    setErro(null);
    setOk(null);
    const form = new FormData(evento.currentTarget);
    const body: Record<string, unknown> = { tipo };
    for (const [chave, valor] of form.entries()) {
      if (chave === "evidencia" || chave === "segregados") body[chave] = valor === "on";
      else body[chave] = String(valor);
    }
    const resposta = await fetch("/api/sala/registros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await resposta.json()) as { ok: boolean; message?: string };
    if (!json.ok) {
      setErro(json.message ?? "Falha ao gravar.");
      return;
    }
    evento.currentTarget.reset();
    setOk("Registro salvo.");
    await carregar();
  }

  async function encerrar(tipo: string, id: string) {
    const resposta = await fetch(`/api/sala/registros/${tipo}/${id}`, { method: "DELETE" });
    if (!resposta.ok) {
      setErro("Não foi possível encerrar.");
      return;
    }
    await carregar();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registros da Sala"
        description="Impedimentos, P04–P07, feriados e melhorias do item 15. Ainda sem login — use só na rede interna."
      />
      <p className="text-sm text-aion-muted">
        Estes dados entram no snapshot da TV em <Link className="text-aion-blue underline" href="/sala">/sala</Link>.
      </p>
      {erro ? <p className="text-sm text-red-700">{erro}</p> : null}
      {ok ? <p className="text-sm text-emerald-700">{ok}</p> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Impedimento operacional</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-3" onSubmit={(evento) => void enviar(evento, "impedimento")}>
              <Campo label="Tag" name="tag" required placeholder="HSJ-00042" />
              <Campo label="Equipamento" name="equipamento" />
              <Campo label="Motivo" name="motivo" required />
              <Campo label="Nova data" name="nova_data" type="date" />
              <Campo label="Registrado por" name="registrado_por" />
              <button className="rounded-lg bg-aion-blue px-4 py-2 text-sm font-semibold text-white" type="submit">
                Salvar impedimento
              </button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">P04 · Aquisição</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-3" onSubmit={(evento) => void enviar(evento, "aquisicao")}>
              <Campo label="Descrição" name="descricao" required />
              <Campo label="Status" name="status" placeholder="em andamento" />
              <Campo label="Previsão" name="previsao" type="date" />
              <Campo label="Observação" name="observacao" />
              <button className="rounded-lg bg-aion-blue px-4 py-2 text-sm font-semibold text-white" type="submit">
                Salvar aquisição
              </button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">P05 · Obra / implantação</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-3" onSubmit={(evento) => void enviar(evento, "obra")}>
              <Campo label="Descrição" name="descricao" required />
              <Campo label="Status" name="status" placeholder="em andamento" />
              <Campo label="Previsão" name="previsao" type="date" />
              <Campo label="Observação" name="observacao" />
              <button className="rounded-lg bg-aion-blue px-4 py-2 text-sm font-semibold text-white" type="submit">
                Salvar obra
              </button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">P06 · Treinamento</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-3" onSubmit={(evento) => void enviar(evento, "treinamento")}>
              <Campo label="Data" name="data" type="date" required />
              <Campo label="Tema" name="tema" required />
              <Campo label="Participantes" name="participantes" type="number" />
              <label className="flex items-center gap-2 text-sm">
                <input name="evidencia" type="checkbox" /> Evidência recebida
              </label>
              <Campo label="Observação" name="observacao" />
              <button className="rounded-lg bg-aion-blue px-4 py-2 text-sm font-semibold text-white" type="submit">
                Salvar treinamento
              </button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">P07 · Alerta / recall</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-3" onSubmit={(evento) => void enviar(evento, "alerta")}>
              <Campo label="Título" name="titulo" required />
              <Campo label="Equipamentos afetados" name="equipamentos" placeholder="HSJ-00001, HSJ-00002" />
              <label className="flex items-center gap-2 text-sm">
                <input name="segregados" type="checkbox" /> Segregados
              </label>
              <Campo label="Status" name="status" placeholder="aberto" />
              <Campo label="Observação" name="observacao" />
              <button className="rounded-lg bg-aion-blue px-4 py-2 text-sm font-semibold text-white" type="submit">
                Salvar alerta
              </button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Melhoria do item 15</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-3" onSubmit={(evento) => void enviar(evento, "melhoria")}>
              <Campo label="Item" name="item" required />
              <Campo label="Status" name="status" placeholder="pendente / em andamento / feito" />
              <Campo label="Observação" name="observacao" />
              <button className="rounded-lg bg-aion-blue px-4 py-2 text-sm font-semibold text-white" type="submit">
                Salvar melhoria
              </button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Feriado</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-3" onSubmit={(evento) => void enviar(evento, "feriado")}>
              <Campo label="Data" name="data" type="date" required />
              <Campo label="Nome" name="nome" required placeholder="Finados" />
              <button className="rounded-lg bg-aion-blue px-4 py-2 text-sm font-semibold text-white" type="submit">
                Salvar feriado
              </button>
            </form>
          </CardContent>
        </Card>
      </div>

      {dados ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Lista
            titulo="Impedimentos ativos"
            linhas={dados.impedimentos.map((item) => ({
              id: String(item.id),
              texto: `${item.tag} · ${item.motivo}${item.nova_data ? ` · nova data ${item.nova_data}` : ""}`,
            }))}
            onEncerrar={(id) => void encerrar("impedimento", id)}
          />
          <Lista
            titulo="Aquisições"
            linhas={dados.aquisicoes.map((item) => ({
              id: String(item.id),
              texto: `${item.descricao} · ${item.status}`,
            }))}
            onEncerrar={(id) => void encerrar("aquisicao", id)}
          />
          <Lista
            titulo="Obras"
            linhas={dados.obras.map((item) => ({
              id: String(item.id),
              texto: `${item.descricao} · ${item.status}`,
            }))}
            onEncerrar={(id) => void encerrar("obra", id)}
          />
          <Lista
            titulo="Treinamentos"
            linhas={dados.treinamentos.map((item) => ({
              id: String(item.id),
              texto: `${item.data} · ${item.tema} · ${item.participantes} pessoas${item.evidencia ? " · evidência" : ""}`,
            }))}
          />
          <Lista
            titulo="Alertas / recall"
            linhas={dados.alertas.map((item) => ({
              id: String(item.id),
              texto: `${item.titulo} · ${item.status}`,
            }))}
            onEncerrar={(id) => void encerrar("alerta", id)}
          />
          <Lista
            titulo="Melhorias"
            linhas={dados.melhorias.map((item) => ({
              id: String(item.id),
              texto: `${item.item} · ${item.status}`,
            }))}
          />
          <Lista
            titulo="Feriados"
            linhas={dados.feriados.map((item) => ({
              id: String(item.id),
              texto: `${item.data} · ${item.nome}`,
            }))}
            onEncerrar={(id) => void encerrar("feriado", id)}
          />
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { OsAbertaSugestao, OsDetalheSnapshot } from "@/lib/ec/os-detalhe";

type Props = {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSalvar: () => void;
};

export function OsVinculoField({ value, disabled, onChange, onSalvar }: Props) {
  const [sugestoes, setSugestoes] = useState<OsAbertaSugestao[]>([]);
  const [aberto, setAberto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [statusOs, setStatusOs] = useState<OsDetalheSnapshot | null>(null);
  const [statusErro, setStatusErro] = useState<string | null>(null);
  const caixaRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);

  const buscarSugestoes = useCallback(async (q: string) => {
    setBuscando(true);
    try {
      const resposta = await fetch(`/api/sala/os-abertas?q=${encodeURIComponent(q)}&limit=12`, {
        cache: "no-store",
      });
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      const json = (await resposta.json()) as { ok: boolean; itens?: OsAbertaSugestao[] };
      setSugestoes(json.itens ?? []);
    } catch {
      setSugestoes([]);
    } finally {
      setBuscando(false);
    }
  }, []);

  useEffect(() => {
    if (!aberto) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void buscarSugestoes(value.trim());
    }, 280);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [value, aberto, buscarSugestoes]);

  useEffect(() => {
    const numero = value.trim();
    if (!numero || numero.length < 4) {
      setStatusOs(null);
      setStatusErro(null);
      return;
    }
    const id = window.setTimeout(() => {
      void (async () => {
        try {
          const resposta = await fetch(
            `/api/sala/os-abertas?numero=${encodeURIComponent(numero)}`,
            { cache: "no-store" },
          );
          if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
          const json = (await resposta.json()) as {
            encontrado?: boolean;
            detalhe?: OsDetalheSnapshot | null;
          };
          if (!json.encontrado || !json.detalhe) {
            setStatusOs(null);
            setStatusErro("OS não encontrada no recorte EC (últimos ~14 meses).");
            return;
          }
          setStatusOs(json.detalhe);
          setStatusErro(null);
        } catch {
          setStatusOs(null);
          setStatusErro(null);
        }
      })();
    }, 400);
    return () => window.clearTimeout(id);
  }, [value]);

  useEffect(() => {
    const fora = (evento: MouseEvent) => {
      if (!caixaRef.current?.contains(evento.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  return (
    <div ref={caixaRef} className="relative block text-sm sm:col-span-1">
      <span className="mb-1 block text-xs font-semibold tracking-wide text-aion-muted uppercase">
        Nº OS (vincular aberta)
      </span>
      <div className="flex gap-2">
        <Input
          value={value}
          disabled={disabled}
          onChange={(e) => {
            onChange(e.target.value);
            setAberto(true);
          }}
          onFocus={() => setAberto(true)}
          placeholder="buscar OS aberta…"
          autoComplete="off"
        />
        <button
          type="button"
          className="shrink-0 rounded-lg border border-aion-line px-3 text-xs font-semibold disabled:opacity-40"
          disabled={disabled}
          onClick={onSalvar}
        >
          Salvar
        </button>
      </div>

      {aberto && !disabled ? (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-aion-line bg-white shadow-lg">
          {buscando ? (
            <p className="px-3 py-2 text-xs text-aion-muted">Buscando OS abertas…</p>
          ) : sugestoes.length === 0 ? (
            <p className="px-3 py-2 text-xs text-aion-muted">
              Nenhuma OS aberta encontrada. Digite o número e salve manualmente se souber.
            </p>
          ) : (
            <ul className="py-1">
              {sugestoes.map((item) => (
                <li key={item.os}>
                  <button
                    type="button"
                    className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-aion-mist"
                    onClick={() => {
                      onChange(item.os);
                      setAberto(false);
                    }}
                  >
                    <span className="font-mono text-sm font-semibold text-aion-blue">{item.os}</span>
                    <span className="truncate text-xs text-aion-ink">
                      {item.equipamento} · {item.tag} · {item.setor}
                    </span>
                    <span className="text-[11px] text-aion-muted">
                      {item.situacao} · {item.etapa}
                      {item.pendenciaCompra ? " · compra" : ""}
                      {item.manutencaoExterna ? " · externa" : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {statusOs ? (
        <div className="mt-2 space-y-1 rounded-lg border border-aion-line bg-aion-mist/40 px-2 py-1.5 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={statusOs.aberto ? "ok" : "warn"}>
              {statusOs.aberto ? "OS aberta" : "OS fechada"}
            </Badge>
            <span className="font-semibold text-aion-ink">{statusOs.situacaoOs}</span>
            <span className="text-aion-muted">· {statusOs.etapa}</span>
          </div>
          <p className="text-aion-ink">
            {statusOs.equipamento} · {statusOs.tag} · {statusOs.setor}
          </p>
          {!statusOs.aberto ? (
            <p className="font-semibold text-amber-900">
              Atenção: esta OS já está fechada — vincular só se for histórico intencional.
            </p>
          ) : null}
          {statusOs.pendenciaCompra ? (
            <p className="text-amber-900">Pendência de compra registrada na OS.</p>
          ) : null}
        </div>
      ) : null}
      {statusErro ? <p className="mt-1 text-xs text-amber-900">{statusErro}</p> : null}
      {value.trim() ? (
        <p className="mt-1 text-[11px] text-aion-muted">
          Salvar marca o vínculo como edição manual (robô não sobrescreve).
        </p>
      ) : null}
    </div>
  );
}

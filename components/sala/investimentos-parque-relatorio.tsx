"use client";

import { useEffect, useMemo, useState } from "react";
import type { CicloPrevisaoAno, SalaSnapshot } from "@/lib/ec/snapshot-tipos";
import "@/app/sala/investimentos.css";

type ModoVisao = "eol" | "eos" | "ambos";

function formatoMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function somaInvestimento(lista: CicloPrevisaoAno[]) {
  return lista.reduce((soma, item) => soma + (item.investimento ?? 0), 0);
}

export function InvestimentosParqueRelatorio() {
  const [dados, setDados] = useState<SalaSnapshot | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [modo, setModo] = useState<ModoVisao>("ambos");
  const [anoDetalhe, setAnoDetalhe] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    const demo =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("demo") === "1";
    setCarregando(true);
    fetch(`/api/sala/snapshot${demo ? "?demo=1" : ""}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as SalaSnapshot;
      })
      .then((json) => {
        if (!cancelado) {
          setDados(json);
          setErro(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelado) {
          setErro(err instanceof Error ? err.message : "Falha ao carregar snapshot");
          setDados(null);
        }
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const previsaoEol = dados?.ciclo.previsaoEol ?? [];
  const previsaoEos = dados?.ciclo.previsaoEos ?? [];
  const anos = previsaoEol.map((item) => item.ano);

  const maxInvestimento = useMemo(() => {
    const valores: number[] = [];
    if (modo !== "eos") valores.push(...previsaoEol.map((i) => i.investimento ?? 0));
    if (modo !== "eol") valores.push(...previsaoEos.map((i) => i.investimento ?? 0));
    return Math.max(1, ...valores);
  }, [modo, previsaoEol, previsaoEos]);

  const totalEol = somaInvestimento(previsaoEol);
  const totalEos = somaInvestimento(previsaoEos);

  const detalheEol = anoDetalhe
    ? (previsaoEol.find((item) => item.ano === anoDetalhe)?.itens ?? [])
    : [];
  const detalheEos = anoDetalhe
    ? (previsaoEos.find((item) => item.ano === anoDetalhe)?.itens ?? [])
    : [];

  return (
    <div className="inv-root">
      <div className="inv-wrap">
        <header className="inv-cabeca">
          <div className="inv-marca">
            <img src="/aion-logo.png" alt="Aion Engenharia" />
            <h1 className="inv-titulo">Relatório de investimentos do parque</h1>
            <p className="inv-sub">
              Soma de ValorDeSubstituicao dos equipamentos médicos ATIVOS cujo EndOfLife (EOL) ou
              EndOfService (EOS) cai em cada ano do horizonte de 10 anos.
            </p>
          </div>
          <div className="inv-acoes no-print">
            <div className="inv-filtros" role="group" aria-label="Visão">
              <button
                type="button"
                className={modo === "eol" ? "ativo" : undefined}
                onClick={() => setModo("eol")}
              >
                Só EOL
              </button>
              <button
                type="button"
                className={modo === "eos" ? "ativo" : undefined}
                onClick={() => setModo("eos")}
              >
                Só EOS
              </button>
              <button
                type="button"
                className={modo === "ambos" ? "ativo" : undefined}
                onClick={() => setModo("ambos")}
              >
                Ambos
              </button>
            </div>
            <button type="button" className="inv-btn primario" onClick={() => window.print()}>
              Exportar PDF
            </button>
            <a className="inv-btn" href="/sala/ciclo-de-vida">
              Voltar ao Ciclo
            </a>
          </div>
        </header>

        {carregando ? <p className="inv-status">Carregando dados do parque…</p> : null}
        {erro ? <p className="inv-status">Erro: {erro}</p> : null}

        {dados ? (
          <>
            <div className="inv-kpis">
              {modo === "eol" || modo === "ambos" ? (
                <div className="inv-kpi eol">
                  <span>Investimento EOL · 10 anos</span>
                  <strong>{formatoMoeda(totalEol)}</strong>
                </div>
              ) : null}
              {modo === "eos" || modo === "ambos" ? (
                <div className="inv-kpi eos">
                  <span>Investimento EOS · 10 anos</span>
                  <strong>{formatoMoeda(totalEos)}</strong>
                </div>
              ) : null}
              <div className="inv-kpi">
                <span>Equip. no horizonte EOL</span>
                <strong>{dados.ciclo.vencem10Anos}</strong>
              </div>
              <div className="inv-kpi">
                <span>Equip. no horizonte EOS</span>
                <strong>{dados.ciclo.vencemEos10Anos}</strong>
              </div>
            </div>

            <section className="inv-secao">
              <h2>Investimento anual previsto</h2>
              <p className="hint">
                Clique em um ano para ver a lista de equipamentos. Exportar PDF usa a impressão do
                navegador (Salvar como PDF).
              </p>
              <div className="inv-chart" role="list">
                {anos.map((ano, index) => {
                  const eol = previsaoEol[index];
                  const eos = previsaoEos[index];
                  const hEol = Math.max(
                    4,
                    Math.round(((eol?.investimento ?? 0) / maxInvestimento) * 100),
                  );
                  const hEos = Math.max(
                    4,
                    Math.round(((eos?.investimento ?? 0) / maxInvestimento) * 100),
                  );
                  const ativo = anoDetalhe === ano;
                  return (
                    <div key={ano} className="inv-col" role="listitem">
                      <button
                        type="button"
                        className={ativo ? "ativo" : undefined}
                        onClick={() => setAnoDetalhe(ativo ? null : ano)}
                        aria-pressed={ativo}
                        aria-label={`Ano ${ano}`}
                      >
                        <div className="inv-barras">
                          {modo === "eol" || modo === "ambos" ? (
                            <div
                              className="inv-barra eol"
                              style={{ height: `${hEol}%` }}
                              title={`EOL ${formatoMoeda(eol?.investimento ?? 0)}`}
                            />
                          ) : null}
                          {modo === "eos" || modo === "ambos" ? (
                            <div
                              className="inv-barra eos"
                              style={{ height: `${hEos}%` }}
                              title={`EOS ${formatoMoeda(eos?.investimento ?? 0)}`}
                            />
                          ) : null}
                        </div>
                        <span className="inv-ano">{ano}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="inv-legenda">
                {modo === "eol" || modo === "ambos" ? (
                  <span>
                    <i className="eol" /> EOL (EndOfLife)
                  </span>
                ) : null}
                {modo === "eos" || modo === "ambos" ? (
                  <span>
                    <i className="eos" /> EOS (EndOfService)
                  </span>
                ) : null}
              </div>
            </section>

            <section className="inv-secao">
              <h2>Tabela anual</h2>
              <p className="hint">Valores = soma de ValorDeSubstituicao no ano.</p>
              <table className="inv-tabela">
                <thead>
                  <tr>
                    <th>Ano</th>
                    {modo === "eol" || modo === "ambos" ? (
                      <>
                        <th>Qtd EOL</th>
                        <th>Invest. EOL</th>
                      </>
                    ) : null}
                    {modo === "eos" || modo === "ambos" ? (
                      <>
                        <th>Qtd EOS</th>
                        <th>Invest. EOS</th>
                      </>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {anos.map((ano, index) => {
                    const eol = previsaoEol[index];
                    const eos = previsaoEos[index];
                    return (
                      <tr
                        key={ano}
                        onClick={() => setAnoDetalhe(anoDetalhe === ano ? null : ano)}
                      >
                        <td>
                          <strong>{ano}</strong>
                        </td>
                        {modo === "eol" || modo === "ambos" ? (
                          <>
                            <td>{eol?.quantidade ?? 0}</td>
                            <td className={(eol?.investimento ?? 0) === 0 ? "nulo" : undefined}>
                              {formatoMoeda(eol?.investimento ?? 0)}
                            </td>
                          </>
                        ) : null}
                        {modo === "eos" || modo === "ambos" ? (
                          <>
                            <td>{eos?.quantidade ?? 0}</td>
                            <td className={(eos?.investimento ?? 0) === 0 ? "nulo" : undefined}>
                              {formatoMoeda(eos?.investimento ?? 0)}
                            </td>
                          </>
                        ) : null}
                      </tr>
                    );
                  })}
                  <tr>
                    <td>
                      <strong>Total</strong>
                    </td>
                    {modo === "eol" || modo === "ambos" ? (
                      <>
                        <td>{dados.ciclo.vencem10Anos}</td>
                        <td>
                          <strong>{formatoMoeda(totalEol)}</strong>
                        </td>
                      </>
                    ) : null}
                    {modo === "eos" || modo === "ambos" ? (
                      <>
                        <td>{dados.ciclo.vencemEos10Anos}</td>
                        <td>
                          <strong>{formatoMoeda(totalEos)}</strong>
                        </td>
                      </>
                    ) : null}
                  </tr>
                </tbody>
              </table>
            </section>

            {anoDetalhe ? (
              <section className="inv-secao">
                <h2>Detalhe · {anoDetalhe}</h2>
                <p className="hint no-print">Clique de novo no ano para fechar.</p>
                {modo === "eol" || modo === "ambos" ? (
                  <>
                    <h3 className="eol">EOL · {detalheEol.length} equipamento(s)</h3>
                    {detalheEol.length === 0 ? (
                      <p className="inv-vazio">Nenhum equipamento EOL neste ano.</p>
                    ) : (
                      <div className="inv-detalhe-lista">
                        {detalheEol.map((item) => (
                          <div key={`eol-${item.tag}`} className="inv-item">
                            <div>
                              <strong>{item.equipamento}</strong>
                              <small>
                                {item.tag} · {item.setor} · EOL {item.data}
                              </small>
                            </div>
                            <div>{item.valorSubstituicao}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : null}
                {modo === "eos" || modo === "ambos" ? (
                  <>
                    <h3 className="eos">EOS · {detalheEos.length} equipamento(s)</h3>
                    {detalheEos.length === 0 ? (
                      <p className="inv-vazio">Nenhum equipamento EOS neste ano.</p>
                    ) : (
                      <div className="inv-detalhe-lista">
                        {detalheEos.map((item) => (
                          <div key={`eos-${item.tag}`} className="inv-item">
                            <div>
                              <strong>{item.equipamento}</strong>
                              <small>
                                {item.tag} · {item.setor} · EOS {item.data}
                              </small>
                            </div>
                            <div>{item.valorSubstituicao}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : null}
              </section>
            ) : null}

            <p className="inv-rodape">
              Fonte: snapshot Sala (`/api/sala/snapshot`) — equipamentos médicos ATIVOS EC. Valor =
              ValorDeSubstituicao (ou ValorDeAquisicao se substituição ausente). Atualizado:{" "}
              {new Date(dados.atualizadoEm).toLocaleString("pt-BR")}.
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}

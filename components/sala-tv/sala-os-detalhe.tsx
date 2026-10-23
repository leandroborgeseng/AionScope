"use client";

import type { OsDetalheSnapshot } from "@/lib/ec/snapshot-tipos";

function CampoDetalhe({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="sala-os-campo">
      <span className="sala-os-campo-rotulo">{rotulo}</span>
      <span className="sala-os-campo-valor">{valor || "—"}</span>
    </div>
  );
}

export function SalaOsDetalhePainel({
  detalhe,
  onVoltar,
  onFechar,
  aviso,
  mobile,
}: {
  detalhe: OsDetalheSnapshot;
  onVoltar: () => void;
  onFechar: () => void;
  /** Ex.: "dados do cache" (C11) ou "Esta OS saiu do recorte". */
  aviso?: string[];
  mobile?: boolean;
}) {
  return (
    <div className={mobile ? "sala-os-detalhe-overlay sala-recorte-mobile" : "sala-os-detalhe-overlay"} role="dialog" aria-modal="true" aria-label={`OS ${detalhe.os}`}>
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
            <button type="button" className="sala-drill-limpar" onClick={onVoltar} data-autofoco="1">
              Voltar
            </button>
            <button type="button" className="sala-drill-limpar sala-drill-fechar" onClick={onFechar}>
              Fechar · Esc
            </button>
          </div>
        </div>
        <div className="sala-os-detalhe-corpo">
          {aviso?.map((texto) => (
            <p key={texto} className="sala-recorte-aviso" role="status">
              {texto}
            </p>
          ))}
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


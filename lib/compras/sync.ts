import {
  caixasM365,
  destinosCompras,
  extrairCamposPedido,
  m365Configurado,
} from "./parse-email";
import {
  enderecoDe,
  enderecosPara,
  listarDelta,
  trechoMensagem,
  type GraphMessage,
} from "./graph";
import {
  aplicarRespostaRecebida,
  listarCompras,
  messageJaVisto,
  obterDelta,
  salvarDelta,
  upsertCompraEnviada,
} from "./store";

export type SyncResultado = {
  configurado: boolean;
  caixas: string[];
  processados: number;
  novosEnviados: number;
  novasRespostas: number;
  erros: string[];
};

function dataMsg(msg: GraphMessage) {
  return msg.sentDateTime || msg.receivedDateTime || new Date().toISOString();
}

function processarEnviado(msg: GraphMessage, caixa: string, destinos: Set<string>) {
  const para = enderecosPara(msg);
  if (!para.some((addr) => destinos.has(addr))) return false;
  if (messageJaVisto(msg.id)) return false;
  const assunto = msg.subject ?? "";
  const trecho = trechoMensagem(msg);
  const campos = extrairCamposPedido(assunto, trecho);
  const conversationId = msg.conversationId || msg.id;
  upsertCompraEnviada({
    conversationId,
    messageId: msg.id,
    data: dataMsg(msg),
    de: enderecoDe(msg) || caixa,
    para: para.join(", "),
    assunto,
    trecho,
    os: campos.os,
    tag: campos.tag,
    equipamento: campos.equipamento,
    item: campos.item,
    setor: campos.setor,
    solicitanteCaixa: caixa,
  });
  return true;
}

function processarRecebido(msg: GraphMessage) {
  const de = enderecoDe(msg);
  if (!de.endsWith("@hsj.com.br")) return false;
  if (!msg.conversationId) return false;
  if (messageJaVisto(msg.id)) return false;
  const assunto = msg.subject ?? "";
  const trecho = trechoMensagem(msg);
  const campos = extrairCamposPedido(assunto, trecho);
  const id = aplicarRespostaRecebida({
    conversationId: msg.conversationId,
    messageId: msg.id,
    data: dataMsg(msg),
    de,
    para: enderecosPara(msg).join(", "),
    assunto,
    trecho,
    sc: campos.sc,
    entregueEm: campos.entregueEm,
  });
  return Boolean(id);
}

async function drenarPasta(
  caixa: string,
  pasta: "sentitems" | "inbox",
  destinos: Set<string>,
  contadores: { processados: number; novosEnviados: number; novasRespostas: number },
) {
  let link = obterDelta(caixa, pasta)?.delta_link ?? null;
  for (let guard = 0; guard < 40; guard++) {
    const page = await listarDelta(caixa, pasta, link);
    for (const msg of page.value) {
      contadores.processados += 1;
      if (pasta === "sentitems") {
        if (processarEnviado(msg, caixa, destinos)) contadores.novosEnviados += 1;
      } else if (processarRecebido(msg)) {
        contadores.novasRespostas += 1;
      }
    }
    if (page.nextLink) {
      link = page.nextLink;
      continue;
    }
    if (page.deltaLink) salvarDelta(caixa, pasta, page.deltaLink);
    break;
  }
}

let ultimoSyncMs = 0;

export async function sincronizarCompras(opts?: { forcar?: boolean }): Promise<SyncResultado> {
  const resultado: SyncResultado = {
    configurado: m365Configurado(),
    caixas: caixasM365(),
    processados: 0,
    novosEnviados: 0,
    novasRespostas: 0,
    erros: [],
  };
  if (!resultado.configurado) {
    resultado.erros.push("Defina M365_TENANT_ID, M365_CLIENT_ID e M365_CLIENT_SECRET. Ver docs/sala/m365-setup.md.");
    return resultado;
  }

  const minSeconds = Number(process.env.COMPRAS_SYNC_MIN_SECONDS ?? 300);
  const intervalo = Number.isFinite(minSeconds) ? Math.max(0, minSeconds) * 1000 : 300_000;
  if (!opts?.forcar && intervalo > 0 && Date.now() - ultimoSyncMs < intervalo) {
    return resultado;
  }

  const destinos = new Set(destinosCompras());
  for (const caixa of resultado.caixas) {
    try {
      await drenarPasta(caixa, "sentitems", destinos, resultado);
      await drenarPasta(caixa, "inbox", destinos, resultado);
    } catch (error) {
      resultado.erros.push(`${caixa}: ${error instanceof Error ? error.message : "falha"}`);
    }
  }
  ultimoSyncMs = Date.now();
  return resultado;
}

export function resumoComprasTv(agora = new Date()) {
  const todas = listarCompras();
  const abertas = todas.filter((c) => c.situacao !== "entregue");
  const entreguesMes = todas.filter((c) => {
    if (!c.entregue_em) return false;
    const d = new Date(c.entregue_em);
    return d.getFullYear() === agora.getFullYear() && d.getMonth() === agora.getMonth();
  });

  const porSituacao = (sit: string) => abertas.filter((c) => c.situacao === sit);
  const aguardaSc = [...porSituacao("aguarda SC"), ...porSituacao("cobrar Manutenção")];
  const aguardaEntrega = [...porSituacao("aguarda entrega"), ...porSituacao("cobrar Compras")];
  const semOs = porSituacao("vincular a uma OS");

  const idadeDias = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return Math.max(0, Math.floor((agora.getTime() - d.getTime()) / 86_400_000));
  };

  const media = (valores: number[]) => {
    if (!valores.length) return null;
    return Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 10) / 10;
  };

  const mediasEmailSc = todas
    .filter((c) => c.enviado_em && c.sc_em)
    .map((c) => (new Date(c.sc_em!).getTime() - new Date(c.enviado_em!).getTime()) / 86_400_000)
    .filter((n) => Number.isFinite(n) && n >= 0);

  const mediasScEntrega = todas
    .filter((c) => c.sc_em && c.entregue_em)
    .map((c) => (new Date(c.entregue_em!).getTime() - new Date(c.sc_em!).getTime()) / 86_400_000)
    .filter((n) => Number.isFinite(n) && n >= 0);

  const mediasPonta = entreguesMes
    .filter((c) => c.enviado_em && c.entregue_em)
    .map((c) => (new Date(c.entregue_em!).getTime() - new Date(c.enviado_em!).getTime()) / 86_400_000)
    .filter((n) => Number.isFinite(n) && n >= 0);

  const comOs = todas.filter((c) => c.os).length;
  const pctOs = todas.length ? Math.round((comOs / todas.length) * 100) : null;

  const formatDiaHora = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm} ${hh}:${mi}`;
  };

  const formatDia = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}`;
  };

  const pedidos = [...abertas]
    .sort((a, b) => (idadeDias(b.enviado_em) ?? 0) - (idadeDias(a.enviado_em) ?? 0))
    .slice(0, 10)
    .map((c) => ({
      os: c.os || "—",
      equipamento: c.equipamento || "—",
      item: c.item || "—",
      setor: c.setor || "—",
      enviadoEm: formatDiaHora(c.enviado_em),
      solicitante: (c.solicitante_caixa || "").split("@")[0] || "—",
      sc: c.sc_numero ? `SC ${c.sc_numero}` : "—",
      scEm: formatDia(c.sc_em),
      paradoDias: idadeDias(c.enviado_em) ?? 0,
      situacao: c.situacao,
    }));

  return {
    configurado: m365Configurado(),
    aguardaSc: aguardaSc.length,
    aguardaScMaisAntigo: Math.max(0, ...aguardaSc.map((c) => idadeDias(c.enviado_em) ?? 0)) || null,
    aguardaEntrega: aguardaEntrega.length,
    aguardaEntregaMaisAntiga:
      Math.max(0, ...aguardaEntrega.map((c) => idadeDias(c.sc_em || c.enviado_em) ?? 0)) || null,
    entreguesMes: entreguesMes.length,
    mediaEmailSc: media(mediasEmailSc),
    mediaScEntrega: media(mediasScEntrega),
    mediaPontaAPonta: media(mediasPonta),
    percentualComOs: pctOs,
    semOs: semOs.length,
    pedidos,
  };
}

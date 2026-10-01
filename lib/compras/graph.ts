import { m365Configurado } from "./parse-email";

export type GraphMessage = {
  id: string;
  conversationId?: string | null;
  subject?: string | null;
  bodyPreview?: string | null;
  body?: { contentType?: string; content?: string } | null;
  from?: { emailAddress?: { address?: string; name?: string } } | null;
  toRecipients?: Array<{ emailAddress?: { address?: string; name?: string } }>;
  sentDateTime?: string | null;
  receivedDateTime?: string | null;
};

type TokenCache = { accessToken: string; expira: number };

const tokenCache: TokenCache = { accessToken: "", expira: 0 };

export function m365Credenciais() {
  return {
    tenant: process.env.M365_TENANT_ID?.trim() ?? "",
    clientId: process.env.M365_CLIENT_ID?.trim() ?? "",
    clientSecret: process.env.M365_CLIENT_SECRET?.trim() ?? "",
  };
}

export async function obterTokenGraph(): Promise<string> {
  if (!m365Configurado()) {
    throw new Error("M365 não configurado (M365_TENANT_ID / CLIENT_ID / CLIENT_SECRET).");
  }
  if (tokenCache.accessToken && tokenCache.expira > Date.now() + 60_000) {
    return tokenCache.accessToken;
  }
  const { tenant, clientId, clientSecret } = m365Credenciais();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const resposta = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await resposta.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!resposta.ok || !json.access_token) {
    throw new Error(json.error_description || `Falha no token Graph HTTP ${resposta.status}`);
  }
  tokenCache.accessToken = json.access_token;
  tokenCache.expira = Date.now() + (json.expires_in ?? 3600) * 1000;
  return json.access_token;
}

async function graphFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await obterTokenGraph();
  const url = path.startsWith("http") ? path : `https://graph.microsoft.com/v1.0${path}`;
  const resposta = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ConsistencyLevel: "eventual",
      ...(init?.headers ?? {}),
    },
  });
  const json = (await resposta.json().catch(() => ({}))) as T & {
    error?: { message?: string };
  };
  if (!resposta.ok) {
    throw new Error(json.error?.message || `Graph HTTP ${resposta.status}`);
  }
  return json;
}

export type DeltaPage = {
  value: GraphMessage[];
  nextLink?: string;
  deltaLink?: string;
};

/** Pasta well-known: sentitems | inbox */
export async function listarDelta(
  caixa: string,
  pasta: "sentitems" | "inbox",
  deltaLink?: string | null,
): Promise<DeltaPage> {
  const select =
    "$select=id,conversationId,subject,bodyPreview,from,toRecipients,sentDateTime,receivedDateTime";
  const start =
    deltaLink ||
    `/users/${encodeURIComponent(caixa)}/mailFolders/${pasta}/messages/delta?${select}&$top=50`;
  const page = await graphFetch<{
    value?: GraphMessage[];
    "@odata.nextLink"?: string;
    "@odata.deltaLink"?: string;
  }>(start);
  return {
    value: Array.isArray(page.value) ? page.value : [],
    nextLink: page["@odata.nextLink"],
    deltaLink: page["@odata.deltaLink"],
  };
}

/** Lista recente sem delta (amostra / diagnóstico). */
export async function listarRecentes(
  caixa: string,
  pasta: "sentitems" | "inbox",
  top = 30,
): Promise<GraphMessage[]> {
  const select =
    "$select=id,conversationId,subject,bodyPreview,from,toRecipients,sentDateTime,receivedDateTime";
  const path = `/users/${encodeURIComponent(caixa)}/mailFolders/${pasta}/messages?${select}&$top=${top}&$orderby=receivedDateTime desc`;
  const page = await graphFetch<{ value?: GraphMessage[] }>(path);
  return Array.isArray(page.value) ? page.value : [];
}

export function enderecosPara(msg: GraphMessage): string[] {
  return (msg.toRecipients ?? [])
    .map((item) => item.emailAddress?.address?.toLowerCase().trim())
    .filter((item): item is string => Boolean(item));
}

export function enderecoDe(msg: GraphMessage): string {
  return msg.from?.emailAddress?.address?.toLowerCase().trim() ?? "";
}

export function trechoMensagem(msg: GraphMessage, limite = 2000): string {
  const preview = (msg.bodyPreview ?? "").replace(/\s+/g, " ").trim();
  if (preview) return preview.slice(0, limite);
  const raw = msg.body?.content ?? "";
  const texto = raw
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return texto.slice(0, limite);
}

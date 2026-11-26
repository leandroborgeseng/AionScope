/**
 * Setor do usuário na API do bot.
 *
 * O vínculo `bot_usuario_setor` → `bot_setor` manda. A coluna
 * `bot_usuario.setor` é texto livre e pode divergir do vínculo: não entra
 * no filtro de OS, equipamento, cronograma nem calibração. Sem vínculo, a
 * assistência responde `setor_nao_cadastrado` (não usa o texto livre).
 * `/usuario` mostra os nomes do vínculo; sem vínculo, o texto livre; senão null.
 *
 * A cópia da OS (`docs/sala/api-campos.md`, 62 colunas) só documenta `Setor`.
 * O filtro antigo comparava esse texto ao nome do cadastro. `ENDOSCOPIA` não
 * é `ENDOSCOPIA TERCEIRIZADA` e a substring do item 3 só aceita o nome da OS
 * que contém o nome inteiro do vínculo — o contrário do que o Effort manda.
 * Com código na linha (`SetorCodigo`, `CodigoSetor`, `CodigoDoSetor`, o
 * próprio texto igual ao código, ou prefixo `67 - …`), casa o código do
 * vínculo. Sem código, casa `normalizarChave` (sem acento, sem caixa,
 * espaços colapsados).
 */
import { getDb } from "@/lib/db/client";
import { normalizarChave } from "./chave";

export type VinculoSetor = {
  codigo: string;
  nome: string;
};

export type SetoresDoUsuario = {
  papel: string;
  vinculos: VinculoSetor[];
  textoLivre: string | null;
};

type RegistroSetor = {
  Setor?: string | null;
  SetorCodigo?: string | number | null;
  CodigoSetor?: string | number | null;
  CodigoDoSetor?: string | number | null;
};

const CAMPOS_CODIGO = ["SetorCodigo", "CodigoSetor", "CodigoDoSetor"] as const;

export function resolverSetoresDoUsuario(usuarioId: string): SetoresDoUsuario {
  const linha = getDb().prepare("SELECT papel, setor FROM bot_usuario WHERE id = ?").get(usuarioId) as
    | { papel: string; setor: string | null }
    | undefined;
  const linhas = getDb()
    .prepare(
      `SELECT t.codigo AS codigo, t.nome AS nome
       FROM bot_usuario_setor s
       JOIN bot_setor t ON t.codigo = s.setor_codigo
       WHERE s.usuario_id = ?
       ORDER BY t.nome`,
    )
    .all(usuarioId) as Array<{ codigo: string | null; nome: string | null }>;
  const vinculos = linhas
    .map((item) => ({ codigo: (item.codigo ?? "").trim(), nome: (item.nome ?? "").trim() }))
    .filter((item) => normalizarChave(item.codigo) || normalizarChave(item.nome));
  const livre = linha?.setor?.trim() ?? "";
  return {
    papel: linha?.papel ?? "",
    vinculos,
    textoLivre: normalizarChave(livre) ? livre : null,
  };
}

/** Nome exibido em `/usuario`. Vínculo primeiro; texto livre só sem vínculo. */
export function setorExibido(resolvido: SetoresDoUsuario) {
  if (resolvido.vinculos.length) {
    return resolvido.vinculos
      .map((item) => item.nome || item.codigo)
      .filter((item) => item.trim())
      .join(", ");
  }
  return resolvido.textoLivre;
}

function codigoExplicito(registro: RegistroSetor) {
  for (const campo of CAMPOS_CODIGO) {
    const valor = registro[campo];
    if (valor == null) continue;
    const texto = String(valor).trim();
    if (texto) return texto;
  }
  return null;
}

function codigoNoTexto(setor: string, codigo: string) {
  if (!codigo) return false;
  if (setor === codigo) return true;
  return setor.startsWith(`${codigo} `) || setor.startsWith(`${codigo}-`);
}

/**
 * Código explícito que não é do vínculo não cai no nome.
 * Sem código, vale a igualdade normalizada ou o código escrito no texto do setor.
 */
export function casaRegistroComVinculo(registro: RegistroSetor, vinculos: VinculoSetor[]) {
  if (!vinculos.length) return false;
  const explicito = codigoExplicito(registro);
  if (explicito) {
    const chave = normalizarChave(explicito);
    return vinculos.some((vinculo) => normalizarChave(vinculo.codigo) === chave);
  }
  const setor = normalizarChave(registro.Setor);
  if (!setor) return false;
  return vinculos.some((vinculo) => {
    if (normalizarChave(vinculo.nome) === setor) return true;
    return codigoNoTexto(setor, normalizarChave(vinculo.codigo));
  });
}

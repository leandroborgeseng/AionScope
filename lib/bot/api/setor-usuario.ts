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
 * próprio texto igual ao código, ou o código no começo ou no fim separado
 * por espaço ou hífen — `NOME - 67`, `10A - NOME`), casa o código do
 * vínculo, numérico ou alfanumérico. O nome também casa depois de tirar
 * esse código. Sem código, casa `normalizarChave` (sem acento, sem caixa,
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

/**
 * Código no texto já normalizado: o setor inteiro, ou o código no começo
 * ou no fim, com espaço ou hífen no meio. `67` não casa `670` nem `167`;
 * `10A` não casa `10AB`.
 */
function codigoNoTexto(setor: string, codigo: string) {
  if (!codigo || !setor) return false;
  if (setor === codigo) return true;
  const separador = /[\s-]/;
  if (setor.startsWith(codigo) && separador.test(setor[codigo.length] ?? "")) return true;
  if (setor.length > codigo.length && setor.endsWith(codigo)) {
    const antes = setor[setor.length - codigo.length - 1] ?? "";
    if (separador.test(antes)) return true;
  }
  return false;
}

/** Nome da linha sem o código deste vínculo. */
function nomeSemCodigo(setor: string, codigo: string) {
  if (!codigoNoTexto(setor, codigo) || setor === codigo) return setor;
  let resto = setor;
  if (resto.endsWith(codigo)) {
    resto = resto.slice(0, resto.length - codigo.length).replace(/[\s-]+$/, "");
  }
  if (resto.startsWith(codigo)) {
    resto = resto.slice(codigo.length).replace(/^[\s-]+/, "");
  }
  return resto.trim();
}

/**
 * Código explícito que não é do vínculo não cai no nome.
 * Sem código, vale a igualdade normalizada, o código no começo ou no fim,
 * ou o nome já sem esse código.
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
    const nome = normalizarChave(vinculo.nome);
    const codigo = normalizarChave(vinculo.codigo);
    if (nome && nome === setor) return true;
    if (codigo && codigoNoTexto(setor, codigo)) return true;
    return Boolean(nome && codigo && nomeSemCodigo(setor, codigo) === nome);
  });
}

/**
 * Lista de setores do Effort. Só setores: código, nome, unidade e ativo.
 * A carga faz upsert e nunca apaga linha nem vínculo de pessoa.
 */
import { readFileSync, existsSync } from "fs";
import path from "path";
import type Database from "better-sqlite3";

export const ARQUIVO_SETORES_EFFORT = "data/setores-effort-20261111.csv";
/** Export do FixEffort em 11/11/2026 21:30 (America/Sao_Paulo). */
export const SETORES_EXPORTADO_EM = "2026-11-11T21:30:00.000-03:00";

export type SetorCsv = {
  codigo: string;
  nome: string;
  unidade: string;
  ativo: boolean;
};

export type SetorAtivo = { codigo: string; nome: string };

function camposCsv(linha: string): string[] {
  const saida: string[] = [];
  let i = 0;
  while (i < linha.length) {
    if (linha[i] === '"') {
      let valor = "";
      i += 1;
      while (i < linha.length) {
        if (linha[i] === '"') {
          if (linha[i + 1] === '"') {
            valor += '"';
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        valor += linha[i];
        i += 1;
      }
      saida.push(valor);
      if (linha[i] === ",") i += 1;
    } else {
      const virgula = linha.indexOf(",", i);
      if (virgula < 0) {
        saida.push(linha.slice(i));
        break;
      }
      saida.push(linha.slice(i, virgula));
      i = virgula + 1;
    }
  }
  return saida;
}

export function analisarCsvSetores(texto: string): SetorCsv[] {
  const linhas = texto.replace(/^\uFEFF/, "").split(/\r?\n/).filter((linha) => linha.trim());
  const cabecalho = linhas.shift();
  if (!cabecalho) return [];
  const colunas = camposCsv(cabecalho).map((coluna) => coluna.trim().toLowerCase());
  const indice = (nome: string) => colunas.indexOf(nome);
  const iCodigo = indice("codigo");
  const iNome = indice("nome");
  const iUnidade = indice("unidade");
  const iAtivo = indice("ativo");
  if (iCodigo < 0 || iNome < 0 || iAtivo < 0) return [];
  const setores: SetorCsv[] = [];
  for (const linha of linhas) {
    const campos = camposCsv(linha);
    const codigo = (campos[iCodigo] ?? "").trim();
    const nome = (campos[iNome] ?? "").trim();
    if (!codigo || !nome) continue;
    const ativoBruto = (campos[iAtivo] ?? "").trim().toLowerCase();
    setores.push({
      codigo,
      nome,
      unidade: iUnidade >= 0 ? (campos[iUnidade] ?? "").trim() : "",
      ativo: ativoBruto === "sim",
    });
  }
  return setores;
}

export function lerCsvSetoresEffort(): string {
  return readFileSync(path.join(process.cwd(), ARQUIVO_SETORES_EFFORT), "utf8");
}

export function arquivoSetoresPresente() {
  return existsSync(path.join(process.cwd(), ARQUIVO_SETORES_EFFORT));
}

/**
 * Upsert por código. Não dá DELETE em `bot_setor` nem em `bot_usuario_setor`.
 * `exportadoEm` fica gravado em cada linha.
 */
export function importarSetoresCsv(db: Database.Database, texto: string, exportadoEm: string) {
  const setores = analisarCsvSetores(texto);
  const gravar = db.prepare(
    `INSERT INTO bot_setor (codigo, nome, unidade, ativo, exportado_em)
     VALUES (@codigo, @nome, @unidade, @ativo, @exportado_em)
     ON CONFLICT(codigo) DO UPDATE SET
       nome = excluded.nome,
       unidade = excluded.unidade,
       ativo = excluded.ativo,
       exportado_em = excluded.exportado_em`,
  );
  const tx = db.transaction(() => {
    for (const setor of setores) {
      gravar.run({
        codigo: setor.codigo,
        nome: setor.nome,
        unidade: setor.unidade,
        ativo: setor.ativo ? 1 : 0,
        exportado_em: exportadoEm,
      });
    }
  });
  tx();
  return {
    linhas: setores.length,
    ativos: setores.filter((setor) => setor.ativo).length,
  };
}

export function importarSetoresEffort(db: Database.Database) {
  if (!arquivoSetoresPresente()) return { linhas: 0, ativos: 0, arquivo: false as const };
  const contagem = importarSetoresCsv(db, lerCsvSetoresEffort(), SETORES_EXPORTADO_EM);
  return { ...contagem, arquivo: true as const };
}

export function listarSetoresAtivos(db: Database.Database): SetorAtivo[] {
  const linhas = db.prepare("SELECT codigo, nome FROM bot_setor WHERE ativo = 1").all() as SetorAtivo[];
  return linhas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function contarSetores(db: Database.Database) {
  const total = db.prepare("SELECT COUNT(*) n FROM bot_setor").get() as { n: number };
  const ativos = db.prepare("SELECT COUNT(*) n FROM bot_setor WHERE ativo = 1").get() as { n: number };
  return { total: total.n, ativos: ativos.n };
}

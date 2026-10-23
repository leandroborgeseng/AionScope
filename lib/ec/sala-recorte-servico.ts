import { agoraFixtureSala, dadosFixtureSala, OS_FALHA_API_DEMO } from "./fixture-sala-drilldown";
import { carregarDadosSala, montarSnapshotDeDados, montarVistasSala, type DadosSala } from "./montar-snapshot";
import { obterOsDetalhePorNumero } from "./os-abertas";
import { montarOsDetalhe, type OsDetalheSnapshot } from "./os-detalhe";
import { resolverRecorte, type RecorteResolvido } from "./sala-recortes";
import { texto } from "./texto";

/** Modo demonstração com a fixture fictícia (`?demo=drill`) — screenshots e QA local. */
export function isDemoDrill(valor: string | null | undefined) {
  return valor === "drill";
}

export function snapshotDemoDrill() {
  return montarSnapshotDeDados(dadosFixtureSala(), agoraFixtureSala());
}

export function recorteDeDados(id: string, dados: DadosSala, agora: Date): RecorteResolvido | null {
  const { vistas } = montarVistasSala(dados, agora);
  return resolverRecorte(id, { vistas, os: dados.os, agora });
}

export async function carregarRecorte(id: string, demo: boolean): Promise<RecorteResolvido | null> {
  if (demo) return recorteDeDados(id, dadosFixtureSala(), agoraFixtureSala());
  const { dados, agora } = await carregarDadosSala();
  return recorteDeDados(id, dados, agora);
}

export class TempoEsgotadoError extends Error {}

export function comTimeout<T>(promessa: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TempoEsgotadoError(`tempo esgotado (${ms} ms)`)), ms);
    promessa.then(
      (valor) => {
        clearTimeout(timer);
        resolve(valor);
      },
      (erro) => {
        clearTimeout(timer);
        reject(erro);
      },
    );
  });
}

/** Detalhe da OS na API (GlobalThings, mesma consulta de /api/sala/os-abertas). */
export async function buscarDetalheOsApi(numero: string, demo: boolean): Promise<OsDetalheSnapshot | null> {
  if (demo) {
    if (numero === OS_FALHA_API_DEMO) throw new Error("falha simulada da API (fixture)");
    const item = dadosFixtureSala().os.find((os) => texto(os.OS) === numero);
    return item ? montarOsDetalhe(item) : null;
  }
  return obterOsDetalhePorNumero(numero);
}

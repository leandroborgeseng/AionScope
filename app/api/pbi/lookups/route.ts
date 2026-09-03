import { fetchPbi } from "@/lib/pbi/client";
import { uniqueSorted } from "@/lib/utils";
import type { EquipamentoItem, Lookups, OsResumidaItem, TipoManutencaoItem } from "@/lib/pbi/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const [equipamentos, os, tipos, oficina] = await Promise.all([
    fetchPbi<EquipamentoItem[]>(
      "equipamentos",
      new URLSearchParams({
        apenasAtivos: "true",
        incluirComponentes: "false",
        incluirCustoSubstituicao: "false",
      }),
    ),
    fetchPbi<OsResumidaItem[]>(
      "os-resumida",
      new URLSearchParams({
        tipoManutencao: "Todos",
        periodo: "MesAtual",
        qtdPorPagina: "100000",
      }),
    ),
    fetchPbi<TipoManutencaoItem[]>(
      "tipo-manutencao",
      new URLSearchParams({ apenasAtivos: "true", tipo: "Todos" }),
    ),
    fetchPbi<unknown[]>("oficina", new URLSearchParams({ apenasAtivos: "true" })),
  ]);

  if (!equipamentos.ok && !os.ok) {
    return Response.json(
      {
        ok: false,
        status: equipamentos.status ?? os.status,
        message: equipamentos.message ?? os.message,
      },
      { status: 502 },
    );
  }

  const eqs = equipamentos.ok ? equipamentos.data : [];
  const oss = os.ok ? os.data : [];

  const data: Lookups = {
    empresas: uniqueSorted([
      ...eqs.map((e) => e.RazaoSocial || e.Cliente),
      ...oss.map((o) => o.Empresa),
    ]),
    setores: uniqueSorted([...eqs.map((e) => e.Setor), ...oss.map((o) => o.Setor)]),
    oficinas: uniqueSorted(oss.map((o) => o.Oficina)),
    criticidades: uniqueSorted(eqs.map((e) => e.Criticidade)),
    fabricantes: uniqueSorted(eqs.map((e) => e.Fabricante)),
    modelos: uniqueSorted(eqs.map((e) => e.Modelo)),
    tiposManutencao: tipos.ok ? tipos.data : [],
    oficinaEndpointLiberado: oficina.ok,
  };

  return Response.json({ ok: true, data, cachedAt: new Date().toISOString() });
}

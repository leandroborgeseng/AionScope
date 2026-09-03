# AionScope

Dashboard de Engenharia Clínica (Indicadores EC — SJH).

Dashboard interno do Hospital e Maternidade São Joaquim que consome as APIs REST de Power BI da GlobalThings (`https://sjh.globalthings.net`). As chaves ficam só no servidor (API Routes do Next.js).

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS 4
- TanStack Query + TanStack Table
- Recharts

## Como rodar

É necessário Node.js 20+. Se o `node` não estiver no PATH, use o binário já presente em outros projetos da máquina ou instale via [nodejs.org](https://nodejs.org).

```bash
cp .env.example .env.local
# preencha os tokens PBI_* (já há um .env.local de desenvolvimento)
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Páginas

| Rota | Conteúdo |
| --- | --- |
| `/` | Visão geral (KPIs + drill-down) |
| `/cronograma` | Preventiva, status calculado, OS da tag |
| `/corretivas` | SLA, Pareto, monitores, tabela de OS |
| `/disponibilidade` | Série mensal, ranking, alerta de parado sem OS |
| `/parque` | ANVISA, fim de vida, criticidade |
| `/documentacao` | Anexos de equipamento e OS + CSV |

Filtros ficam na URL (`?from=&to=&empresas=&setores=...`) para compartilhar a visão.

## Endpoints pendentes

Três rotas existem no código e tentam a API de verdade. Enquanto o upstream responder 401/404, a UI mostra o banner *Aguardando liberação do suporte GlobalThings*:

- `/api/pbi/v1/tempo_de_parada_medio`
- `/api/pbi/v1/disponibilidade_equipamento`
- `/api/pbi/v1/oficina` (oficinas hoje vêm da listagem de OS)

## Disponibilidade mês a mês

Esse endpoint exige `empresasId`. O ID `1` usado no script de teste **não** é o parque HSJ. Informe o ID correto no campo **IDs empresa** da barra de filtros ou em `PBI_DEFAULT_EMPRESA_IDS` no `.env.local`.

## Cache

As API Routes guardam respostas em memória por 15 minutos (`PBI_CACHE_SECONDS=900`) para não sobrecarregar a GlobalThings.

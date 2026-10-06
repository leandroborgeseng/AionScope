# AionScope

Dashboard de Engenharia Clínica (Indicadores EC — SJH).

Dashboard interno do Hospital e Maternidade São Joaquim que consome as APIs REST de Power BI da GlobalThings (`https://sjh.globalthings.net`). As chaves ficam só no servidor (API Routes do Next.js).

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS 4
- TanStack Query + TanStack Table
- Recharts
- SQLite (`better-sqlite3`) para parque e contratos

## Como rodar

É necessário Node.js 20+. Se o `node` não estiver no PATH, use o binário já presente em outros projetos da máquina ou instale via [nodejs.org](https://nodejs.org).

```bash
cp .env.example .env.local
# preencha os tokens PBI_* (já há um .env.local de desenvolvimento)
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Docker e Railway

```bash
cp .env.example .env   # preencha os tokens PBI_* (o Compose lê `.env`, não `.env.local`)
docker compose up --build
```

Persistência: SQLite em `/data/aionscope.sqlite` (Compose: volume `aion-data`). Localmente, se `/data` não existir, o app usa `data/aionscope.sqlite` no workspace.

No Railway: deploy do `Dockerfile` + Volume em **Settings → Volumes** montado em `/data` (não use `VOLUME` no Dockerfile) + `DATABASE_PATH=/data/aionscope.sqlite` nas Variables (junto com os tokens `PBI_*`). O `PORT` é injetado pela plataforma; não commite `.env` nem tokens.

## Páginas

| Rota | Conteúdo |
| --- | --- |
| `/` | Visão geral (KPIs + drill-down) |
| `/cronograma` | Preventiva, status calculado, OS da tag |
| `/corretivas` | SLA, Pareto, monitores, tabela de OS |
| `/disponibilidade` | Série mensal, ranking, alerta de parado sem OS |
| `/parque` | ANVISA, fim de vida, criticidade |
| `/documentacao` | Anexos de equipamento e OS + CSV |
| `/sala` | TV da EC (1920×1080, rotação de telas) |
| `/sala/registros` | Cadastro manual: impedimentos, P04–P07, melhorias, feriados |
| `/indicadores/treinamentos-bombas` | Treinamentos bombas B. Braun (KPIs, setores, tabela, evidências) |
| `/sala/treinamentos` | TV — resumo de treinamentos B. Braun (sem nomes) |
| `/sala/ordens-compra` | Ordens formais do robô E-Mails Compras (filtros + categoria) |

Filtros ficam na URL (`?from=&to=&empresas=&setores=...`) para compartilhar a visão.

## Sala TV (quiosque)

Rota fullscreen `/sala` para TV 1920×1080. Snapshot em `/api/sala/snapshot` (cache 60s). Dados PBI da empresa `2` (HSJ) por padrão.

Horário útil da EC: **seg–sex 07:00–17:00** (`EC_HORA_INICIO` / `EC_HORA_FIM`). Fora disso a TV mostra plantão da Manutenção. Feriados: `EC_FERIADOS` (lista `YYYY-MM-DD`) e/ou tabela em `/sala/registros`.

Compras por e-mail (Outlook AION): configure o app no Entra (`docs/sala/m365-setup.md`) e as variáveis `M365_*` no Coolify. Enquanto isso, a tela `/sala/compras` fica no funil vazio.

No Coolify: volume persistente em `/data` + `DATABASE_PATH=/data/aionscope.sqlite`.

Quiosque típico: Chromium em kiosk apontando para `https://…/sala`, com `PBI_*` e `PBI_DEFAULT_EMPRESA_IDS=2` no ambiente.
## Endpoints pendentes

Três rotas existem no código e tentam a API de verdade. Enquanto o upstream responder 401/404, a UI mostra o banner *Aguardando liberação do suporte GlobalThings*:

- `/api/pbi/v1/tempo_de_parada_medio`
- `/api/pbi/v1/disponibilidade_equipamento`
- `/api/pbi/v1/oficina` (oficinas hoje vêm da listagem de OS)

## Disponibilidade mês a mês

Esse endpoint exige `empresasId`. O São Joaquim é o id `2` (`PBI_DEFAULT_EMPRESA_IDS`). O id `1` é outro parque.

## Cache

As API Routes guardam respostas em memória por 15 minutos (`PBI_CACHE_SECONDS=900`) para não sobrecarregar a GlobalThings.

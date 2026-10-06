# Estado atual — AionScope (Fase 0)

Reconhecimento de 30/09/2026. Nenhum código da Sala foi alterado.

Repositório local: `IndicadoresEC` (nome npm `indicadores-ec`). Deploy via Dockerfile standalone (antes Railway, agora Coolify), volume em `/data`, `DATABASE_PATH=/data/aionscope.sqlite`.

## Design

O pacote está em `docs/design/sala/`: `DESIGN.md`, `tokens.css`, `html/*.html`, `telas/*.png` (incluindo `00-fontes-de-dados.png`), `fonte-design/` e `PADRAO_EMAIL_COMPRAS.md`. A cópia original também está na raiz do repositório (`aion-sala-design/` e `aion-sala-design.zip`).

`.env` e `.env.local` já estão no `.gitignore`. `docs/sala/api-samples/` **ainda não** está; entra no `.gitignore` no início da Fase 1, antes de baixar amostra.

Não há login, middleware nem papel de admin. A Fase 6 (`/sala/registros` protegida) não tem base de autenticação para reaproveitar.

## Stack

| Peça | Versão / nota |
|---|---|
| Next.js App Router | 16.3.1, `output: "standalone"` |
| React | 19.2.8 |
| TypeScript | 5 |
| Tailwind | 4 |
| Dados de tela | TanStack Query 5 + TanStack Table 8 |
| Gráficos | Recharts 3 |
| SQLite | better-sqlite3 |
| Datas | `date-fns` 4, **sem** `date-fns-tz`. Fuso declarado `America/Sao_Paulo` em `lib/pbi/dates.ts` |
| Testes | não há runner no `package.json` |
| Fontes | Outfit (a conferir se é local ou Google) |

Scripts npm: `dev`, `build`, `start`, `lint`. Imagem: `Dockerfile` (Node 22 Alpine, multi-stage). Compose local: `docker-compose.yml`. Sem `VOLUME` no Dockerfile.

## Árvore resumida

```
app/                  rotas
  indicadores/        7 indicadores no menu
  qmentum/            hub, sem-preventiva, motivos-corretivas
  cadastros/          parque, contratos, terceiros
  cronograma/  sala/  compras/
  corretivas/ disponibilidade/ parque/ documentacao/ visao-geral/   fora do menu
  api/pbi/[resource]  proxy das APIs Effort
  api/pbi/lookups     equipamentos, OS resumida, tipos, oficina
  api/cadastros/      parque, contratos, terceiros
components/           shell, indicadores, sala, qmentum, cadastros, os
lib/pbi/              cliente, cache, catálogo, regras
lib/db/               SQLite (schema + migrations 001 e 002)
hooks/                usePbiQuery e recortes (ano, parque médico, preventiva)
public/               logo AION
```

Menu (`components/shell/nav-menu.tsx`): Indicadores, QMentum, Cadastros, Cronograma, Sala, Solicitações de compra.

## Fluxo de dados

```
Effort (PBI_BASE_URL, padrão https://sjh.globalthings.net)
  → header X-API-KEY (oficina usa API-KEY)
  → lib/pbi/client.ts fetchPbi
  → cache em memória, TTL PBI_CACHE_SECONDS (padrão 900 s)
  → app/api/pbi/[resource]  ou chamada direta no servidor
  → usePbiQuery no browser
  → lib/pbi/* monta o indicador
  → página

SQLite (DATABASE_PATH)
  → parque_meta, contratos, equipamentos_terceiros, schema_migrations
  → contratos e terceiros da UI hoje vêm da API; tabelas locais ficaram de uma fase anterior
```

A Sala atual não tem snapshot próprio. A página `/sala` pede `os-analitico` no cliente, refaz a cada 2 minutos (`SALA_REFRESH_MS`) e calcula o quadro em `lib/pbi/sala.ts` (`buildSalaSnapshot`).

## Token → onde entra

| Variável | Recurso interno | Endpoint | Quem usa |
|---|---|---|---|
| `PBI_TOKEN_OS_ANALITICO` | `os-analitico` | `/api/pbi/v1/listagem_analitica_das_os` | Sala, Compras, Cronograma, Indicadores, Visão geral, Corretivas |
| `PBI_TOKEN_OS_ANALITICO_RESUMIDO` | `os-resumida` | `.../listagem_analitica_das_os_resumida` | Cronograma, Documentação, Corretivas, lookups |
| `PBI_TOKEN_EQUIPAMENTOS` | `equipamentos` | `/api/pbi/v1/equipamentos` | Parque, terceiros, cronograma, gap de preventiva, custo/parque, índice médico (Sala) |
| `PBI_TOKEN_CRONOGRAMA` | `cronograma` | `/api/pbi/v1/cronograma` | Cronograma, gap preventiva, visão geral |
| `PBI_TOKEN_TIPO_MANUTENCAO` | `tipo-manutencao` | `/api/pbi/v1/tipo_manutencao` | Lookups de filtro |
| `PBI_TOKEN_ANEXOS_OS` | `anexos-os` | `/api/pbi/v1/anexos_os` | Terceiros, documentação, QMentum motivos |
| `PBI_TOKEN_ANEXOS_EQUIPAMENTO` | `anexos-equipamento` | `/api/pbi/v1/anexos_equipamento` | Terceiros, parque, documentação |
| `PBI_TOKEN_CONTRATOS` | `contratos` | `/api/pbi/v1/contratos` | Cadastro de contratos e custo/parque. Token vazio no Coolify |
| `PBI_TOKEN_TMEF` | `tmef` | `/api/pbi/v1/tempo_medio_entre_falhas` | Visão geral, disponibilidade |
| `PBI_TOKEN_DISP_EQUIPAMENTO_MES` | `disp-equipamento-mes` | `.../disponibilidade_equipamento_mes_a_mes` | Visão geral, disponibilidade |
| `PBI_TOKEN_MONITOR_REACAO` | `monitor-reacao` | `/api/pbi/v1/monitor_reacao` | Página Corretivas (fora do menu) |
| `PBI_TOKEN_MONITOR_ATENDIMENTO` | `monitor-atendimento` | `/api/pbi/v1/monitor_atendimento` | Página Corretivas (fora do menu) |
| `PBI_TOKEN_TPM` | `tpm` | `/api/pbi/v1/tempo_de_parada_medio` | Marcado pendente: último teste 404 |
| `PBI_TOKEN_DISP_EQUIPAMENTO` | `disp-equipamento` | `/api/pbi/v1/disponibilidade_equipamento` | Marcado pendente: 404. A versão mês a mês é a que responde |
| `PBI_TOKEN_OFICINA` | `oficina` | `/api/pbi/v1/oficina` | Header `API-KEY`. Marcado pendente: 401. Oficinas saem do texto da OS |

`PBI_DEFAULT_EMPRESA_IDS` existe no ambiente e pode ir vazio.

## Sala atual (o que será substituído)

Uma rota só: `/sala`. Quadro operacional, não player de 8 telas.

Regras em `lib/pbi/sala.ts` e `lib/pbi/business-hours.ts`:

- Janela de 30 dias pela data de abertura.
- Só equipamento médico com tag; sem instrumental; só oficinas da EC (allowlist em `oficina-ec.ts`; exclui Oficina Geral).
- Fora da fila: preventiva, TSE e calibração.
- Horas úteis **seg–sex 07:00–17:00** (`EC_HORA_INICIO` / `EC_HORA_FIM`). Feriados via `EC_FERIADOS` e `/sala/registros`.
- Situação pela meta de 1º atendimento × criticidade: no prazo, atenção (≤ 25% restante), atrasada, crítica (atraso > 1× a meta).
- Atualização a cada 2 minutos no browser.

O pedido da TV muda o expediente para **07:00–17:00** (`EC_HORA_INICIO` / `EC_HORA_FIM`) e pede feriados. Isso afeta também os indicadores que usam `diffBusinessMs` (Fase 7). Hoje o cálculo de hora útil usa `Date` de parede, não uma lib com fuso.

## O que reaproveitar

- `lib/pbi/client.ts` e o cache em memória.
- `lib/pbi/catalog.ts` (caminho, token e header de cada API).
- `app/api/pbi/[resource]` e `hooks/use-pbi.ts`.
- Tipos e parsers de data em `lib/pbi/types.ts` e `lib/pbi/dates.ts`.
- Filtro médico, oficinas da EC, OS cancelada, prazo de 1º atendimento por criticidade — como referência, não como UI da TV.
- SQLite (`lib/db`), volume `/data`, Dockerfile standalone.
- Logo em `public/aion-logo.png` (o prompt pede SVG/PNG oficial; o PNG já existe).
- Páginas de Indicadores, QMentum, Cadastros, Cronograma e Compras: funções ficam; o visual muda na Fase 7.

## O que refazer

- ~~Horário útil para 07:00, com feriados.~~ Feito (`lib/ec/horario-util.ts` + `lib/pbi/business-hours.ts`).
- ~~Snapshot em `GET /api/sala/snapshot`~~ Feito, com registros manuais.
- Tema claro AION a partir de `tokens.css`, quando o arquivo estiver no repo.
- Fontes Outfit e JetBrains Mono locais (Sala já usa JetBrains Mono).

## Próximo passo

Fase 6–7 em andamento na branch: registros manuais, horário 07h, README quiosque. Depois M365/compras e redeploy Coolify quando a Sala estiver testável.

# API de Ordens de Compra (robô E-Mails Compras)

Integração REST para persistir ordens de compra extraídas dos e-mails de `leandro.borges@aion.eng.br`.

A **TV Compras** (`/sala/compras`) usa estas OCs como fonte principal do painel (abertas = não canceladas, não `fora_escopo`, não `duplicada` e sem `data_entrega`). O funil legado e-mail→SC (`compra` / `/sala/pedidos`) continua disponível, mas secundário.

O robô (seg–sex 18:53 America/Sao_Paulo) envia upserts. A UI em `/sala/ordens-compra` lista, filtra e edita **categoria**, **numero_os**, **data_entrega**, **itens_entregues**, **status** (`fora_escopo` / `duplicada`) e **motivo_exclusao** — campos marcados em `editado_manualmente` **não** são sobrescritos em reenvios. `data_entrega` / `itens_entregues` / `motivo_exclusao` nunca vêm do robô.

## Base URL

```
https://<host-do-aionscope>/api/v1
```

Exemplos: `https://aionscope.exemplo.com/api/v1` (Coolify) ou `http://localhost:3000/api/v1` em desenvolvimento.

HTTPS é o esperado em produção; o app não força TLS (fica no proxy).

## Health (sem autenticação)

```http
GET /api/v1/health
```

Resposta: `{ "status": "ok" }`. Use para checar se o serviço está no ar **antes** de enviar o lote.

## Autenticação

Todas as demais rotas `/api/v1/ordens-compra*` exigem:

```http
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

A chave é **estática**, só para este escopo (ordens de compra). Sem header ou chave inválida → **401** `{ "erro": "não autorizado" }`.

### Como configurar a chave

Variável de ambiente no Coolify / `.env.local` (nunca commitar o valor real):

```
ORDENS_COMPRA_API_KEY=<gere-um-segredo-longo>
```

Há um placeholder em `.env.example`. Se a variável estiver vazia, a API recusa todas as chamadas autenticadas.

## Idempotência

A chave primária é `numero_ordem`. `PUT` e o lote fazem **upsert**: a mesma OC nunca duplica. Reenvio atualiza campos extraídos, **exceto** os marcados em `editado_manualmente` (categoria, numero_os, **status**, etc.) e **exceto** `data_entrega` / `itens_entregues` / `motivo_exclusao` (só Sala). Se a Sala marcar `fora_escopo` ou `duplicada`, o robô **não** reabre a OC na TV.

## Formatos

- JSON UTF-8
- Dinheiro em decimal com ponto (BRL), ex. `1234.56` (número ou string). Não usar vírgula.
- Datas ISO 8601 (`2026-10-05` ou `2026-10-05T18:53:00-03:00`)
- `null` é aceito para campos que o robô não extraíu

## Endpoints

### PUT `/api/v1/ordens-compra/{numero_ordem}`

Upsert de uma ordem. **201** se criada, **200** se atualizada. Corpo = objeto da ordem (`numero_ordem` no corpo, se presente, deve coincidir com a URL).

### POST `/api/v1/ordens-compra/lote`

Corpo: `{ "ordens": [ ... ] }` — máximo **500**.

Resposta:

```json
{ "criadas": 1, "atualizadas": 2, "erros": [{ "numero_ordem": "OC-x", "mensagem": "..." }] }
```

Itens inválidos entram em `erros`; os válidos são gravados.

### GET `/api/v1/ordens-compra`

Lista paginada. Query:

| Param | Uso |
| --- | --- |
| `desde` | ISO — `updated_at >= desde` |
| `categoria` | `Instrumental` \| `Equipamentos Médicos` \| `Outros` |
| `fornecedor` | trecho (case insensitive) |
| `mes` | `YYYY-MM` em `data_pedido` ou `data_ordem` |
| `data_pedido_de` / `data_pedido_ate` | intervalo em `data_pedido` (`YYYY-MM-DD`) |
| `os` ou `numero_os` | trecho da OS |
| `sem_valor` | `1` ou `true` |
| `abertas` | `1` ou `true` — não canceladas / `fora_escopo` / `duplicada` e sem `data_entrega` |
| `excluidas` | `1` ou `true` — só status `fora_escopo` |
| `duplicadas` | `1` ou `true` — só status `duplicada` |
| `ordenar` | `data_pedido` ou `padrao` (por `data_ordem`/`data_pedido`) |
| `page` | padrão 1 |
| `page_size` | padrão 50, máx. 500 |

Resposta: `{ "itens", "page", "page_size", "total" }`.

### GET `/api/v1/ordens-compra/{numero_ordem}`

**404** `{ "erro": "não encontrado" }` se não existir.

## Modelo

**OrdemCompra (robô):** `numero_ordem` (PK), `status` (`solicitado` \| `ordem_gerada` \| `cancelado` \| `fora_escopo` \| `duplicada`), `categoria` (`Instrumental` \| `Equipamentos Médicos` \| `Outros`), `data_pedido`, `data_ordem`, `itens[]`, `valor_total`, `fornecedor`, `numero_orcamento`, `numero_os`, `setor_equipamento`, `origem` (`manutencao_sjh` \| `oficina_aion_cc` \| `tramite_interno`), `solicitante`, `assunto_email`, `email_message_id`, `anexo_origem`, `confianca` (`alta` \| `media` \| `baixa`), `observacoes`, `ordens_relacionadas[]`.

**Campos só da Sala (TV):** `data_entrega` (data real da entrega), `itens_entregues` (texto do que chegou), `motivo_exclusao` (nota ao marcar `fora_escopo` / `duplicada`). Com `data_entrega` ou status `fora_escopo` / `duplicada` / `cancelado` a OC **sai** da lista aberta da TV.

Metadados de persistência na resposta: `fonte` (`email_robot`), `editado_manualmente`, `created_at`, `updated_at`, **`anexos[]`** (metadados; sem bytes).

**Item:** `descricao`, `quantidade`, `unidade`, `valor_unitario`, `valor_total`, `codigo`.

**Anexo:** `id`, `numero_ordem`, `nome_original`, `content_type`, `tamanho`, `fonte` (`email_robot` \| `manual`), `email_message_id`, `descricao`, `created_at`, `url` (Sala).

## Para o pod

O lote JSON **não** leva arquivos em base64. Fluxo:

1. `GET /api/v1/health` (sem auth)
2. Upsert da OC: `PUT /api/v1/ordens-compra/{numero}` **ou** `POST /api/v1/ordens-compra/lote` (JSON, como hoje)
3. Para cada arquivo do e-mail: `POST /api/v1/ordens-compra/{numero}/anexos` em **multipart** (campo `arquivo` ou `file`)
4. Opcional: `GET /api/v1/ordens-compra/{numero}` — a OC vem com `anexos[]`
5. Opcional: `GET /api/v1/ordens-compra/{numero}/anexos/{id}` — download/preview com Bearer (`?download=1` força attachment)

Auth em todas as rotas acima (exceto health): `Authorization: Bearer $ORDENS_COMPRA_API_KEY`.

Arquivos no volume: pasta `ordens-compra-anexos/` ao lado do SQLite (`DATABASE_PATH`), ou `ORDENS_COMPRA_ANEXOS_PATH`. Tabela `ordem_anexos`. Reenvios do lote **não** apagam anexos (aditivos).

MIME: `application/pdf`, `image/jpeg`, `image/png`, `image/webp` (também `image/heic` / `image/heif`). Máx. **~12 MB** por arquivo.

### Exemplo curl (após o upsert)

```bash
# 1) Upsert (inalterado)
curl -sS -X PUT "$BASE/ordens-compra/OC-2026-001" \
  -H "Authorization: Bearer $ORDENS_COMPRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"numero_ordem":"OC-2026-001","status":"ordem_gerada","fornecedor":"Exemplo","itens":[]}'

# 2) Anexo PDF (campo arquivo; alias file também vale)
curl -sS -X POST "$BASE/ordens-compra/OC-2026-001/anexos" \
  -H "Authorization: Bearer $ORDENS_COMPRA_API_KEY" \
  -F "arquivo=@./solicitacao.pdf;type=application/pdf" \
  -F "email_message_id=AAMk..." \
  -F "descricao=PDF do e-mail de compras"

# 3) Conferir metadados na OC
curl -sS "$BASE/ordens-compra/OC-2026-001" \
  -H "Authorization: Bearer $ORDENS_COMPRA_API_KEY"

# 4) Baixar anexo (Bearer)
curl -sS -o /tmp/oc.pdf \
  -H "Authorization: Bearer $ORDENS_COMPRA_API_KEY" \
  "$BASE/ordens-compra/OC-2026-001/anexos/1?download=1"
```

**404** se a OC ainda não existir (faça o upsert antes). **201** no POST de anexo com o metadado criado.

### Sala (sem API key do robô)

- `GET/POST /api/sala/ordens-compra/{numero}/anexos` — listar / upload manual (`fonte=manual`)
- `GET /api/sala/ordens-compra/{numero}/anexos/{id}` — preview inline (imagem/PDF) ou `?download=1`
- `DELETE /api/sala/ordens-compra/{numero}/anexos/{id}` — remove metadado + arquivo

Na UI `/sala/ordens-compra`, expandir a OC → seção **Anexos (fotos / PDF)**.

## Erros

- **400** validação: `{ "erro", "detalhes": [{ "campo", "mensagem" }] }`
- **401** autenticação
- **422** enumeração desconhecida (mesmo formato de `detalhes`)
- **404** GET de OC inexistente
- **5xx** sobem como erro de servidor

## Exemplo mínimo (PUT)

```bash
curl -sS -X PUT "$BASE/ordens-compra/OC-2026-001" \
  -H "Authorization: Bearer $ORDENS_COMPRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "numero_ordem": "OC-2026-001",
    "status": "ordem_gerada",
    "categoria": "Instrumental",
    "data_pedido": "2026-10-05",
    "valor_total": "1500.00",
    "fornecedor": "Fornecedor Exemplo",
    "numero_os": "123456789",
    "origem": "manutencao_sjh",
    "confianca": "alta",
    "itens": [
      { "descricao": "Pinça", "quantidade": 2, "unidade": "un", "valor_unitario": "750.00", "valor_total": "1500.00" }
    ]
  }'
```

## UI interna e TV

- `/sala/ordens-compra` — abas **Abertas** / **Excluídas** / **Duplicadas** / **Todas**; filtros (categoria, fornecedor, mês, intervalo de Pedido/`data_pedido`, OS, sem valor, ordenar por Pedido); datas **Pedido (e-mail)** = `data_pedido` e **Resposta / OC** = `data_ordem` (mesmos rótulos da TV); botões **Duplicada**, **Fora do escopo / outro cliente**, **Marcar entregue** e **Desfazer (voltar à TV)**; **anexos** (upload / preview / download) ao expandir a OC. Usa `PATCH /api/sala/ordens-compra` e rotas `/api/sala/ordens-compra/{numero}/anexos*` (sem API key do robô). Pista leve de possível duplicata na página (mesmo orçamento / e-mail / valor+fornecedor+pedido).
- `/sala/compras` (TV) — funil Pedido (e-mail) → Resposta/OC → Entrega no mês; lista OCs abertas com datas e aging (exclui entregues, `cancelado`, `fora_escopo` e `duplicada`); rodapé aponta para a tela de edição.

### PATCH Sala (exemplo)

```bash
curl -sS -X PATCH "$HOST/api/sala/ordens-compra" \
  -H "Content-Type: application/json" \
  -d '{
    "numero_ordem": "OC-2026-001",
    "numero_os": "123456789",
    "marcar_entregue": true,
    "itens_entregues": "2 pinças"
  }'
```

Excluir da TV (outro cliente / não realizado), sem apagar:

```bash
curl -sS -X PATCH "$HOST/api/sala/ordens-compra" \
  -H "Content-Type: application/json" \
  -d '{
    "numero_ordem": "OC-2026-001",
    "marcar_fora_escopo": true,
    "motivo_exclusao": "outro cliente"
  }'
```

Marcar duplicata importada (também sai da TV; `editado_manualmente.status` protege):

```bash
curl -sS -X PATCH "$HOST/api/sala/ordens-compra" \
  -H "Content-Type: application/json" \
  -d '{
    "numero_ordem": "OC-2026-001",
    "marcar_duplicada": true,
    "motivo_exclusao": "mesmo orçamento"
  }'
```

# API de Ordens de Compra (robô E-Mails Compras)

Integração REST para persistir ordens de compra extraídas dos e-mails de `leandro.borges@aion.eng.br`.

A **TV Compras** (`/sala/compras`) usa estas OCs como fonte principal do painel (abertas = não canceladas e sem `data_entrega`). O funil legado e-mail→SC (`compra` / `/sala/pedidos`) continua disponível, mas secundário.

O robô (seg–sex 18:53 America/Sao_Paulo) envia upserts. A UI em `/sala/ordens-compra` lista, filtra e edita **categoria**, **numero_os**, **data_entrega** e **itens_entregues** — campos marcados em `editado_manualmente` **não** são sobrescritos em reenvios. `data_entrega` / `itens_entregues` nunca vêm do robô.

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

A chave primária é `numero_ordem`. `PUT` e o lote fazem **upsert**: a mesma OC nunca duplica. Reenvio atualiza campos extraídos, **exceto** os marcados em `editado_manualmente` (categoria, numero_os, etc.) e **exceto** `data_entrega` / `itens_entregues` (só Sala).

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
| `os` ou `numero_os` | trecho da OS |
| `sem_valor` | `1` ou `true` |
| `abertas` | `1` ou `true` — não canceladas e sem `data_entrega` |
| `page` | padrão 1 |
| `page_size` | padrão 50, máx. 500 |

Resposta: `{ "itens", "page", "page_size", "total" }`.

### GET `/api/v1/ordens-compra/{numero_ordem}`

**404** `{ "erro": "não encontrado" }` se não existir.

## Modelo

**OrdemCompra (robô):** `numero_ordem` (PK), `status` (`solicitado` \| `ordem_gerada` \| `cancelado`), `categoria` (`Instrumental` \| `Equipamentos Médicos` \| `Outros`), `data_pedido`, `data_ordem`, `itens[]`, `valor_total`, `fornecedor`, `numero_orcamento`, `numero_os`, `setor_equipamento`, `origem` (`manutencao_sjh` \| `oficina_aion_cc` \| `tramite_interno`), `solicitante`, `assunto_email`, `email_message_id`, `anexo_origem`, `confianca` (`alta` \| `media` \| `baixa`), `observacoes`, `ordens_relacionadas[]`.

**Campos só da Sala (TV):** `data_entrega` (data real da entrega), `itens_entregues` (texto do que chegou). Com `data_entrega` preenchida a OC **sai** da lista aberta da TV.

Metadados de persistência na resposta: `fonte` (`email_robot`), `editado_manualmente`, `created_at`, `updated_at`.

**Item:** `descricao`, `quantidade`, `unidade`, `valor_unitario`, `valor_total`, `codigo`.

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

- `/sala/ordens-compra` — filtros (categoria, fornecedor, mês, OS, sem valor, **só abertas** por padrão), categoria, nº OS, data de entrega, o que foi entregue, botão **Marcar entregue**. Usa `PATCH /api/sala/ordens-compra` (sem API key do robô).
- `/sala/compras` (TV) — funil Pedido (e-mail) → Resposta/OC → Entrega no mês; lista OCs abertas com datas e aging; rodapé aponta para a tela de edição.

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

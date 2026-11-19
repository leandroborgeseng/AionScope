# API do bot (`/api/bot/v1`)

Só leitura. Os dados saem da cópia em `pbi_cache`. A chamada não consulta o Effort.

O cookie do painel não entra aqui. `/api/cadastros/bot-usuarios` continua exigindo a sessão de administrador.

## Variáveis

| Variável | Uso |
| --- | --- |
| `AIONSCOPE_BOT_TOKEN` | Bearer. Sem ela, ou com menos de 32 caracteres, toda rota responde 503. Fica só no ambiente (Railway), nunca no código. |
| `AIONSCOPE_BOT_AJUDA_EFFORT_CALIBRACAO` | Texto de `comoConsultarNoEffort`. Vazia ou ausente, o campo vem `null`. |
| `AIONSCOPE_BOT_LIMITE` | Chamadas por janela, por token e por pessoa. Padrão 600. |
| `AIONSCOPE_BOT_LIMITE_MS` | Janela em milissegundos. Padrão 60000. |

Deploy em produção só com OK do Leandro. Esta API não envia mensagem nem lote.

## Chamada

```bash
curl -sS -H "Authorization: Bearer token-ficticio-zzteste-0123456789abcd" \
  -H "X-Bot-Telefone: +55 11 90000-0001" \
  "https://scope.aion.eng.br/api/bot/v1/health"
```

Nas rotas de dado, o telefone precisa estar cadastrado, ativo e aprovado. Duas grafias do mesmo número (com ou sem `+55`, com ou sem o nono dígito) caem no mesmo cadastro. `GET /api/bot/v1/usuario` usa a mesma normalização e devolve a situação real.

## Rotas (só GET)

| Rota | Resposta |
| --- | --- |
| `GET /api/bot/v1/health` | `{ "ok": true }` |
| `GET /api/bot/v1/meta/freshness` | `fetchedAt` e `idadeSegundos` por recurso |
| `GET /api/bot/v1/os?abertas=1` | OS abertas. Filtros `setor`, `tag`, `equipamento`. `limit` ou `pageSize` (1 a 100), `offset` ou `cursor` |
| `GET /api/bot/v1/os/{numero}` | Situação e histórico (só datas) |
| `GET /api/bot/v1/equipamentos/{tag}` | Status, até 5 OS e a próxima preventiva |
| `GET /api/bot/v1/calibracao?setor=&ano=YYYY` | Meses e quantidade de equipamentos. Sem lista de equipamentos |
| `GET /api/bot/v1/usuario` | Situação do telefone. Única rota que responde 200 para quem não está aprovado |

`indicadores/resumo` não entra: o resumo que já existe é o card de custo do parque, com valor em R$ na versão interna. Não dá para reaproveitar sem montar outro indicador.

Quem tem setores vinculados em `bot_usuario_setor` só consulta esses setores na calibração. Sem vínculo, não há filtro de setor.

A busca do setor ignora maiúsculas e acentos. Um setor devolve o plano. Dois a cinco devolvem `status: "ambiguo"` e a lista numerada, com o nome do Effort em maiúsculas. Mais de cinco devolvem `status: "refinar"`, sem a lista. Nenhum devolve `status: "nao_encontrado"` com HTTP 404. Setor sem calibração no ano devolve `status: "ok"` e `meses: []`.

Quem está ativo recebe `situacao`, `podeResponder: true`, `primeiroNome`, `papel`, `setor` e `permissoes`. Na v1 o papel só rotula: todo ativo recebe `os`, `equipamentos` e `calibracao`. `indicadores` não entra, porque essa rota não existe. Pendente, inativo e recusado recebem só `situacao`, `podeResponder: false` e `permissoes: []`. Fora do cadastro:

```json
{ "situacao": "nao_cadastrado", "podeResponder": false, "permissoes": [] }
```

A resposta não traz telefone, e-mail, motivo de recusa, id interno nem data.

Exemplos:

```bash
curl -sS -H "Authorization: Bearer token-ficticio-zzteste-0123456789abcd" \
  -H "X-Bot-Telefone: +55 11 90000-0001" \
  "https://scope.aion.eng.br/api/bot/v1/usuario"

curl -sS -H "Authorization: Bearer token-ficticio-zzteste-0123456789abcd" \
  -H "X-Bot-Telefone: +55 11 90000-0001" \
  "https://scope.aion.eng.br/api/bot/v1/os?abertas=1&setor=UTI&limit=20"

curl -sS -H "Authorization: Bearer token-ficticio-zzteste-0123456789abcd" \
  -H "X-Bot-Telefone: +55 11 90000-0001" \
  "https://scope.aion.eng.br/api/bot/v1/calibracao?setor=UTI&ano=2026"
```

Cada resposta de dado traz `fetchedAt` (ISO) e `idadeSegundos`. Cópia com mais de 7 dias e atualização falha responde 503, com a data da cópia, e não devolve lista vazia no lugar do erro.

## Códigos

| Código | Quando |
| --- | --- |
| 200 | Consulta aceita. Calibração ambígua ou a refinar também. |
| 400 | Página inválida, `limit` ou `pageSize` acima de 100, `abertas` diferente de 1, setor ou ano ausente. |
| 401 | Sem Bearer ou Bearer errado. Corpo só `{ "ok": false }`. |
| 403 | Nas rotas de dado: telefone ausente, mal formatado, fora do cadastro, pendente, inativo ou recusado. O corpo não diz o motivo. Em `/usuario`, só o telefone ausente ou mal formatado. |
| 404 | OS, tag ou setor não encontrado. A mensagem da OS e da tag é "Não encontrei.". A do setor é "setor não encontrado". |
| 405 | POST, PUT, PATCH e DELETE. Cabeçalho `Allow: GET`. |
| 429 | Limite do token ou da pessoa. Cabeçalho `Retry-After` em segundos. |
| 503 | Token não configurado ("API desativada.") ou cópia ausente/vencida. |

Não saem valor em R$, endereço, CEP, anexo, e-mail nem texto livre (ocorrência, causa, observação, descrição). Saem nome do solicitante, nome do técnico, matrícula e responsável. A auditoria guarda rota, hash da query, telefone mascarado, status e latência. Não guarda o corpo.

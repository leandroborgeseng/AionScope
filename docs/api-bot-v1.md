# API do bot (`/api/bot/v1`)

Só leitura. Os dados saem da cópia em `pbi_cache`. A chamada não consulta o Effort.

O cookie do painel não entra aqui. `/api/cadastros/bot-usuarios` continua exigindo a sessão de administrador.

## Variáveis

| Variável | Uso |
| --- | --- |
| `AIONSCOPE_BOT_TOKEN` | Bearer. Sem ela, ou com menos de 32 caracteres, toda rota responde 503. Fica só no ambiente (Railway), nunca no código. |
| `AIONSCOPE_BOT_AJUDA_EFFORT_CALIBRACAO` | Texto de `comoConsultarNoEffort`. Vazia ou ausente, o campo vem `null`. |
| `AIONSCOPE_BOT_LIMITE` | Chamadas por janela, por token e por pessoa. Padrão 600. Em `/health` o limite é só do token. |
| `AIONSCOPE_BOT_LIMITE_MS` | Janela em milissegundos. Padrão 60000. |

Deploy em produção só com OK do Leandro. Esta API não envia mensagem nem lote.

## Chamada

`GET /health` exige só o Bearer. O cabeçalho `X-Bot-Telefone` não é obrigatório nessa rota.

```bash
curl -sS -H "Authorization: Bearer token-ficticio-zzteste-0123456789abcd" \
  "https://scope.aion.eng.br/api/bot/v1/health"
```

Nas outras rotas, o telefone precisa estar cadastrado, ativo e aprovado. Duas grafias do mesmo número (com ou sem `+55`, com ou sem o nono dígito) caem no mesmo cadastro. `GET /api/bot/v1/usuario` usa a mesma normalização e devolve a situação real.

## Escopo

Engenharia clínica e equipamentos médicos. A comparação da oficina é normalizada: sem acento, sem diferença de caixa e com espaços extras colapsados.

Entra a oficina exatamente `ENGENHARIA CLÍNICA`.

Também entram duas oficinas em que a cópia registra preventiva e calibração de equipamento médico fora desse nome (as mesmas do volume de plano): `PREVENTIVA EQUIPAMENTOS` e `CALIBRAÇÃO DE EQUIPAMENTOS`. Refrigeração, predial, obras e preventiva de manutenção predial ficam de fora.

A visão `/os/por-setor` é mais estreita: só corretiva (`tipoManutencao` contém `CORRETIVA`, na mesma normalização) e só a oficina `ENGENHARIA CLÍNICA`.

O cronograma da cópia não traz oficina no tipo. Linha sem `Oficina` permanece. Se o campo vier preenchido e a oficina estiver fora do recorte, a linha sai. OS e tag fora do recorte respondem o mesmo 404 de quem não existe (`Não encontrei.`), sem dizer que o registro existe.

## Setor

A busca é igualdade normalizada (sem acento, sem caixa, espaços extras colapsados). Não é mais substring: `Centro Cirúrgico` não traz Ambulatorial nem Farmácia Satélite, e um pedaço curto que não fecha um nome não devolve lista vazia.

Apelidos ficam na tabela `bot_setor_apelido` (`apelido`, `nome`). A migration 019 grava `CC` → `Centro Cirúrgico`. Um apelido com mais de um nome, ou um nome que também existe à parte, devolve candidatos. Novo apelido é um `INSERT` nessa tabela; esta versão não tem tela para isso.

Zero nomes: HTTP 404, `status: "nao_encontrado"`, mensagem `setor não encontrado`, sem lista. Dois a cinco: HTTP 200, `status: "ambiguo"` e a lista numerada, com o nome em maiúsculas. Mais de cinco: HTTP 200, `status: "refinar"`, sem a lista. Setor que casou e não tem dado no ano ou nas abertas devolve a lista vazia (ou `meses: []`), com o resumo no caso das OS.

Papéis assistenciais (`Chefia de Enfermagem` e `Solicitante assistencial`): o setor é o vínculo pessoa-setor de `bot_usuario_setor`. O parâmetro `setor` é ignorado. Sem vínculo, a resposta não traz dado e pede o cadastro:

```json
{ "ok": false, "status": "setor_nao_cadastrado", "message": "Cadastre o setor deste usuário para consultar." }
```

HTTP 200. Vários vínculos: `/os` e o equipamento reúnem todos; a calibração devolve `ambiguo` com esses nomes, porque o plano é de um setor só.

`Diretoria/Gestão` e `Manutenção` filtram qualquer setor. O vínculo não restringe. Os demais papéis (Compras) continuam como antes: com vínculo, só esses setores; sem vínculo, o parâmetro escolhe qualquer um.

## Rotas (só GET)

| Rota | Resposta |
| --- | --- |
| `GET /api/bot/v1/health` | `{ "ok": true }`. Só o Bearer |
| `GET /api/bot/v1/meta/freshness` | `fetchedAt` e `idadeSegundos` por recurso |
| `GET /api/bot/v1/os?abertas=1` | OS abertas do recorte. Filtros `setor`, `tag`, `equipamento`. `limit` ou `pageSize` (1 a 100), `offset` ou `cursor`. Traz `resumo` |
| `GET /api/bot/v1/os/{numero}` | Situação, histórico (só datas), etapa e tempos. Sem matrícula nem `solicitacao` para quem não é gestão ou manutenção |
| `GET /api/bot/v1/os/por-setor?abertas=1&tipo=corretiva` | Corretivas abertas da EC, agrupadas por setor e, dentro do setor, por etapa. Só Diretoria/Gestão e Manutenção. `setor` opcional para esses papéis. `limite` (padrão 20, teto 100) e `cursor` ou `pagina`. Devolve `total` e `proximoCursor` |
| `GET /api/bot/v1/equipamentos/{tag}` | Status, até 5 OS do recorte e a próxima preventiva. Tag fora do recorte é o mesmo 404 |
| `GET /api/bot/v1/calibracao?setor=&ano=YYYY` | Meses e quantidade de equipamentos. `ano` é opcional; vazio, vale o ano corrente. Sem lista de equipamentos |
| `GET /api/bot/v1/usuario` | Situação do telefone. Única rota que responde 200 para quem não está aprovado |

`indicadores/resumo` não entra: o resumo que já existe é o card de custo do parque, com valor em R$ na versão interna. Não dá para reaproveitar sem montar outro indicador.

`resumo` de `/os?abertas=1` é calculado no conjunto já filtrado (recorte e setor), antes da página:

```json
{ "total": 2, "porPrioridade": { "Alta": 1 }, "maisAntiga": { "numero": "1001", "abertura": "01/03/2026 10:00" }, "semTecnico": 1 }
```

Não há `vencidas`, prazo, limite nem SLA nesse bloco. `maisAntiga` é a abertura mais antiga, não um vencimento.

`/os/por-setor` devolve `setores[]` com `setor`, `quantidade` e `porEtapa[]`, mais `total` (OS do filtro, antes da página), `limite` e `proximoCursor` (`null` na última página). `quantidade` conta as OS daquela página no setor. Cada etapa tem `quantidade` e `os`. Cada OS traz `numero`, `equipamento`, `tag`, `solicitacao`, `etapa`, `manutencaoExterna`, `pendenciaCompra`, `abertura`, `dataAtendimento`, `tempoAteAtendimento` (`{ horas, dias }` inteiros, ou `null`), `diasNaEtapa`, `diasNaEtapaOrigem` e `textoEtapa`.

`setor` usa a mesma decisão das outras rotas (`decidirSetor`). Diretoria/Gestão e Manutenção podem filtrar qualquer setor da cópia. Os outros papéis continuam 403 `{ "ok": false }`, com ou sem `setor`. `limite` padrão 20, máximo 100. `cursor` é opaco; `pagina` começa em 1. Os dois juntos, ou limite fora da faixa, respondem 400.

`etapa` sai de `etapaOs` (`lib/ec/etapas.ts`): Sem 1º atendimento, Em atendimento, Aguarda peça/compra, Reparo externo, Contrato/assistência, Teste e devolução. As flags vêm de `montarOsDetalhe`.

`solicitacao` reutiliza `textoSolicitacaoOs` (`lib/ec/os-detalhe.ts`): o primeiro texto entre `ObservacaoDaRequisicao`, `Servico`, `Ocorrencia` e `ObservacaoDaOS`. Espaços colapsados. A máscara roda antes do corte de 280: o corte não parte `[cpf]`, `[telefone]` nem `[e-mail]`, e não termina no meio de uma sequência de dígitos. Só Diretoria/Gestão e Manutenção recebem o campo, na visão por setor e em `/os/{numero}`. Papel assistencial não recebe a chave.

A máscara, nesta ordem: e-mail `local@domínio` com ou sem TLD (`nome@intranet` inclusive); telefone com `+55` ou `55`, DDD entre parênteses, `DD NNNNN-NNNN`, `DD-NNNNN-NNNN`, `DD 9 NNNN-NNNN`, tronco `0DD` e número sem DDD. Sem DDD, só vira `[telefone]` o de 9 dígitos que começa em `9` (celular) ou o de 8 dígitos que começa em `2`–`5` (fixo). `horario 0800-1200` e `NS 1234-5678` ficam. O separador antes do número permanece (`tel 55…` fica `tel [telefone]`). Não há exceção de contexto: `OS 3333-4444` sai `OS [telefone]`. Onze dígitos contínuos com DDD válido (Anatel) e assinante começando em `9` saem `[telefone]`, mesmo quando o dígito verificador de CPF também fecha. Sem esse formato de celular, CPF com os dois dígitos verificadores válidos sai `[cpf]`. Dez dígitos contínuos com DDD válido e 3º dígito de 2 a 5 (fixo, ex. `1633334444`) saem `[telefone]`. CPF desenhado com separador (`NNN.NNN.NNN-NN`, `NNN NNN NNN NN`, `NNN.NNN.NNN.NN`, `NNNNNNNNN-NN`, `NNNNNNNNN.NN`) sai `[cpf]`.

**Ressalva para o DPO:** nome de paciente em texto livre não é detectável por essa máscara. O campo pode continuar com nome próprio. A máscara cobre CPF, telefone e e-mail, não anamnese.

`diasNaEtapa` é dia civil em America/Sao_Paulo. A origem, nesta ordem:

1. `pendencia` — `PendenciaAbertaEm` da listagem analítica (data em que a pendência aberta foi registrada). Não usa `PrazoDeEncerramentoPendencia`, que é prazo. `DataAberturaPendencia` existe na OS resumida, que esta API não lê.
2. `atendimento` — `DataDoAtendimento`, se não houver data de pendência.
3. `abertura` — se ainda não houve atendimento. `dataAtendimento` e `tempoAteAtendimento` vêm `null`.

`tempoAteAtendimento` é a duração da abertura até o primeiro atendimento, em horas e dias inteiros (o resto fica de fora). Não é SLA. `textoEtapa` é curto: `Aguarda peça/compra há 12 dias`, `Em atendimento há 1 dia`, `Sem 1º atendimento desde hoje`.

Quem está ativo recebe `situacao`, `podeResponder: true`, `primeiroNome`, `papel`, `setor` e `permissoes`. Na v1 o papel deixa de ser só rótulo nestas rotas: assistência fica no próprio setor; gestão e manutenção enxergam matrícula, solicitação e a visão por setor. Todo ativo continua recebendo `os`, `equipamentos` e `calibracao` na lista de permissões. `indicadores` não entra, porque essa rota não existe. Pendente, inativo e recusado recebem só `situacao`, `podeResponder: false` e `permissoes: []`. Fora do cadastro:

```json
{ "situacao": "nao_cadastrado", "podeResponder": false, "permissoes": [] }
```

A resposta não traz telefone, e-mail, motivo de recusa, id interno nem data.

Matrícula do técnico e do responsável (`matriculaTecnico`, `matriculaResponsavel`) só saem para Manutenção e Diretoria/Gestão. Nos outros papéis a chave não vem.

Exemplos:

```bash
curl -sS -H "Authorization: Bearer token-ficticio-zzteste-0123456789abcd" \
  -H "X-Bot-Telefone: +55 11 90000-0001" \
  "https://scope.aion.eng.br/api/bot/v1/usuario"

curl -sS -H "Authorization: Bearer token-ficticio-zzteste-0123456789abcd" \
  -H "X-Bot-Telefone: +55 11 90000-0001" \
  "https://scope.aion.eng.br/api/bot/v1/os?abertas=1&setor=Centro%20Cirurgico&limit=20"

curl -sS -H "Authorization: Bearer token-ficticio-zzteste-0123456789abcd" \
  -H "X-Bot-Telefone: +55 11 90000-0001" \
  "https://scope.aion.eng.br/api/bot/v1/os/por-setor?abertas=1&tipo=corretiva&limite=20"

curl -sS -H "Authorization: Bearer token-ficticio-zzteste-0123456789abcd" \
  -H "X-Bot-Telefone: +55 11 90000-0001" \
  "https://scope.aion.eng.br/api/bot/v1/calibracao?setor=Centro%20Cirurgico&ano=2026"
```

Cada resposta de dado traz `fetchedAt` (ISO) e `idadeSegundos`, exceto o pedido de cadastro de setor, que não abre a cópia. Cópia com mais de 7 dias e atualização falha responde 503, com a data da cópia, e não devolve lista vazia no lugar do erro.

## Códigos

| Código | Quando |
| --- | --- |
| 200 | Consulta aceita. Calibração ou OS ambígua, a refinar, ou setor não cadastrado (`ok: false`) também. |
| 400 | Página inválida, `limit` ou `pageSize` acima de 100, `limite` da visão por setor fora de 1–100, `cursor` e `pagina` juntos, `abertas` diferente de 1, `tipo` diferente de `corretiva` na visão por setor, setor ausente na calibração (fora da assistência) ou ano fora de 2000–2100. |
| 401 | Sem Bearer ou Bearer errado. Corpo só `{ "ok": false }`. |
| 403 | Nas rotas de dado: telefone ausente, mal formatado, fora do cadastro, pendente, inativo ou recusado. O corpo não diz o motivo. Em `/usuario`, só o telefone ausente ou mal formatado. Em `/os/por-setor`, também quem não é Diretoria/Gestão nem Manutenção. `/health` não usa este código por causa do telefone. |
| 404 | OS, tag ou setor não encontrado. A mensagem da OS e da tag é "Não encontrei.", também quando existem e estão fora do recorte ou do setor da assistência. A do setor é "setor não encontrado". |
| 405 | POST, PUT, PATCH e DELETE com Bearer válido. Cabeçalho `Allow: GET`. |
| 429 | Limite do token ou da pessoa. Cabeçalho `Retry-After` em segundos. |
| 503 | Token não configurado ("API desativada.") ou cópia ausente/vencida. |

Não saem valor em R$, endereço, CEP, anexo nem e-mail de cadastro. Texto livre de ocorrência não sai como campo próprio. `solicitacao`, quando sai, é o recorte mascarado acima. A auditoria guarda rota, hash da query, telefone mascarado, status e latência. Não guarda o corpo. Chamada sem Bearer ou com Bearer inválido (401, 405 de método sem token e 503 "API desativada.") não grava linha: só entra num contador em memória, com no máximo um log por minuto. POST, PUT, PATCH e DELETE sem Bearer continuam 405 com `Allow: GET`, mas não gravam auditoria.

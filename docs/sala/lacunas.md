# Lacunas da Sala — para decidir

Nada abaixo será inventado na tela. Onde não houver dado, o bloco mostra "—".

## Decisões de 01/10/2026

1. **1º atendimento da TV = `DataDoAtendimento`.** A API não traz o lançamento de mão de obra.
2. **Meta = texto do Effort**, não os 4h / 24h / 72h do app. Criticidade do equipamento: Alta 2h, Média 4h, Baixa 12h. Prioridade da OS: Alta criticidade 2h, Alto 4h, Média 12h, Baixa 72h.
3. **`EndOfLife` em 01/01/2050 vale.** É a previsão de fim de vida registrada na Anvisa, não um placeholder.
4. **Id do São Joaquim = `2`.** Teste de 01/10/2026: 1.892 equipamentos, todas as tags `HSJ-`, setores do HSJ (Centro Cirúrgico 10A, Emergência, UTI). O id `01`/`1` é outro parque e não deve ser usado. Gravado em `PBI_DEFAULT_EMPRESA_IDS`.

## ❌ não existe na API

1. **Lançamento de mão de obra.** Sem data do primeiro, data do último nem técnico de cada lançamento. `HorasTrabalhadas` é só um total.
2. **Etapa "contrato".** A situação da OS não tem esse valor.
3. **Etapa "teste e devolução".** O tipo "AGUARDANDO DEVOLUÇÃO AO SETOR" existe no cadastro e quase não aparece nas OS.
4. **Início e fim da parada.** Proxy aprovado: Abertura→Fechamento da OS. Disponibilidade mensal tem `DiasParado` / flag, sem instante.
5. **TPM.** Endpoint 404. A TV usa **TMEF/MTBF** (mediana) no cartão correspondente.
6. **Oficina como API.** Endpoint 404. O nome da oficina já vem em cada OS.
7. **Fabricante descontinuado / sem peça.** Usa `EndOfService`: se a data já passou, conta como “sem peça / descontinuado” no ciclo de vida.
8. **Vida útil em anos.** Só as datas `EndOfLife` e `EndOfService`.
9. **Data do plano.** `ProximaRealizacao` é código; o parser ancora no mês. Cumprimento = previsto (cronograma) × executado (OS fechadas). Laudo = ciclo da OS.
10. **Laudo.** Anexo não tem tipo nem data de emissão → proxy = OS fechada.
11. **Impedimento operacional** (motivo + nova data) — registro manual em `/sala/registros`.
12. ~~**Compras por e-mail**~~ → **feito:** sync M365 + CRUD em `/sala/pedidos`; TV em `/sala/compras`.
13. **P04–P07** aquisições/obras/treinamento/recall — manuais em registros; **fora dos cartões da TV** (só P01–P03).
14. **Contratos.** Token vazio. **Fora do KPI custo/parque e da TV.**
15. **Id `1` não é o HSJ.** O id correto é `2`.

## ⚠️ existe, mas não é o que o desenho pede

- 1º atendimento da TV: `DataDoAtendimento` (decidido).
- Meta da TV: horas escritas no Effort (decidido). O app antigo continua em 4h / 24h / 72h até a Fase 7.
- Fila "sem técnico": `Responsavel` vem sempre preenchido.
- "Onde a OS parou" na barra de idade: só dá para aproximar com pendência, tipo EXT e assistência.
- `EndOfLife` = 01/01/2050 entra na conta. É a previsão Anvisa daquele equipamento (decidido).
- Tag ausente em 79% das OS. A TV médica ignora essas linhas; chamados de setor não entram.
- Custo da OS não separa peça, serviço e terceiro, e muita linha é zero.

## O que já dá para montar sem decisão

Abertura, fechamento, situação (aberta/fechada/cancelada/pendente), oficina, tipo de manutenção, prioridade da OS, responsável, causa (com o vazio explícito), tag quando houver, valor de substituição, status ativo/inativo, anexos por nome de arquivo, TMEF (`MTBF`).

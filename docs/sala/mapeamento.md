# Mapeamento — telas da Sala × APIs reais

Amostra de 01/10/2026 em `docs/sala/api-samples/` (fora do git). OS: 22.015 linhas, `DoisAnosAtuais`. Equipamentos: 3.039, inclusive inativos. Contratos não consultado (`PBI_TOKEN_CONTRATOS` vazio).

Escopo da TV, quando a tela for de OS: tag de equipamento médico + oficinas da Engenharia Clínica (`lib/pbi/oficina-ec.ts`: equals allowlist; **exclui Oficina Geral**).

## Respostas diretas

**Status da OS (aguardando peça, reparo externo, contrato)?**
Situação oficial só tem quatro valores: **Aberta (1.633), Fechada (19.453), Cancelada (870), Pendente (59)**. Não existe status "contrato".
O detalhe mora em texto:
- `Pendencia` (1,5% das OS): aguardando compra (241), peça (43), manutenção externa (22), orçamento, orientação do fornecedor.
- `PendenciaAberta` (só 30 OS): compra 24, externo 3, peça 2, orçamento 1.
- `Tipo`: INT 21.785, EXT 230.
- `Assistencia`: nome da empresa, 201 OS.
- `TipoDeManutencao` traz "A - MAN. EXTERNA ENGENHARIA CLÍNICA", "ASSISTÊNCIA TÉCNICA EXTERNA" e "A - SOLICITAÇÃO DE COMPRA ENGENHARIA CLÍNICA".
- `ObservacaoDaOS` às vezes começa com "CONTRATO: …" e `ObservacaoDaPendencia` traz "S.C. 133921". É texto livre.

**Técnico do lançamento de mão de obra? Data do 1º e do último?**
Não. `HorasTrabalhadas` é um total (`03:30`), sem lista de lançamentos. Não há data do primeiro nem do último lançamento. O que existe: `Responsavel` (100%), `TecnicoResolvedor` (57,5%) e `DataDoAtendimento` (62,6%). O design define 1º atendimento como o primeiro lançamento. A API não entrega esse lançamento.

**Meta de 1º atendimento por criticidade/prioridade?**
Não há número solto. Decisão: usar o texto do Effort.
- Equipamento `Criticidade` (79% preenchida): Alta = 2h, Média = 4h, Baixa = 12h.
- Se o equipamento não tiver criticidade, OS `Prioridade`: Alta criticidade = 2h, Alto = 4h, Média = 12h, Baixa = 72h.
- `DataLimiteDoAtendimento` preenchida em 0,6% — não é a fonte.
A regra antiga do app (4h / 24h / 72h) fica de fora da Sala nova.

**Causa da corretiva no encerramento?**
Sim: `Causa`, 17 valores (desgaste natural, descuido, erro operacional/mau uso, obsoleto…). Preenchida em 53,5% de todas as OS. Nas corretivas a fatia vazia é o "sem causa" do indicador.

**Equipamentos: aquisição, fabricação, valor, vida útil, fabricante descontinuado?**
- Aquisição: `DataDeAquisicao`, vazia em 60%.
- Fabricação: `DataDeFabricacao`, vazia em 98%.
- Valor: `ValorDeAquisicao` (muitos `0,00`) e `ValorDeSubstituicao`.
- Vida útil: não há campo em anos. Há data `EndOfLife` (27% vazia; 580 itens em 01/01/2050, previsão Anvisa — usar essa data) e `EndOfService`.
- Descontinuado: não existe. `EndOfService` é a data mais próxima. "EQUIPAMENTO OBSOLETO" aparece como causa de OS, não no cadastro.

**DISP_EQUIPAMENTO mostra início e fim da parada?**
`disponibilidade_equipamento` respondeu **404**. A versão mês a mês com `empresasId=2` é o HSJ: **1.892 equipamentos, todas as tags HSJ-** (Centro Cirúrgico 10A, Emergência, UTI). No último mês, 2 com `PossuiOSParadaSemFuncionamento`. A linha é mensal (`DiasParado`, percentual, TMEF/TMPR), sem data de início e fim. `Parada`/`Funcionamento` na OS continuam quase vazias. O id `1` é outro parque.

**Como ligar OS ↔ equipamento ↔ cronograma ↔ anexos?**
- `equipamentos.Tag` = `OS.Tag` = `cronograma.Tag` = `anexos_equipamento.Tag` = `TMEF.Tag`.
- `equipamentos.Id` = `anexos_equipamento.EquipamentoId`.
- `OS.OS` = `anexos_os.CodigoOS`.
- Plano: `PlanoDeManutencao` + `TipoDeManutencao` + `Tag`. O cronograma não traz número de OS.
- `OS.Tag` está vazia em 79,4% das OS (chamado de setor, sem equipamento).

**Custos externos de peças e serviços estão nas OS?**
`Custo` existe em toda OS (texto, muitos zeros). Não separa peça de serviço nem marca o que é externo. Não há API de itens da OS nesta lista. Contratos estão sem token.

## Por tela

### 1 · Agora

| Bloco | Fonte | Fórmula | Status |
|---|---|---|---|
| Faixa horário / plantão | relógio do servidor | seg–sex 07:00–17:00; fora disso, plantão da Manutenção | ⚠️ a regra é nova; a API não diz quem está de plantão |
| Atraso grave / fora do prazo / sem 1º atendimento | OS `Abertura`, `DataDoAtendimento` + meta do cadastro | situação do DESIGN.md em horas úteis, só OS abertas sem 1º atendimento | ⚠️ o evento real de mão de obra não existe; usar `DataDoAtendimento` até você decidir |
| Equip. parados | disponibilidade mês, empresa `2` | `PossuiOSParadaSemFuncionamento` | ⚠️ diz que está parado, sem início/fim |
| Plano do mês | cronograma | previsto no mês corrente sem OS do mesmo tipo/tag no mês | ⚠️ `ProximaRealizacao` é código (`202609735`), não data; `DataDaUltima` está 100% vazia |
| Fila de ação | OS + plano | ordem GRAVE → ATRASADA → plano do dia → VENCE LOGO → NO PRAZO | ⚠️ plano "vence hoje" depende de ler o código da próxima realização |
| Etiqueta PARADO | `Parada` | parada preenchida e `Funcionamento` vazio | ❌ 7 OS só |
| Etiqueta COMPRA | `Pendencia` ou tipo "SOLICITAÇÃO DE COMPRA" | texto contém compra ou peça | ⚠️ cobre poucas OS |
| Etiqueta SEM TÉCNICO | `Responsavel` | responsável vazio | ❌ `Responsavel` vem em 100% das OS. "Sem técnico" do lançamento não existe |
| Rodapé hoje/semana, % 1º at. 30d | OS | contagem por `Abertura` / `DataDoAtendimento` | ⚠️ mesma ressalva do 1º atendimento |
| TPM 30d | TPM | — | ❌ API 404 |
| Disponibilidade dos críticos | disponibilidade mês, empresa `2` | criticidade Alta (2h) | ✅ 308 equipamentos de criticidade alta no último mês |

### 2 · Fluxo OS

| Bloco | Fonte | Fórmula | Status |
|---|---|---|---|
| Entraram hoje / encerradas hoje | `Abertura`, `Fechamento` | dia civil em America/Sao_Paulo | ✅ |
| Sem 1º atendimento | `DataDoAtendimento` vazio e aberta | | ⚠️ proxy, não o lançamento de mão de obra |
| Em atendimento | aberta, já tem `DataDoAtendimento`, sem pendência | | ⚠️ |
| Aguarda peça/compra | `Pendencia` / `PendenciaAberta` | compra ou peça | ⚠️ raro; o desenho da tela 4 usa e-mail, ainda não coletado |
| Reparo externo | `Tipo=EXT` ou tipo "MAN. EXTERNA" ou `Assistencia` | | ⚠️ três sinais, nenhum é a etapa oficial |
| Contrato/assistência | — | | ❌ sem status. Só texto em `ObservacaoDaOS` e o nome em `Assistencia` |
| Teste e devolução | tipo "AGUARDANDO DEVOLUÇÃO AO SETOR" | | ❌ o tipo existe no cadastro, quase não aparece nas OS |
| Equipe EC · OS em mãos | `Responsavel` | agrupar abertas pelo responsável | ⚠️ é o responsável da OS, não o técnico do lançamento |
| Sem técnico atribuído | — | | ❌ não dá para afirmar: responsável sempre vem preenchido |

### 3 · Envelhecimento

| Bloco | Fonte | Fórmula | Status |
|---|---|---|---|
| Faixas de idade das abertas | `Abertura` | até 2d, 3–7, 8–15, 16–30, >30 | ✅ idade; a cor "onde parou" usa a etapa da tela 2 (⚠️) |
| Dias sem movimentação | último lançamento | agora − último lançamento | ❌ não há data do último lançamento. Candidatos fracos: `DataDoAtendimento`, `Fechamento` |
| Idade média | `Abertura` das abertas | | ✅ |
| Aguardando terceiros | `Tipo=EXT` ou pendência externa | | ⚠️ |
| Sem movimentação > 7 dias | último lançamento | | ❌ |
| Pendência sem motivo | `Pendencia` aberta sem texto | | ⚠️ `ObservacaoDaPendencia` vazia em 98,6% |

### 4 · Compras

E-mail (Fase 9), não API. A OS só entra na entrega (`Fechamento` ou `DataDaSolucao`) e, às vezes, no texto `S.C.` da pendência.

| Bloco | Fonte | Status |
|---|---|---|
| E-mail enviado, SC, dias parado, cobrar Manutenção/Compras | caixas Microsoft 365 | ❌ ainda não coletado |
| Entregue | `Fechamento` / `DataDaSolucao` da OS, ou `ENTREGUE:` no e-mail | ⚠️ a data da OS existe; amarrar ao pedido depende do e-mail |
| % com número de OS | assunto `[OS 9 dígitos]` | ❌ depende do e-mail |
| SC já vista no Effort | `ObservacaoDaPendencia` "S.C. …" | ⚠️ texto livre, 30 OS, não é a lista de compras |

### 5 · Programadas

| Bloco | Fonte | Fórmula | Status |
|---|---|---|---|
| Cumprimento do mês (geral, calibração, preventiva, TSE) | cronograma + OS do mês | previsto no mês com OS fechada do mesmo tag e tipo | ⚠️ a data prevista não é uma data |
| Pendentes no fim do mês | cronograma | sem OS no mês | ⚠️ |
| Impedimentos (motivo + nova data) | — | | ❌ não há API. Fase 6, registro manual |
| Executadas sem laudo | anexos da OS | anexo cujo nome parece laudo | ⚠️ `anexos_os` não tem tipo nem data de emissão. Só nome do arquivo e `DataHoraInclusao` |
| Próximos 7 dias | `ProximaRealizacao` | | ❌ enquanto o campo não for data |

### 6 · Ciclo de vida

| Bloco | Fonte | Fórmula | Status |
|---|---|---|---|
| Em uso / inservível | `Status` ATIVO/INATIVO, `DataDeInativação` | | ⚠️ não existe a trilha aquisição → recebimento → fim de vida → laudo de inservível |
| Histograma de idade | `DataDeAquisicao` ou `DataDeInstalação` | | ⚠️ aquisição vazia em 60%; instalação vazia em 26% |
| Idade ≥ vida útil | `EndOfLife` | hoje ≥ EndOfLife, inclusive 01/01/2050 | ✅ a data é a previsão Anvisa |
| ≥ 4 corretivas em 12 meses | OS corretiva por Tag | | ✅ onde há Tag |
| Custo de reparo 12m ≥ 50% do valor | `Custo` ÷ `ValorDeSubstituicao` | | ⚠️ `Custo` mistura tudo e muitos zeros; valor de aquisição também |
| Descontinuado / sem peça | — | | ❌ sem flag. `EndOfService` é só data |
| Mais antigos em uso | data de aquisição ou instalação, `Status=ATIVO` | | ⚠️ |

### 7 · Indicadores

| Cartão | Fonte | Status |
|---|---|---|
| Tempo de 1º atendimento | `Abertura` → `DataDoAtendimento`, horas úteis | ⚠️ |
| % no prazo | `DataDoAtendimento` contra as horas do texto do Effort | ✅ decisão tomada |
| Cumprimento das programadas | cronograma + OS | ⚠️ data prevista ilegível |
| Causa das corretivas, com "sem causa" | `Causa` | ✅ o vazio é o próprio indicador |
| Custo de reparo / valor do parque | `Custo` e `ValorDeSubstituicao` | ⚠️ contratos fora (sem token); custo não separa peça |
| TPM (TMEF no subtítulo) | TPM 404; TMEF tem `MTBF` em 591 tags | ❌ TPM; ✅ TMEF como subtítulo |
| Disponibilidade dos críticos | disponibilidade mês, empresa `2` | criticidade Alta | ✅ |
| Capacitação (P06) | tipo "ORIENTAÇÃO AO USUÁRIO (TREINAMENTO)" e ocorrência TREINAMENTO (12 OS) | ❌ o desenho pede nº de participantes e evidência. Isso é registro manual |

### 8 · Processos

| Processo | O que dá para contar hoje | Status |
|---|---|---|
| P01 corretivas em aberto | OS abertas de demanda da EC | ✅ |
| P02 programadas do mês | cronograma | ⚠️ |
| P03 ciclo de vida / fim de vida | `EndOfLife` | ⚠️ |
| P04 aquisições | — | ❌ manual |
| P05 obras | tipo "O - EQUIPE DE OBRAS" existe, sem fila de implantação | ❌ manual |
| P06 treinamentos | 12 OS "TREINAMENTO" | ❌ manual para data, tema e participantes |
| P07 alertas / recall | — | ❌ manual |
| Fluxo fora do horário | abertura fora de 07:00–17:00 | ⚠️ dá para contar a OS; não diz se o plantão atendeu |
| Melhorias do item 15 | — | ❌ manual |

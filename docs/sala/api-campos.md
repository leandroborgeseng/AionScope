# Campos das APIs — amostra de 01/10/2026

Recorte: últimos 12 meses nas APIs com data; OS com `periodo=DoisAnosAtuais`. Equipamentos com `apenasAtivos=false` e custo de substituição ligado. Contratos não consultado (token vazio).

Exemplos abaixo são valores de categoria. Nomes de pessoas não entram aqui.

## ANEXOS_EQUIPAMENTO

258 linhas, 5 colunas. Consulta: `(sem parâmetros)`.

| Coluna | Tipo | Nulos | Exemplo | Significado provável |
|---|---|---:|---|---|
| Anexo | texto | 0% | NF 106587.pdf | Nome do arquivo. Sem tipo de anexo nem data de emissão do laudo. |
| DataHoraInclusao | data | 0% | 2018-06-20T16:57:06 | Quando o arquivo entrou no Effort, não a data do laudo. |
| EquipamentoId | number | 0% | 4479 | Id interno do equipamento. Liga com equipamentos.Id. |
| LinkAnexo | texto | 0% | https://sjh.globalthings.net/api/v1/files/1048/bytoken/HhZSAuiUabN9cu24cY2kNGDjR | Campo retornado pela API; uso na Sala ainda não fechado. |
| Tag | texto | 0% | HSJ-00920 | Chave do equipamento (HSJ-#####). Liga OS, parque, cronograma e anexos. |

## ANEXOS_OS

1071 linhas, 5 colunas. Consulta: `(sem parâmetros)`.

| Coluna | Tipo | Nulos | Exemplo | Significado provável |
|---|---|---:|---|---|
| Anexo | texto | 0% | Certificados_Bbraum.pdf | Nome do arquivo. Sem tipo de anexo nem data de emissão do laudo. |
| CodigoOS | numero-texto | 0% | 202507871 | Número da OS no anexo. Liga com OS. |
| DataHoraInclusao | data | 0% | 2024-12-09T15:42:52 | Quando o arquivo entrou no Effort, não a data do laudo. |
| LinkAnexo | texto | 0% | https://sjh.globalthings.net/api/v1/files/83/bytoken/HhZSAuiUabN9cu24cY2kNGDjRML | Campo retornado pela API; uso na Sala ainda não fechado. |
| OSId | number | 0% | 15 | Id interno da OS no anexo. |

## CRONOGRAMA

308 linhas, 13 colunas. Consulta: `dataInicio=2025-10-01T00%3A00%3A00&dataFim=2026-10-01T23%3A59%3A59`.

| Coluna | Tipo | Nulos | Exemplo | Significado provável |
|---|---|---:|---|---|
| CentroDeCusto | texto | 0% | HOSPITAL SÃO JOAQUIM | Campo retornado pela API; uso na Sala ainda não fechado. |
| DataDaUltima | vazio | 100% | — | Última execução do plano. 100% vazio neste recorte. |
| Empresa | texto | 0% | HOSPITAL E MATERNIDADE SÃO JOAQUIM | Campo retornado pela API; uso na Sala ainda não fechado. |
| Equipamento | texto | 0% | TERMOHIGRÔMETRO | Campo retornado pela API; uso na Sala ainda não fechado. |
| Fabricante | texto | 8.8% | MINIPA | Campo retornado pela API; uso na Sala ainda não fechado. |
| Modelo | texto | 0% | MT241 | Campo retornado pela API; uso na Sala ainda não fechado. |
| Observacao | vazio | 100% | — | Campo retornado pela API; uso na Sala ainda não fechado. |
| Perioridicade | texto | 0% | 6 Mês(Es) | Campo retornado pela API; uso na Sala ainda não fechado. |
| PlanoDeManutencao | texto | 0% | CALIBRAÇÃO LABORATÓRIO ANÁLISES CLÍNICAS | Nome do plano. Liga cronograma ↔ OS. |
| ProximaRealizacao | numero-texto | 0% | 202609735 | Código único por linha (ex. 202609735), não uma data de calendário. |
| Setor | texto | 0% | LABORATÓRIO ANÁLISES CLÍNICAS -15A | Campo retornado pela API; uso na Sala ainda não fechado. |
| Tag | texto | 0% | HSJ-01880 | Chave do equipamento (HSJ-#####). Liga OS, parque, cronograma e anexos. |
| TipoDeManutencao | texto | 0% | A - CALIBRAÇÃO DE EQUIPAMENTOS MÉDICOS | Tipo do Effort (corretiva, preventiva, calibração, TSE…). |

## DISP_EQUIPAMENTO

Falha HTTP 404. Recurso não encontrado.

## DISP_EQUIPAMENTO_MES

Falha HTTP 400. Ocorreu um erro ao processar solicitação.

## EQUIPAMENTOS

3039 linhas, 40 colunas. Consulta: `apenasAtivos=false&incluirComponentes=false&incluirCustoSubstituicao=true`.

| Coluna | Tipo | Nulos | Exemplo | Significado provável |
|---|---|---:|---|---|
| Bairro | texto | 0% | SÃO JOAQUIM | Campo retornado pela API; uso na Sala ainda não fechado. |
| CentroDeCusto | texto | 0% | HOSPITAL SÃO JOAQUIM | Campo retornado pela API; uso na Sala ainda não fechado. |
| Cep | texto | 0% | 14406-355 | Campo retornado pela API; uso na Sala ainda não fechado. |
| Cidade | texto | 0% | FRANCA | Campo retornado pela API; uso na Sala ainda não fechado. |
| Cliente | vazio | 100% | — | Campo retornado pela API; uso na Sala ainda não fechado. |
| CodigoCliente | vazio | 100% | — | Campo retornado pela API; uso na Sala ainda não fechado. |
| ComponenteDe | vazio | 100% | — | Campo retornado pela API; uso na Sala ainda não fechado. |
| Criticidade | texto | 20.9% | BAIXA (TEMPO MÁXIMO DE ATENDIMENTO 12HS) | Texto do cadastro, com o prazo no próprio nome (2h, 4h ou 12h). |
| DataDeAquisicao | data | 60.1% | 30/08/2022 | Aquisição. Vazia em 60% do parque. |
| DataDeCadastro | data | 0% | 14/05/2015 | Campo retornado pela API; uso na Sala ainda não fechado. |
| DataDeFabricacao | data | 97.8% | 01/08/2015 | Fabricação. Vazia em 98%. |
| DataDeGarantia | data | 61.7% | 25/05/2022 | Campo retornado pela API; uso na Sala ainda não fechado. |
| DataDeGarantiaEstendida | data | 89.6% | 25/05/2022 | Campo retornado pela API; uso na Sala ainda não fechado. |
| DataDeInativação | data | 87.5% | 15/06/2018 | Campo retornado pela API; uso na Sala ainda não fechado. |
| DataDeInstalação | data | 25.6% | 30/05/2025 | Campo retornado pela API; uso na Sala ainda não fechado. |
| EndOfLife | data | 27.4% | 01/01/2050 | Data de fim de vida. Não é um campo 'anos de vida útil'. 01/01/2050 parece placeholder. |
| EndOfService | data | 27.4% | 01/01/2050 | Fim de suporte do fabricante. Não há flag 'descontinuado'. |
| Endereco | texto | 0% | RUA ABÍLIO COUTINHO 331, SÃO JOAQUIM, FRANCA-SP | Campo retornado pela API; uso na Sala ainda não fechado. |
| Equipamento | texto | 0% | ESFIGMOMANÔMETRO | Campo retornado pela API; uso na Sala ainda não fechado. |
| Fabricante | texto | 5.5% | B BRAUN S/A. | Campo retornado pela API; uso na Sala ainda não fechado. |
| Fornecedor | texto | 52% | RIBERTEC HOSPITALAR | Campo retornado pela API; uso na Sala ainda não fechado. |
| GarantiaExterna | texto | 96.4% | DE SERVIÇO: DRAGER INDUSTRIA E COMERCIO LTDA ATÉ: 10/04/2017 NA OS: 201607994 | Campo retornado pela API; uso na Sala ainda não fechado. |
| GrupoDeSetores | texto | 0% | DEPÓSITO PATRIMÔNIO | Campo retornado pela API; uso na Sala ainda não fechado. |
| Id | number | 0% | 7685 | Id interno do equipamento. |
| Modelo | texto | 0% | ANERÓIDE | Campo retornado pela API; uso na Sala ainda não fechado. |
| NSerie | texto | 11.5% | PH4A80709/16 | Campo retornado pela API; uso na Sala ainda não fechado. |
| NotaFiscal | texto | 53.2% | 987471 | Campo retornado pela API; uso na Sala ainda não fechado. |
| Observacao | texto | 96.1% | EQUIPAMENTO ADQUIRIDO PELA SODEXO | Campo retornado pela API; uso na Sala ainda não fechado. |
| Patrimonio | texto | 62.4% | 765 | Campo retornado pela API; uso na Sala ainda não fechado. |
| Prioridade | texto | 98.8% | BAIXA (MÁX. 72HS) | Na OS, prazo no texto (2h, 4h, 12h, 72h). No equipamento, quase vazio. |
| RazaoSocial | texto | 0% | HOSPITAL E MATERNIDADE SÃO JOAQUIM | Campo retornado pela API; uso na Sala ainda não fechado. |
| RegistroAnvisa | texto | 24.4% | ISENTO | Campo retornado pela API; uso na Sala ainda não fechado. |
| Setor | texto | 0% | DEPÓSITO PATRIMÔNIO | Campo retornado pela API; uso na Sala ainda não fechado. |
| Situacao | texto | 0% | PRÓPRIO | Propriedade do bem (PRÓPRIO, COMODATO, LOCADO…), não se está parado. |
| Status | texto | 0% | ATIVO | No equipamento: ATIVO/INATIVO. Na OS: SLA preenchido em 0,2%. |
| Tag | texto | 0% | HSJ-03001 | Chave do equipamento (HSJ-#####). Liga OS, parque, cronograma e anexos. |
| UF | texto | 0% | SP | Campo retornado pela API; uso na Sala ainda não fechado. |
| ValidadeDoRegistroAnvisa | data | 27.3% | 01/01/2050 | Campo retornado pela API; uso na Sala ainda não fechado. |
| ValorDeAquisicao | texto | 0% | 0,00 | Valor de compra. 0,00 em mais da metade. |
| ValorDeSubstituicao | texto | 0% | 0,00 | Valor de substituição. Usado no custo do parque. |

## MONITOR_ATENDIMENTO

4199 linhas, 13 colunas. Consulta: `dataInicio=2025-10-01T00%3A00%3A00&dataFim=2026-10-01T23%3A59%3A59`.

| Coluna | Tipo | Nulos | Exemplo | Significado provável |
|---|---|---:|---|---|
| Cliente | vazio | 100% | — | Campo retornado pela API; uso na Sala ainda não fechado. |
| DataHoraAbertura | data | 0% | 04/02/2026 01:11:00 | Campo retornado pela API; uso na Sala ainda não fechado. |
| Empresa | texto | 0% | HOSPITAL E MATERNIDADE SÃO JOAQUIM | Campo retornado pela API; uso na Sala ainda não fechado. |
| Equipamento | texto | 0% | CENTRAL DE MATERIAIS E ESTERILIZAÇÃO - 19 | Campo retornado pela API; uso na Sala ainda não fechado. |
| NumeroOS | numero-texto | 0% | 202609834 | Campo retornado pela API; uso na Sala ainda não fechado. |
| ObservacaoDaRequisicao | texto | 23.9% | SOLICITO MANUTENÇÃO DE PORTA AGULHA. | Campo retornado pela API; uso na Sala ainda não fechado. |
| PrazoParaAtendimento | texto | 98.7% | 12:00 | Prazo mostrado no monitor. |
| Prioridade | texto | 0% | BAIXA (MÁX. 72HS) | Na OS, prazo no texto (2h, 4h, 12h, 72h). No equipamento, quase vazio. |
| Requisitante | texto | 23.9% | (nome de pessoa) | Quem abriu o chamado. |
| Setor | texto | 65.7% | UTI INFANTIL - 8 | Campo retornado pela API; uso na Sala ainda não fechado. |
| Tag | texto | 0% | 19 | Chave do equipamento (HSJ-#####). Liga OS, parque, cronograma e anexos. |
| TempoDecorrido | texto | 0% | 239 dia(s) 07:48 | Tempo desde a abertura no monitor. |
| TipoManutencao | texto | 0% | A - INSTRUMENTAL | Campo retornado pela API; uso na Sala ainda não fechado. |

## MONITOR_REACAO

3 linhas, 13 colunas. Consulta: `dataInicio=2025-10-01T00%3A00%3A00&dataFim=2026-10-01T23%3A59%3A59`.

| Coluna | Tipo | Nulos | Exemplo | Significado provável |
|---|---|---:|---|---|
| Cliente | vazio | 100% | — | Campo retornado pela API; uso na Sala ainda não fechado. |
| DataHoraCriacao | data | 0% | 01/10/2026 08:59:00 | Campo retornado pela API; uso na Sala ainda não fechado. |
| Empresa | texto | 0% | HOSPITAL E MATERNIDADE SÃO JOAQUIM | Campo retornado pela API; uso na Sala ainda não fechado. |
| Equipamento | vazio | 100% | — | Campo retornado pela API; uso na Sala ainda não fechado. |
| Numero | numero-texto | 0% | 91831 | Campo retornado pela API; uso na Sala ainda não fechado. |
| Observacao | texto | 0% | SOLCITO CONSERTO DE AR CONDICONADO SALA DE EXAMES | Campo retornado pela API; uso na Sala ainda não fechado. |
| PrazoParaAtendimento | vazio | 100% | — | Prazo mostrado no monitor. |
| Prioridade | texto | 0% | MÉDIA (MÁX. 12 HS) | Na OS, prazo no texto (2h, 4h, 12h, 72h). No equipamento, quase vazio. |
| Requisitante | texto | 0% | (nome de pessoa) | Quem abriu o chamado no monitor. |
| Setor | texto | 0% | UTI ADULTO - 5A | Campo retornado pela API; uso na Sala ainda não fechado. |
| Tag | vazio | 100% | — | Chave do equipamento (HSJ-#####). Liga OS, parque, cronograma e anexos. |
| TempoDecorrido | texto | 0% | 00:00 | Tempo desde a abertura no monitor. |
| TipoManutencao | texto | 0% | CORRETIVA | Campo retornado pela API; uso na Sala ainda não fechado. |

## OFICINA

Falha HTTP 404. Recurso não encontrado.

## OS_ANALITICO

22015 linhas, 62 colunas. Consulta: `periodo=DoisAnosAtuais&qtdPorPagina=100000&tipoManutencao=Todos`.

| Coluna | Tipo | Nulos | Exemplo | Significado provável |
|---|---|---:|---|---|
| AbertaPor | texto | 0% | (nome de pessoa) | Usuário que abriu a OS. |
| Abertura | data | 0% | 04/02/2025 17:30 | Abertura da OS. |
| Assistencia | texto | 99.1% | ADEMIR CARLOS DE ALMEIDA FRANCA -ME | Nome da assistência técnica externa, quando houver. |
| Avaliacao | texto | 33.7% | BOM | Campo retornado pela API; uso na Sala ainda não fechado. |
| Causa | texto | 46.5% | DESGASTE NATURAL | Causa no encerramento. Vazia em cerca de metade das OS. |
| CentroDeCusto | texto | 0% | HSJ - HOSPITAL SÃO JOAQUIM | Campo retornado pela API; uso na Sala ainda não fechado. |
| CodigoExtra | vazio | 100% | — | Campo retornado pela API; uso na Sala ainda não fechado. |
| CodigoSerialOS | number | 0% | 104815 | Id interno da OS. |
| ComplexidadeDaOS | texto | 98.1% | BAIXA COMPLEXIDADE | Campo retornado pela API; uso na Sala ainda não fechado. |
| Custo | texto | 0% | 0,00 | Custo lançado na OS. Campo sempre presente; muitos valores 0,00. |
| DataDaSolucao | data | 42% | 06/08/2026 09:00 | Solução. Às vezes difere do fechamento. |
| DataDoAtendimento | data | 37.4% | 06/08/2026 08:00 | Data/hora do 1º atendimento. Vazia em 37% das OS. |
| DataLimiteDaSolucao | data | 99.4% | 03/01/2025 20:25 | Campo retornado pela API; uso na Sala ainda não fechado. |
| DataLimiteDoAtendimento | data | 99.4% | 03/01/2025 20:25 | Limite do SLA gravado na OS. Quase sempre vazio. |
| Deslocamento | texto | 38% | 0 dias  00:00 | Campo retornado pela API; uso na Sala ainda não fechado. |
| Empresa | texto | 0% | HOSPITAL E MATERNIDADE SÃO JOAQUIM | Campo retornado pela API; uso na Sala ainda não fechado. |
| Equipamento | texto | 79.4% | MONITOR MULTIPARÂMETROS | Campo retornado pela API; uso na Sala ainda não fechado. |
| Fabricante | texto | 81.5% | PHILIPS | Campo retornado pela API; uso na Sala ainda não fechado. |
| Fechamento | data | 7.7% | 31/12/2025 13:00 | Fechamento da OS. |
| Funcionamento | data | 100% | 14/04/2025 10:30 | Volta a funcionar. Quase nunca preenchida (4 OS). |
| GrupoEmpresa | texto | 0% | GRUPO PRINCIPAL | Campo retornado pela API; uso na Sala ainda não fechado. |
| HorasTrabalhadas | texto | 0% | 00:00 | Duração total HH:MM. Não traz data do 1º nem do último lançamento. |
| JustificativaEncerramento | vazio | 100% | — | Campo retornado pela API; uso na Sala ainda não fechado. |
| LiberadoParaUso | texto | 0% | NÃO INFORMADO | Campo retornado pela API; uso na Sala ainda não fechado. |
| MatriculaResolvedor | texto | 42.5% | 21121000 | Campo retornado pela API; uso na Sala ainda não fechado. |
| MatriculaResponsavel | texto | 0% | 211200000 | Campo retornado pela API; uso na Sala ainda não fechado. |
| Modelo | texto | 79.4% | ANERÓIDE | Campo retornado pela API; uso na Sala ainda não fechado. |
| MotivoCancelamentoOS | texto | 96% | CONFORME DESCRITO NA OBSERVAÇÃO | Campo retornado pela API; uso na Sala ainda não fechado. |
| MotivoDaAvaliacao | vazio | 100% | — | Campo retornado pela API; uso na Sala ainda não fechado. |
| NumeroDaRequisicao | numero-texto | 25.5% | 86414 | Campo retornado pela API; uso na Sala ainda não fechado. |
| NumeroDeSerie | texto | 81.2% | 6217212WX0 | Campo retornado pela API; uso na Sala ainda não fechado. |
| OS | numero-texto | 0% | 202500001 | Número da OS no Effort (9 dígitos). |
| ObservacaoDaAvaliacao | texto | 89.7% | OK | Campo retornado pela API; uso na Sala ainda não fechado. |
| ObservacaoDaOS | texto | 83.8% | CONTRATO: SERVICOS ESPECIALIZADOS EM ENGENHARIA - DE: 01/01/2025 ATÉ 01/01/2026 | Campo retornado pela API; uso na Sala ainda não fechado. |
| ObservacaoDaPendencia | texto | 98.6% | S.C. 133921 | Campo retornado pela API; uso na Sala ainda não fechado. |
| ObservacaoDaRequisicao | texto | 25.3% | SOLICITO MANUTENÇÃO DE PORTA AGULHA. | Campo retornado pela API; uso na Sala ainda não fechado. |
| ObservacaoMotivoCancelamentoOS | texto | 96.6% | ABERTURA ERRADA | Campo retornado pela API; uso na Sala ainda não fechado. |
| Ocorrencia | texto | 14.7% | ABERTURA DE CHAMADO | Motivo da abertura. |
| Oficina | texto | 0% | OFICINA GERAL | Oficina da OS. A API oficina em si respondeu 404. |
| Parada | data | 100% | 14/04/2025 07:30 | Início da parada. Quase nunca preenchida (7 OS). |
| Patrimonio | texto | 87.8% | 18007 | Campo retornado pela API; uso na Sala ainda não fechado. |
| Pendencia | texto | 98.5% | AGUARDANDO REALIZAÇÃO DE COMPRA | Texto da pendência já lançada (compra, peça, externo). Quase sempre vazio. |
| PendenciaAberta | texto | 99.9% | AGUARDANDO REALIZAÇÃO DE COMPRA | Pendência ainda aberta. 30 OS no recorte. |
| PendenciaAbertaEm | data | 98.5% | 05/08/2025 | Campo retornado pela API; uso na Sala ainda não fechado. |
| PlanoDeManutencao | texto | 83.7% | CALIBRAÇÃO LABORATÓRIO ANÁLISES CLÍNICAS | Nome do plano. Liga cronograma ↔ OS. |
| PrazoAtendimento | texto | 99.4% | 12:00 | Campo retornado pela API; uso na Sala ainda não fechado. |
| PrazoDeEncerramentoOs | vazio | 100% | — | Campo retornado pela API; uso na Sala ainda não fechado. |
| PrazoDeEncerramentoPendencia | data | 99.5% | 07/07/2025 | Campo retornado pela API; uso na Sala ainda não fechado. |
| PrazoEncerramento | vazio | 100% | — | Campo retornado pela API; uso na Sala ainda não fechado. |
| Prioridade | texto | 0% | MÉDIA (MÁX. 12 HS) | Na OS, prazo no texto (2h, 4h, 12h, 72h). No equipamento, quase vazio. |
| Requisitante | texto | 24.9% | (nome de pessoa) | Quem abriu o chamado. |
| Responsavel | texto | 0% | (nome de pessoa) | Responsável da OS. Preenchido em todas. |
| SLAAtendimento | texto | 99.4% | 12:00 | Campo retornado pela API; uso na Sala ainda não fechado. |
| Seguro | texto | 0% | NÃO INFORMADO | Campo retornado pela API; uso na Sala ainda não fechado. |
| Servico | texto | 39.3% | MANUTENÇÃO CORRETIVA REALIZADA | Serviço lançado (texto concatenado), não um diário de horas. |
| Setor | texto | 0% | UNIDADE DE EMERGÊNCIA - 26 | Campo retornado pela API; uso na Sala ainda não fechado. |
| SituacaoDaOS | texto | 0% | Fechada | Situação macro: Aberta, Fechada, Cancelada, Pendente. Não é a etapa peça/externo/contrato. |
| Status | texto | 99.8% | Dentro do prazo para atendimento (SLA) | No equipamento: ATIVO/INATIVO. Na OS: SLA preenchido em 0,2%. |
| Tag | texto | 79.4% | HSJ-02339 | Chave do equipamento (HSJ-#####). Liga OS, parque, cronograma e anexos. |
| TecnicoResolvedor | texto | 42.5% | (nome de pessoa) | Quem resolveu. Não é a lista de lançamentos. |
| Tipo | texto | 0% | INT | INT (interna) ou EXT (externa). |
| TipoDeManutencao | texto | 0% | CORRETIVA | Tipo do Effort (corretiva, preventiva, calibração, TSE…). |

## OS_ANALITICO_RESUMIDO

22015 linhas, 26 colunas. Consulta: `periodo=DoisAnosAtuais&qtdPorPagina=100000&tipoManutencao=Todos`.

| Coluna | Tipo | Nulos | Exemplo | Significado provável |
|---|---|---:|---|---|
| Abertura | data | 0% | 04/02/2025 17:30 | Abertura da OS. |
| Causa | texto | 46.5% | DESGASTE NATURAL | Causa no encerramento. Vazia em cerca de metade das OS. |
| CodigoSerialOS | number | 0% | 104815 | Id interno da OS. |
| ComplexidadeDaOS | texto | 98.1% | BAIXA COMPLEXIDADE | Campo retornado pela API; uso na Sala ainda não fechado. |
| DataAberturaPendencia | data | 99.9% | 26/09/2025 11:10 | Campo retornado pela API; uso na Sala ainda não fechado. |
| DataConclusaoPendencia | data | 100% | 07/03/2025 09:23 | Campo retornado pela API; uso na Sala ainda não fechado. |
| DataDaSolucao | data | 42% | 06/08/2026 09:00 | Solução. Às vezes difere do fechamento. |
| Empresa | texto | 0% | HOSPITAL E MATERNIDADE SÃO JOAQUIM | Campo retornado pela API; uso na Sala ainda não fechado. |
| Equipamento | texto | 79.4% | MONITOR MULTIPARÂMETROS | Campo retornado pela API; uso na Sala ainda não fechado. |
| Fabricante | texto | 81.5% | PHILIPS | Campo retornado pela API; uso na Sala ainda não fechado. |
| Fechamento | data | 7.7% | 31/12/2025 13:00 | Fechamento da OS. |
| MatriculaResponsavel | texto | 0% | 211200000 | Campo retornado pela API; uso na Sala ainda não fechado. |
| Modelo | texto | 79.4% | ANERÓIDE | Campo retornado pela API; uso na Sala ainda não fechado. |
| OS | numero-texto | 0% | 202500001 | Número da OS no Effort (9 dígitos). |
| ObservacaoPendencia | texto | 99.9% | S.C 138568 | Campo retornado pela API; uso na Sala ainda não fechado. |
| Ocorrencia | texto | 14.7% | ABERTURA DE CHAMADO | Motivo da abertura. |
| Oficina | texto | 0% | OFICINA GERAL | Oficina da OS. A API oficina em si respondeu 404. |
| PendenciaAberta | texto | 99.9% | AGUARDANDO REALIZAÇÃO DE COMPRA | Pendência ainda aberta. 30 OS no recorte. |
| PlanoDeManutencao | texto | 83.7% | CALIBRAÇÃO LABORATÓRIO ANÁLISES CLÍNICAS | Nome do plano. Liga cronograma ↔ OS. |
| Prioridade | texto | 0% | MÉDIA (MÁX. 12 HS) | Na OS, prazo no texto (2h, 4h, 12h, 72h). No equipamento, quase vazio. |
| Responsavel | texto | 0% | (nome de pessoa) | Responsável da OS. Preenchido em todas. |
| Setor | texto | 0% | UNIDADE DE EMERGÊNCIA - 26 | Campo retornado pela API; uso na Sala ainda não fechado. |
| SituacaoDaOS | texto | 0% | Fechada | Situação macro: Aberta, Fechada, Cancelada, Pendente. Não é a etapa peça/externo/contrato. |
| Status | texto | 99.8% | Dentro do prazo para atendimento (SLA) | No equipamento: ATIVO/INATIVO. Na OS: SLA preenchido em 0,2%. |
| Tipo | texto | 0% | INT | INT (interna) ou EXT (externa). |
| TipoDeManutencao | texto | 0% | CORRETIVA | Tipo do Effort (corretiva, preventiva, calibração, TSE…). |

## TIPO_MANUTENCAO

17 linhas, 5 colunas. Consulta: `apenasAtivos=true&tipo=Todos`.

| Coluna | Tipo | Nulos | Exemplo | Significado provável |
|---|---|---:|---|---|
| Ativo | texto | 0% | S | Campo retornado pela API; uso na Sala ainda não fechado. |
| Descricao | texto | 0% | A - CALIBRAÇÃO DE EQUIPAMENTOS MÉDICOS | Campo retornado pela API; uso na Sala ainda não fechado. |
| Id | number | 0% | 11 | Id interno do equipamento. |
| TipoCorretiva | texto | 0% | S | Campo retornado pela API; uso na Sala ainda não fechado. |
| TipoPreventivo | texto | 0% | S | Campo retornado pela API; uso na Sala ainda não fechado. |

## TMEF

591 linhas, 11 colunas. Consulta: `dataInicio=2025-10-01T00%3A00%3A00&dataFim=2026-10-01T23%3A59%3A59`.

| Coluna | Tipo | Nulos | Exemplo | Significado provável |
|---|---|---:|---|---|
| CentroDeCusto | texto | 0% | HSJ - HOSPITAL SÃO JOAQUIM | Campo retornado pela API; uso na Sala ainda não fechado. |
| Empresa | texto | 0% | HOSPITAL E MATERNIDADE SÃO JOAQUIM | Campo retornado pela API; uso na Sala ainda não fechado. |
| Equipamento | texto | 0% | ESFIGMOMANÔMETRO | Campo retornado pela API; uso na Sala ainda não fechado. |
| Fabricante | texto | 8.3% | PHILIPS | Campo retornado pela API; uso na Sala ainda não fechado. |
| MTBF | numero-texto | 0% | 357,11 | Tempo médio entre falhas já calculado pela API, em horas (texto). |
| Modelo | texto | 0% | ANERÓIDE | Campo retornado pela API; uso na Sala ainda não fechado. |
| NumeroDeSerie | texto | 6.8% | 0101120391 | Campo retornado pela API; uso na Sala ainda não fechado. |
| Os | numero-texto | 0% | 1 | Campo retornado pela API; uso na Sala ainda não fechado. |
| Patrimonio | texto | 34.5% | 4705 | Campo retornado pela API; uso na Sala ainda não fechado. |
| Setor | texto | 0% | UTI ADULTO - 5A | Campo retornado pela API; uso na Sala ainda não fechado. |
| Tag | texto | 0% | HSJ-00001 | Chave do equipamento (HSJ-#####). Liga OS, parque, cronograma e anexos. |

## TPM

Falha HTTP 404. Recurso não encontrado.


# AION · Sala operacional — especificação de design

TV de 50" (1920×1080), tema claro, cores da AION. A TV gira entre 8 telas com um timer.
Objetivo: **olhar a tela e saber o que precisa ser feito** e acompanhar todo o ciclo de vida dos equipamentos,
seguindo o *Mapeamento dos processos da Engenharia Clínica* (HSJ, v1.1, 24/09/2026).

> Os números nas imagens são **exemplos**. Só as OS 202609616, 202609709, 202609707, 202609708, e 202608831 vieram do sistema real. Tudo deve ser trocado pelos dados das APIs.

## Conteúdo do pacote

| Pasta / arquivo | O que é |
|---|---|
| `telas/*.png` | Referência visual exata de cada tela (1920×1080). **Fonte da verdade do layout.** |
| `html/*.html` | As mesmas telas em HTML estático (inline styles) — copiar medidas, cores e tamanhos daqui. |
| `tokens.css` | Variáveis de cor, fonte, tamanhos e espaçamentos. |
| `fonte-design/*.dc.html` | Fonte original do canvas (formato do editor de design; `renderVals()` mostra a estrutura de dados de cada tela). |
| `telas/00-fontes-de-dados.png` | De qual API vem cada bloco. |

## Regras gerais

- Tela fixa 1920×1080, **sem rolagem**. Lista que não cabe mostra os N primeiros + "+ X …".
- Cabeçalho igual em todas: faixa de 6 px (gradiente verde→azul), logo AION, rótulo do processo + título da tela, as 8 pílulas de navegação (a ativa em azul), relógio.
- Menor texto 16 px; corpo 21 px; nome de equipamento 26–28 px; números em JetBrains Mono.
- Situação sempre com **texto + cor** (nunca só cor). Cores de status diferem também em claridade.
- Sem modo escuro. Sem emoji. Ícones só traço simples (setas, play/pause).
- Estado vazio explícito ("Nenhuma OS atrasada") — nunca bloco em branco.
- Rodapé ou cabeçalho mostra "atualizado há X min"; se os dados tiverem mais de 20 min, faixa âmbar "dados desatualizados".

## Rotação (player)

- Rota `/sala` = player. Cada tela tem também rota própria (`/sala/agora`, `/sala/fluxo`, `/sala/compras`, …) para abrir direto.
- Tempo por tela configurável (padrão 30 s). Barra de progresso de 8 px no rodapé + selo "próxima: X em 0:12" com botões pausar/avançar (≥ 44 px).
- Sequência configurável. Sugestão: Agora → Fluxo → Compras → Agora → Envelhecimento → Programadas → Agora → Ciclo de vida → Indicadores → Processos.
- **Interrupção**: entrou OS nova de criticidade alta ou uma OS virou GRAVE → pula para *Agora* e destaca a linha por 60 s.
- Dados: o player busca um snapshot a cada 60 s; o servidor usa o cache PBI existente (`PBI_CACHE_SECONDS`).

## Regras de negócio (do mapeamento)

- **Horário da EC: seg–sex 07:00–17:00, America/Sao_Paulo.** (O protótipo antigo usava 08:00 — corrigir; deixar configurável.) Fora disso, quem atende é o plantão da Manutenção; prazos ficam pausados.
- Feriados: lista configurável (nacionais + municipais).
- **1º atendimento = primeiro lançamento de mão de obra na OS.** Não confundir com tempo de solução.
- Meta de 1º atendimento depende da criticidade/prioridade do cadastro do equipamento.
- Situação de uma OS **sem** 1º atendimento, em horas úteis:
  - `GRAVE`: atraso > 1× a meta (decorrido > 2× meta)
  - `ATRASADA`: decorrido > meta
  - `VENCE LOGO`: restante ≤ 25% da meta
  - `NO PRAZO`: restante > 25%
- Etapas da corretiva (P01, Anexo 3): `Sem 1º atendimento` → `Em atendimento` → (`Aguarda peça/compra` | `Reparo externo` | `Contrato/assistência`) → `Teste e devolução` → `Encerrada`. A etapa vem do status da OS no Effort.
- OS aguardando peça/externo/contrato **continua aberta** com status próprio.
- Programadas (P02): previsto no mês sem OS executada no mês = pendente. Laudo é obrigatório → executada sem anexo = "sem laudo". Impedimento operacional (indisponível/não localizado) é registrado com motivo + nova data e aparece **separado** do indicador.
- Escopo: somente equipamentos médicos e oficinas da Engenharia Clínica (filtro já existente).

## As telas

### 1 · Agora (`01-agora.png`)
Faixa de horário/plantão · 4 contadores (Atraso grave, Fora do prazo, Sem 1º atendimento, Equip. parados) · Plano do mês (faltam por tipo, destaque no último dia) · Parados há mais tempo · **Fila de ação** ordenada: GRAVE → ATRASADA → PLANO que vence hoje → VENCE LOGO → NO PRAZO; empate por criticidade, depois parado, depois mais antiga. Etiquetas: PARADO, COMPRA, SEM TÉCNICO. Rodapé: hoje ↑↓, semana ↑↓, % 1º at. no prazo 30d, TPM 30d, disponibilidade dos críticos.

### 2 · Fluxo OS — P01 (`02-fluxo-os.png`)
Entraram hoje → 6 colunas de etapa (contagem, mais antiga, 2 exemplos) → Encerradas hoje. Abaixo: tabela "Entraram hoje · precisam de atendimento" (hora, OS, equipamento·setor, prioridade, status do 1º at.) e "Equipe EC · OS em mãos" (por técnico, pelo técnico do lançamento) + "Sem técnico atribuído".

### 3 · Envelhecimento (`03-envelhecimento.png`)
Barras empilhadas por faixa de idade (até 2d, 3–7d, 8–15d, 16–30d, >30d), cor = onde está parada. Lista "As mais antigas" com idade e **dias sem movimentação** (agora − último lançamento). KPIs: idade média, aguardando terceiros, sem movimentação > 7 dias, pendência sem motivo registrado.

### 4 · Compras (`04-compras.png`)
Acompanhamento dos pedidos feitos por e-mail (veja `PADRAO_EMAIL_COMPRAS.md`). Três etapas com tempo médio entre elas:
**1 E-mail enviado** (data do envio de leandro.borges@ ou oficina@aion.eng.br para compras@ ou manutencao@hsj.com.br) →
**2 SC criada** (data da resposta da Manutenção com o nº da SC) →
**3 Entregue** (data de baixa da OS no Effort = data da entrega).
Cartão de padronização (% de pedidos com nº de OS). Tabela "Pedidos em aberto", mais parados primeiro: OS, equipamento · item, setor, envio (data · quem), SC (nº · data), dias parado na etapa atual, situação:
`cobrar Manutenção` (sem SC há > 2 dias úteis) · `cobrar Compras` (SC há > 15 dias sem entrega; prazo configurável) · `vincular a uma OS` (e-mail sem nº de OS) · `aguarda SC` · `aguarda entrega`.
Na tela 2 (Fluxo OS), a etapa "Aguarda peça / compra" usa estes dados.

### 5 · Programadas — P02 (`05-programadas.png`)
Cumprimento do mês (geral + calibração, preventiva, TSE) · Pendentes que fecham no fim do mês · Impedimentos operacionais · Executadas sem laudo · Próximos 7 dias.

### 6 · Ciclo de vida — P03/P04 (`06-ciclo-de-vida.png`)
Trilha Aquisição → Recebimento → Em uso → Fim de vida → Inservível (laudo emitido, aguarda baixa). Histograma da idade do parque (faixas além da vida útil em laranja). **Fim de vida** com pontuação de 4 critérios: idade ≥ vida útil · ≥ 4 corretivas em 12 meses · custo de reparo 12m ≥ 50% do valor · descontinuado/sem peça. **Mais antigos em uso.**

### 7 · Indicadores (`07-indicadores.png`)
8 cartões com valor do mês + 6 meses: tempo de 1º atendimento, % no prazo, cumprimento das programadas, causa das corretivas (com "sem causa" destacada), custo de reparo / valor do parque, TPM (TMEF no subtítulo), disponibilidade dos críticos, capacitação (P06).

### 8 · Processos ao vivo (`08-processos.png`)
Visão macro do Anexo 1 com contagem em cada processo (P01–P07) e etiqueta da origem do dado (API / manual). Lado direito: fluxo fora do horário (Anexo 2) e status das melhorias do item 15.

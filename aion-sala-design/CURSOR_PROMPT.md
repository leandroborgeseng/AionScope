# Prompt para o Cursor — Nova Sala operacional AION (SJH · Engenharia Clínica)

> Cole este arquivo inteiro no chat do Cursor (modo Agent), com a pasta `aion-sala-design/` copiada para `docs/design/sala/` dentro do repositório.
> Trabalhe **por fases**. Ao fim de cada fase, pare, mostre o resultado e espere o "ok" do Leandro antes de seguir.

---

## Contexto

Este repositório já tem um dashboard (AIONSCOPE) que consome APIs Power BI do sistema Effort em `PBI_BASE_URL` com um token por relatório (`PBI_TOKEN_*` no `.env`), cache em `PBI_CACHE_SECONDS` e SQLite em `DATABASE_PATH`. Ele tem as páginas Indicadores, QMentum, Cadastros, Cronograma, Sala e Solicitações de compra.

Vamos **refazer a Sala operacional** como um painel de TV de 50" (1920×1080) que **gira entre 8 telas com timer**, em tema claro com as cores da AION, e depois **aplicar o mesmo visual ao resto do app**. Quase tudo da Sala atual será substituído.

Leia antes de começar:
- `docs/design/sala/DESIGN.md` — regras, telas e regras de negócio (**obrigatório**)
- `docs/design/sala/telas/*.png` — layout final de cada tela (fonte da verdade visual)
- `docs/design/sala/html/*.html` — as mesmas telas em HTML estático, para copiar medidas exatas
- `docs/design/sala/tokens.css` — cores, fontes e tamanhos
- `docs/design/sala/telas/00-fontes-de-dados.png` — de qual API vem cada bloco (hipótese a confirmar)
- `docs/design/sala/PADRAO_EMAIL_COMPRAS.md` — padrão dos e-mails de compra (Fase 9)

## Regras para você (Cursor)

1. **Não invente campos.** Todo dado vem das APIs reais. Se um campo não existir, registre em `docs/sala/lacunas.md` e mostre placeholder "—" na tela. Nunca preencha com valor fictício.
2. **Segredos:** os tokens ficam só no `.env`. Não escreva token em código, log, teste, fixture ou commit. Confirme que `.env` está no `.gitignore`.
3. **Dados reais de amostra** (`docs/sala/api-samples/`) também ficam fora do git (adicione ao `.gitignore`); fixtures de teste devem ser anonimizadas.
4. Mantenha o que funciona no cliente PBI e no cache; refatore em vez de reescrever quando der.
5. Antes de apagar arquivo/rota antiga, liste o que vai sair e espere confirmação.
6. Commits pequenos, um por etapa, mensagem em português.
7. Fuso **America/Sao_Paulo** em todo cálculo de data. Use uma lib de datas com timezone (ex.: date-fns-tz ou Luxon); não use `new Date()` cru para regras de negócio.

---

## Fase 0 — Reconhecimento (sem mudar código)

- Mapeie o projeto: framework, versão, estrutura de pastas, rotas/páginas, componentes da Sala atual, cliente PBI, cache, schema SQLite, scripts de build/deploy (Docker?).
- Para cada `PBI_TOKEN_*`, ache onde é usado e qual tela consome.
- Entregue `docs/sala/estado-atual.md` com: árvore resumida, fluxo de dados (API → cache → página), lista do que será **reaproveitado**, **refeito** e **removido**.

**Pare aqui e mostre o documento.**

## Fase 1 — Conhecer os dados reais

- Crie `scripts/pbi-amostras.(ts|js)` que, usando o cliente existente, chama **cada** API do `.env` (CRONOGRAMA, TIPO_MANUTENCAO, OS_ANALITICO, OS_ANALITICO_RESUMIDO, EQUIPAMENTOS, TMEF, TPM, DISP_EQUIPAMENTO, DISP_EQUIPAMENTO_MES, MONITOR_REACAO, MONITOR_ATENDIMENTO, ANEXOS_EQUIPAMENTO, ANEXOS_OS, OFICINA; CONTRATOS está vazio — pule) e salva em `docs/sala/api-samples/<NOME>.json`: total de linhas, lista de colunas com tipo inferido, % de nulos, até 10 valores distintos por coluna de texto curto e 20 linhas de exemplo.
- Gere `docs/sala/api-campos.md`: tabela por API com coluna, tipo, exemplo e significado provável.
- Gere `docs/sala/mapeamento.md`: para **cada bloco de cada tela** do DESIGN.md, qual API + coluna alimenta, a fórmula, e status ✅ existe / ⚠️ derivável / ❌ não existe. Responda explicitamente:
  - Existe o **status da OS** (aguardando peça, reparo externo, contrato)? Quais valores?
  - Existe **técnico** do lançamento de mão de obra? Data do **1º** e do **último** lançamento?
  - Onde está a **meta de 1º atendimento** por criticidade/prioridade?
  - Existe **causa da corretiva** no encerramento?
  - EQUIPAMENTOS tem **data de aquisição/fabricação, valor, vida útil, fabricante descontinuado**?
  - DISP_EQUIPAMENTO indica **início/fim de indisponibilidade** (parado agora)?
  - Como ligar OS ↔ equipamento ↔ cronograma ↔ anexos (chaves)?
  - Custos externos de peças/serviços estão nas OS?

**Pare aqui e mostre `mapeamento.md` e as lacunas. O Leandro vai decidir o que fazer com cada ❌.**

## Fase 2 — Camada de domínio (com testes)

Crie um módulo isolado (ex.: `src/lib/ec/`) sem dependência de UI:

- `tipos.ts`: `OrdemServico`, `Equipamento`, `ItemPlano`, `Indisponibilidade`, `Anexo` normalizados (nomes em português, datas como ISO com fuso).
- `adaptadores/*.ts`: um por API, convertendo a linha bruta do PBI no tipo normalizado. Toda regra de "qual coluna" mora só aqui.
- `horario-util.ts`: horas úteis entre duas datas — seg–sex **07:00–17:00** (configurável por env `EC_HORA_INICIO`, `EC_HORA_FIM`), feriados de `EC_FERIADOS` (lista de datas) ou tabela SQLite. Testes: virada de dia, sexta→segunda, feriado, abertura fora do horário, horário de verão inexistente no Brasil.
- `situacao.ts`: GRAVE / ATRASADA / VENCE LOGO / NO PRAZO / ATENDIDA conforme DESIGN.md. Testes de borda (exatamente 25%, exatamente 1× a meta).
- `fila.ts`: ordenação da fila de ação (inclui itens de plano no último dia do mês).
- `etapas.ts`: etapa P01 a partir do status da OS.
- `envelhecimento.ts`: faixas de idade, dias sem movimentação.
- `plano.ts`: cumprimento do mês por tipo, pendentes, executadas sem laudo, próximos 7 dias.
- `ciclo-vida.ts`: idade, faixas do histograma, pontuação de fim de vida (4 critérios, parâmetros configuráveis).
- `indicadores.ts`: os 8 indicadores, mês atual + 6 meses.
- Testes unitários com fixtures **anonimizadas** derivadas das amostras.

**Critério de aceite:** testes passando; um script `scripts/sala-snapshot` imprime o JSON de todas as telas com dados reais.

## Fase 3 — API interna da Sala

- `GET /api/sala/snapshot` → um JSON com os dados das 8 telas + `atualizadoEm` + `fonte` por bloco (API ou manual) + lista de alertas (OS nova crítica, OS que virou GRAVE desde o último snapshot).
- Reaproveite o cache PBI; o snapshot pode ter cache próprio de 60 s.
- Se uma API falhar, o snapshot retorna os outros blocos e marca o bloco com erro (a tela mostra "sem dados de X").

## Fase 4 — Base visual

- Importe `tokens.css` como base global (ou converta para o tema do Tailwind se o projeto usar Tailwind, mantendo os mesmos nomes/valores).
- Fontes **Outfit** e **JetBrains Mono hospedadas localmente** (`@fontsource/*` ou `next/font/local`) — não depender do Google Fonts na TV.
- Componentes: `CabecalhoSala` (faixa, logo, rótulo + título, pílulas das 8 telas, relógio do servidor), `Cartao`, `Contador`, `RotuloSecao`, `SeloSituacao`, `LinhaFila`, `BarraProgresso`, `BarrasEmpilhadas`, `MiniTendencia` (6 meses), `CaixaProcesso` + conectores do diagrama, `EstadoVazio`, `AvisoDesatualizado`.
- Logo: use o arquivo oficial do logo AION (peça ao Leandro o SVG/PNG); no design ele é um placeholder.

## Fase 5 — As 8 telas + player

- Rotas: `/sala` (player) e `/sala/agora`, `/sala/fluxo`, `/sala/envelhecimento`, `/sala/compras`, `/sala/programadas`, `/sala/ciclo-de-vida`, `/sala/indicadores`, `/sala/processos`.
- Cada tela reproduz o PNG correspondente: mesma grade, tamanhos de fonte, cores e ordem dos blocos. Layout fixo 1920×1080 e escalado proporcionalmente se a janela for diferente (CSS `transform: scale` no contêiner raiz). Sem rolagem.
- Player: tempo por tela (`SALA_SEGUNDOS`, padrão 30), sequência configurável (`SALA_SEQUENCIA`), barra de progresso, selo "próxima em", pausar/avançar, teclas ← → espaço. Interrupção por alerta → vai para *Agora* e destaca a linha por 60 s.
- Atualiza o snapshot a cada 60 s sem piscar a tela (troca só os dados).
- Listas longas: corte com "+ N".
- Gere um screenshot de cada tela em 1920×1080 (Playwright) e compare lado a lado com os PNGs do design; liste as diferenças.

**Pare e mostre os screenshots com dados reais.**

## Fase 6 — Registros manuais (o que não tem API)

Tabelas SQLite + tela simples `/sala/registros` (protegida pelo login/admin existente):
- Impedimentos operacionais (equipamento, motivo, nova data, quem registrou).
- P04 aquisições em andamento, P05 obras/implantações, P06 treinamentos (data, tema, nº de participantes, evidência recebida s/n), P07 alertas/recall (equipamentos afetados, segregados, status).
- Status das melhorias do mapeamento (item 15).
- Feriados.
Esses dados entram no snapshot com `fonte: "manual"`.

## Fase 7 — Migrar o restante do app

- Substitua a Sala antiga pela nova (rota antiga redireciona para `/sala`).
- Aplique os tokens e componentes às páginas Indicadores, QMentum, Cadastros, Cronograma e Solicitações de compra, mantendo as funções e filtros; corrija o horário útil para 07:00 em todo cálculo.
- Remova código morto (só após a lista aprovada).

## Fase 8 — Operação na TV

- Modo quiosque: instruções no `README` (Chrome `--kiosk`, inicialização automática, desativar descanso de tela).
- Recarregar sozinho se o snapshot falhar por 5 min seguidos; mostrar faixa "sem conexão desde HH:MM".
- Relógio pelo horário do servidor.
- Evitar marca na tela: deslocar o conteúdo 1–2 px a cada hora.

## Fase 9 — Conector de compras (Microsoft 365 / Outlook da AION)

**Contexto:** os pedidos saem de `leandro.borges@aion.eng.br` e `oficina@aion.eng.br` para `compras@hsj.com.br` e `manutencao@hsj.com.br`. A Manutenção responde na mesma conversa com o nº da **SC**. Quando a peça chega, a OS é baixada no Effort com a data da entrega. Padrão em `PADRAO_EMAIL_COMPRAS.md`.

**Acesso (o Leandro faz no Entra ID da AION; você escreve o passo a passo em `docs/sala/m365-setup.md`):**
- Registro de aplicativo no Microsoft Entra ID, permissão de aplicação **`Mail.Read`** (somente leitura), consentimento do administrador.
- Restringir o app **só às duas caixas** (Exchange Online: *RBAC for Applications* ou *Application Access Policy*). Documente os comandos PowerShell.
- Segredos no `.env`: `M365_TENANT_ID`, `M365_CLIENT_ID`, `M365_CLIENT_SECRET` (ou certificado), `M365_CAIXAS=leandro.borges@aion.eng.br,oficina@aion.eng.br`, `COMPRAS_DESTINOS=compras@hsj.com.br,manutencao@hsj.com.br`.

**Coleta:**
- Microsoft Graph com *delta query* em **Itens Enviados** e **Caixa de Entrada** de cada caixa, a cada 5 min (job no servidor). Guarde o `deltaLink` no SQLite.
- Só processa: enviados **para** um endereço de `COMPRAS_DESTINOS`, e recebidos **de** `@hsj.com.br` que pertençam a uma conversa já registrada (`conversationId`).
- **Não** guarde o corpo completo de e-mails fora desse filtro. Dos filtrados, guarde: id, conversationId, data, de, para, assunto e um trecho de até 2.000 caracteres.

**Extração (regras primeiro, IA só quando as regras falham):**
- OS: `\[OS\s*(\d{9})\]` no assunto; senão `OS[:\s#nº]*(\d{9})` no corpo. TAG: `HSJ-\d{5}`.
- SC na resposta: `\bSC\b[\s:#nº.-]*(\d{3,8})` ou `solicita[çc][ãa]o de compra[\s:#nº]*(\d{3,8})`. **Ajuste com e-mails reais**: crie `scripts/compras-amostra` que lista os 30 últimos e-mails filtrados (assunto + 300 caracteres, sem anexos) para validar as regras com o Leandro.
- Entrega: data de fechamento da OS no OS_ANALITICO; alternativa `ENTREGUE:\s*(\d{2}/\d{2}/\d{4})` no e-mail.

**Modelo de dados (SQLite):** `compra` (id, os, tag, item, setor, solicitante_caixa, enviado_em, sc_numero, sc_em, entregue_em, origem_entrega, situacao, conversation_id, revisado_por) · `compra_email` (id, compra_id, message_id, direcao, data, de, para, assunto, trecho) · `compra_sugestao_ia` (compra_id, campo, valor, confianca, aceito).

**Situações:** `aguarda SC` → `cobrar Manutenção` (sem SC > `COMPRAS_PRAZO_SC_DIAS_UTEIS`, padrão 2) → `aguarda entrega` → `cobrar Compras` (SC > `COMPRAS_PRAZO_ENTREGA_DIAS`, padrão 15) → `entregue`. Sem OS → `vincular a uma OS`.

**Telas:** tela 4 da TV (`telas/04-compras.png`); a página existente **Solicitações de compra** vira a lista completa, com filtro, linha do tempo de cada pedido e ação "vincular OS" / "corrigir SC"; a etapa "Aguarda peça/compra" da tela Fluxo OS passa a mostrar a etapa da compra.

**Indicadores:** tempo médio e-mail → SC, SC → entrega, ponta a ponta, % com nº de OS, por mês.

**Critério de aceite:** com e-mails reais dos últimos 60 dias, ≥ 95% dos pedidos com OS e SC corretos (conferência manual de 20 casos pelo Leandro).

## Fase 10 — IA opcional (RunPod)

Use IA **somente** onde regra não resolve, sempre como **sugestão que uma pessoa confirma**:
1. Extrair OS/SC/item de e-mails que não bateram nas regras.
2. Sugerir a **causa da corretiva** a partir do texto da OS (o indicador hoje tem ~25% sem causa) — a sugestão aparece para o técnico no encerramento; nunca grava sozinha.
3. Resumo curto da OS para a TV (opcional).

Implementação:
- Cliente compatível com OpenAI configurável: `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`. Funciona com um endpoint **RunPod Serverless (vLLM)** com um modelo aberto pequeno com bom português (ex.: Qwen2.5-7B-Instruct ou Llama-3.1-8B-Instruct), e permite trocar de provedor sem mudar código.
- Saída sempre em JSON validado por schema; se inválido, descarta.
- Serverless com escala a zero para não gastar crédito parado; limite de chamadas por dia (`LLM_MAX_DIA`) e log de custo.
- Envie ao modelo só o necessário (assunto + trecho), sem nomes de pacientes.
- Se o LLM estiver fora, o sistema funciona normalmente só com as regras.

---

## Definição de pronto

- As 8 telas rodam em `/sala` com dados reais, iguais aos PNGs em layout e tipografia.
- Nenhum valor inventado; lacunas documentadas em `docs/sala/lacunas.md`.
- Regras de horário útil, situação e fila cobertas por testes.
- Pedidos de compra rastreados do e-mail até a entrega, com as 3 datas.
- Nenhum segredo ou dado bruto no git.

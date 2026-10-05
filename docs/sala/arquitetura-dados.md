# Arquitetura de dados — Sala EC (pé no chão)

Documento de arquitetura de soluções · 01/10/2026  
Escopo: o que as APIs GlobalThings **realmente** sustentam, com atualização contínua, mais o acompanhamento de **pedidos de compra** (e-mail M365 e/ou manual).  
Fora do escopo da TV: **contratos** (cadastro manual do usuário, não roadmap da Sala).

---

## 1. Decisão de produto

| Decisão | Regra |
|---|---|
| Fonte da verdade | APIs Effort/GlobalThings + registros manuais mínimos (impedimentos, feriados) + **pedidos de compra** (e-mail e/ou ajuste manual). |
| Fora do dashboard / plano | **Contratos** (API sem token e cadastro manual fora da TV). |
| Pedidos de compra | Importação Outlook (M365 Graph) **e** CRUD em `/sala/pedidos` para correção/inserção. A TV em `/sala/compras` só acompanha. |
| 1º atendimento | `DataDoAtendimento` (não há lançamento de mão de obra). |
| Meta | Texto de criticidade/prioridade do Effort (2h / 4h / 12h / 72h). |
| **Laudo (proxy)** | Não existe data de emissão na API. **Laudo = ciclo da OS de plano:** início ≈ `Abertura`, fim ≈ `Fechamento` (ou `DataDaSolucao`). “Executada no mês” = OS de preventiva/calibração/TSE **fechada no mês**. Não exigir anexo. |
| **Parada (proxy)** | `Parada`/`Funcionamento` quase vazios. **Início da parada = `Abertura` da OS; fim = `Fechamento`/`DataDaSolucao`.** Dias parado = dias corridos entre esses dois pontos. Equipamento “parado agora” = OS aberta de demanda com tag médica (e/ou flag mensal `PossuiOSParadaSemFuncionamento` como reforço). |
| Empresa | Sempre `PBI_DEFAULT_EMPRESA_IDS=2` (HSJ). |

---

## 2. Mapa das APIs (o que responde de verdade)

| API | Status | O que extrair com confiança | Limite |
|---|---|---|---|
| **os-analitico** | ✅ | Volume, fila, SLA 1º at., fluxo, envelhecimento, causa, custo OS, oficina, tipo, pendência (texto), abertura/fechamento | Tag vazia em ~79% (só OS com tag médica entram na TV) |
| **equipamentos** | ✅ | Parque ATIVO/INATIVO, Tag, criticidade, valor substituição, EndOfLife, EndOfService, setor | Aquisição vazia ~60%; fabricação ~98% |
| **cronograma** | ✅ (com parser) | Plano do mês por tipo (prev/calib/TSE) via `ProximaRealizacao` ancorada no mês + periodicidade | Não é data calendário “dia D”; `DataDaUltima` vazia |
| **disp-equipamento-mes** | ✅ (empresa 2) | % disponibilidade, DiasParado no mês, flag parado sem funcionamento, TMEF/TMPR mensal | Sem instante de início/fim; linha mensal |
| **tmef** | ✅ | MTBF por tag | Não substitui TPM global; usamos mediana como cartão “TMEF” |
| **anexos-os / anexos-equipamento** | ✅ | Existência de arquivo, nome, data de **inclusão** no Effort | **Não** é data de laudo/emissão |
| **tipo-manutencao** | ✅ | Cadastro de tipos (filtros) | — |
| **os-resumida** | ✅ | Recortes leves (cronograma anual UI) | Subconjunto do analítico |
| **monitor-reacao / monitor-atendimento** | ⚠️ | Tempo decorrido operacional | Pouco uso na TV; Tag irregular; fora do núcleo |
| **Microsoft Graph (Mail.Read)** | ✅ (opcional) | Threads de pedido de compra (enviado → SC → entregue) | Precisa app Entra; parser por assunto/corpo |
| **tpm** | ❌ 404 | — | Fora |
| **disp-equipamento** (não mensal) | ❌ 404 | — | Usar só mês a mês |
| **oficina** | ❌ 404/401 | — | Oficina vem em cada OS |
| **contratos** | ⛔ fora do escopo | Token vazio; cadastro manual fora do plano da TV | Não entra em indicador nem tela |

---

## 3. Modelo canônico (como juntar)

```
Tag (HSJ-#####)
  ├─ equipamentos.*
  ├─ os-analitico (só linhas com Tag + oficina EC + escopo médico)
  ├─ cronograma (Tag + TipoDeManutencao + PlanoDeManutencao)
  ├─ tmef / disp-equipamento-mes (Tag)
  └─ anexos_* (opcional; só evidência de arquivo, não laudo)

OS (9 dígitos)
  └─ anexos_os.CodigoOS

Pedido de compra (SQLite compra)
  ├─ importado por conversation_id (Graph) e/ou criado em /sala/pedidos
  └─ situação recalculada: aguarda SC → aguarda entrega → entregue

Ordem de compra formal (SQLite ordens_compra + ordem_itens)
  ├─ upsert pelo robô E-Mails Compras em /api/v1/ordens-compra
  └─ categoria editável em /sala/ordens-compra (não sobrescrita pelo robô)
```

**Regra de ouro:** se não há Tag, a linha não alimenta parque/ciclo/plano/parada por equipamento. Chamados de setor continuam no volume bruto só se um dia criarmos tela “sem tag” — hoje **fora**.

---

## 4. O que a TV deve mostrar (escopo fechado)

### Núcleo operacional (manter e fortalecer)

| Tela | Blocos sustentáveis | Proxy explícito na UI |
|---|---|---|
| **Agora** | Contadores 1º at., fila, plantão 7h–17h, plano do mês (cronograma×OS), parados (flag mês + OS abertas), rodapé volume/SLA/TMEF/disp. críticos | Parado ≈ OS aberta ou flag mês; TPM → **TMEF** |
| **Fluxo** | Entraram/encerraram hoje; etapas por pendência/tipo/EXT/DataDoAtendimento | Sem “equipe por lançamento”; responsável da OS se quiser carga |
| **Envelhecimento** | Faixas por `Abertura`; idade média; terceiros (EXT); pendência sem texto | “Sem movimento” → usar `DataDoAtendimento` ou idade desde abertura (rótulo claro) |
| **Compras** | Funil e-mail→SC→entrega; médias; % com OS; lista aberta | Fonte = M365 **e/ou** cadastro/ajuste em `/sala/pedidos` |
| **Programadas** | Cumprimento mês; por tipo; pendentes; impedimentos (manual leve) | Executada = **OS fechada no mês**; laudo = abertura→fechamento da OS (sem anexo) |
| **Ciclo de vida** | Em uso/inservível; idade; EndOfLife; EndOfService; 4+ corretivas; custo/valor; previsão 5 anos; valor substituição fim de vida | Sem peça = EndOfService vencido |
| **Indicadores** | 1º at., % prazo, programadas, causa, custo/parque (**só OS ÷ ValorDeSubstituicao**), TMEF, disp. críticos, capacitação = contagem OS treinamento | Sem contratos no denominador/numerador |
| **Processos** | P01–P03 + fora do horário + melhorias manuais se já cadastradas | P04–P07 manuais **não** são meta da TV; esconder ou “—” sem prometer |

### Remover do produto TV / plano

- Qualquer KPI que dependa de **contratos** (custo mensal de contrato, “custo manutenção com contratos”).
- Cartão TPM real, “sem técnico do lançamento”, “data de emissão do laudo”, “início/fim de parada” nativos da disponibilidade.

Registros manuais que **permanecem**: impedimentos de programada, feriados, **pedidos de compra** (criar/editar/apagar + sync e-mail). Aquisições/obras/recall/melhorias: opcionais em `/sala/registros`, **não** bloqueiam a TV.

---

## 5. Proxies oficiais (aprovados)

### 5.1 Laudo = ciclo da OS de plano

```
previsto no mês     ← cronograma (mês de ProximaRealizacao)
executado no mês    ← OS do mesmo tipo (prev/calib/TSE) com Fechamento|DataDaSolucao no mês
“com laudo”         ← mesma OS executada (abertura→fechamento); não checar anexo
“sem laudo”         ← NÃO usar (anexo não prova emissão)
```

Na UI: subtítulo *“Execução = OS fechada no mês (Effort não envia data de laudo).”*

### 5.2 Parada = abertura → fechamento da OS

```
início da parada    ← Abertura da OS (demanda / corretiva com tag)
fim da parada       ← Fechamento ou DataDaSolucao
duração             ← fim − início (dias corridos ou horas úteis — escolher um e fixar)
parado agora        ← OS aberta de demanda com Tag  ∪  PossuiOSParadaSemFuncionamento no mês
```

Na UI: subtítulo *“Parada aproximada pela OS (campos Parada/Funcionamento quase vazios).”*

---

## 6. Indicadores do app (fora da TV) — o que manter

| Indicador | Manter? | Nota |
|---|---|---|
| OS abertas × fechadas | Sim | os-analitico |
| Oficinas de plano | Sim | cronograma + OS |
| Gasto reparo médicos | Sim | Custo OS |
| Custo manutenção / parque | Sim **sem contratos** | Só OS + ValorDeSubstituicao |
| Corretivas por prioridade / SLA | Sim | |
| Cadastro valor do parque | Sim | |
| Cadastro contratos | Fora do plano da TV | Pode existir tela aparte; **não** entra no roadmap da Sala |
| Pedidos de compra | Sim (Sala) | `/sala/pedidos` + TV Compras |

---

## 7. Lacunas que **não** vamos inventar

1. Lançamento de mão de obra (técnico × horário).  
2. TPM endpoint.  
3. Data real de laudo / tipo de anexo.  
4. Contratos na TV.  
5. “Quem está de plantão” (só horário da EC).  

Onde o proxy for usado, o rótulo na TV diz o proxy — transparência > número bonito.

---

## 8. Arquitetura alvo (simples)

```
Coolify
  └─ Next.js (snapshot 60s)
        ├─ fetchPbi: os-analitico, equipamentos, cronograma,
        │            disp-equipamento-mes, tmef
        ├─ SQLite: impedimentos, feriados, compra (+ compra_email)
        ├─ Graph M365 (opcional): sync de e-mails → compra
        └─ /sala player (inclui Compras) + /sala/pedidos (CRUD)
```

Uma empresa (`2`). Horário útil 7h–17h + feriados. Contratos fora.

---

## 9. Próximos passos de implementação

1. ~~CRUD de pedidos (API + `/sala/pedidos`) e tela Compras na TV.~~  
2. Aplicar proxy de **parada** (abertura→fechamento) na fila/parados.  
3. Rotular **programadas/laudo** como execução por fechamento de OS.  
4. Indicador custo/parque **sem** contratos.  
5. Enxugar Processos (P01–P03 + fora do horário).  
6. Credenciais M365 (tenant/client/secret) quando disponíveis.

---

## 10. Resposta direta às suas perguntas

**“Laudos pela abertura/fechamento da OS — podemos?”**  
**Sim.** É o único proxy honesto: a API não tem data de emissão. Executada no mês = OS de plano fechada; o “laudo” acompanha esse ciclo.

**“Início da parada = abertura, fim = fechamento — podemos?”**  
**Sim.** Os campos `Parada`/`Funcionamento` não servem (quase sempre vazios). Documentar o proxy na UI e usar OS abertas + disponibilidade mês como reforço de “parado agora”.

**“Pedidos de compra precisam de ajuste manual?”**  
**Sim.** Importação por e-mail + criar/editar/apagar em `/sala/pedidos` para acompanhamento completo na TV.

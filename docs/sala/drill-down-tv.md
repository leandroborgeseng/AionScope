# Drill-down na TV Sala — plano de interação (estilo Power BI / ClickQI)

Documento de produto + engenharia · 05/10/2026  
Escopo: clicar em KPI / card / barra / etapa na TV `/sala` e ver **quais itens** compõem aquele número.  
**Não é paridade Power BI.** Não há modelo tabular, slicers cruzados entre telas, bookmarks nem drill-through multi-nível. O alvo é **seleção + lista filtrada** (ou painel de detalhe) na tela atual, com pausa da rotação automática.

Referências de dados: `lib/ec/snapshot-tipos.ts`, `lib/ec/montar-snapshot.ts`, `components/sala-tv/sala-app.tsx`, `docs/sala/arquitetura-dados.md`.

---

## 1. Modelo de interação

### Gestos

| Ação | Comportamento |
|---|---|
| Clique / toque em KPI, card, barra, etapa ou linha “agregada” | Ativa **seleção** `drill = { tela, id, titulo }`. Mostra lista filtrada ou drawer com os itens daquele recorte. |
| Clique de novo no mesmo alvo | **Limpa** a seleção (toggle). |
| Clique em outro alvo na mesma tela | Troca a seleção (um drill ativo por vez). |
| Esc ou botão **Limpar** no chip | Limpa a seleção. |
| Durante drill | **Pausa** a auto-rotação enquanto `drill` ou detalhe de OS estão abertos (e enquanto edição/confirmação em Compras). |
| Ao limpar | **Retoma** a rotação automaticamente (pausa só enquanto a interação está ativa; pausa manual Espaço/botão é independente). |
| Troca de tela (seta / pill / rotação) | Limpa o drill (seleção é por tela) e retoma se não houver pausa manual. |

### O que aparece ao “furar”

1. **Chip de filtro** no cabeçalho ou acima do miolo: `selecionado: ATRASO GRAVE · 3` + botão Limpar.  
2. **Lista / painel de detalhe** com as linhas (OS, tag, equipamento, setor, idade, selo…).  
3. Opcional: destacar visualmente o KPI clicado (borda/outline) e esmaecer os demais.

### O que *não* fazemos nesta leva

- Drill-through para outra tela com contexto (ex.: Agora → Compras filtrado pela OS).  
- Filtros cruzados persistentes entre telas.  
- Exportação / tabela paginada completa estilo Power BI.  
- Clique em sparklines de Indicadores para “mês X” (fase futura, se houver demanda).

---

## 2. UX na TV 1920×1080

### Layout recomendado: **overlay / sheet** (não comprimir a fila)

| Opção | Prós | Contras | Decisão |
|---|---|---|---|
| Overlay fullscreen no miolo (dim + sheet largo) | Mantém colunas esquerda/centro intactas; lista legível a 3–4 m; fecha com Esc/backdrop/Limpar | Cobre temporariamente o miolo | **Preferida** (pós Fase 1 — redesign TV) |
| Drawer ~480–560 px à direita | Hit target do KPI continua visível ao lado | **Aperta a FILA** e causa overlap de badges — rejeitado na TV | Evitar |
| Substituir miolo por lista full | Mais linhas | Perde contexto do dashboard | Alternativa só se a lista for enorme |
| Filtrar a lista já existente in-place (ex.: fila da Agora) | Zero layout novo | Não serve quando o KPI não tem lista irmã | Atalho “+ N ocultas” ainda abre o overlay |

### Regras de TV

- Alvos clicáveis ≥ **64×64 px** (contadores já são grandes). Cursor `pointer` + hover/focus ring.  
- Chip de filtro no cabeçalho + título do overlay: fonte ≥ 18–20 px, contraste alto.  
- Lista no overlay: linhas ~68–76 px, grid `status \| equipamento \| meta \| idade` (sem overlap).  
- Toque na TV (se houver): mesma área do clique; sem depender de hover.  
- Overlay esmaece o board; **não** altera `grid-template-columns` da Agora.

### Chip de seleção (stub já previsto no app)

```
┌─────────────────────────────────────────┐
│ selecionado: EQUIP. PARADOS · 12  [Limpar] │
└─────────────────────────────────────────┘
```

Estado React compartilhado (ver §4):

```ts
drill: { tela: TelaSala; id: string; titulo: string } | null
```

---

## 3. Mapa tela → alvo de drill → dados

Legenda de prontidão:

| Símbolo | Significado |
|---|---|
| ✅ | Contagem + itens já derivados no `montar-snapshot`; falta só serializar / expor e ligar UI |
| ⚠️ | Contagem no snapshot; **lista completa não vai no payload** (só top-N ou exemplos) — precisa enriquecer snapshot |
| ❌ | Só KPI agregado; drill exige trabalho de API / montagem nova |
| ➖ | Já é lista; clique = destaque de linha, não drill de agregação |

### 3.1 Agora

| Bloco UI | Drill id sugerido | O que o operador espera ver | Situação dos dados |
|---|---|---|---|
| Contador **ATRASO GRAVE** | `agora.grave` | OS demanda abertas sem 1º at. com `situacao === GRAVE` | ⚠️ Contagem `agora.grave`; itens estão em `grave[]` interno, **não** no JSON. Fila exibe só top-8 de *todo* sem 1º at. |
| Contador **FORA DO PRAZO** | `agora.fora-do-prazo` | GRAVE + ATRASADA (mesmo critério de `fora` em `montar-snapshot`) | ⚠️ Idem |
| Contador **SEM 1º ATENDIMENTO** | `agora.sem-primeiro` | Todas as demanda abertas sem `DataDoAtendimento` | ⚠️ Contagem ok; lista = fila completa (`fila` + ocultas). Hoje `filaOcultas` esconde o resto |
| Contador **EQUIP. PARADOS** | `agora.parados` | Tags “paradas agora” (OS demanda aberta ∪ flag mês) | ⚠️ Contagem `parados`; **não há array de tags/OS no snapshot** — só `paradosMaisTempo` (top 4) |
| **Fila de ação** (linhas) | `agora.fila-item` / detalhe OS | Detalhe operacional da OS (solicitação, EXT, compra, datas…) | ✅ Clique abre `SalaOsDetalhePainel` com `osDetalhes[os]` do snapshot (também nas linhas do overlay de drill) |
| **Plano do mês** (por tipo) | `agora.plano.{prev\|calib\|tse}` | Equipamentos previstos vs executados / faltantes do tipo | ⚠️ Números em `agora.plano`; lista de pendentes já existe em **Programadas** (`programadas.pendentes`). Reusar ou espelhar |
| **Parados há mais tempo** | `agora.parados-mais-tempo` | Já é lista curta | ➖ Clique = destacar / abrir detalhe da tag |
| Rodapé (hoje / semana / 1º at. / TMEF / críticos) | — | — | ❌ Fora do drill Fase 1 (agregados mensais; TMEF sem lista de tags no snapshot) |

**Fase 1 mínima:** 4 contadores + “ver fila completa” (incluindo ocultas).

### 3.2 Fluxo

| Bloco | Drill id | Expectativa | Situação |
|---|---|---|---|
| Colunas **etapas** (quantidade) | `fluxo.etapa.{nome}` | OS abertas naquela etapa | ⚠️ Só `exemplos` (2) + `quantidade`. Grupo completo existe em memória (`demandaAberta` filtrada por etapa) — **serializar** |
| **Entraram hoje** (número / lista) | `fluxo.entraram-hoje` | Todas as OS abertas hoje | ⚠️ Lista truncada (`FLUXO_LIMITE=6` + `entraramOcultas`) |
| **Encerradas hoje** | `fluxo.encerradas-hoje` | OS fechadas hoje | ❌ Só contagem no snapshot; montar lista no snapshot |
| Aviso equipe | — | — | ➖ Sem drill (sem dados de API) |

### 3.3 Envelhecimento

| Bloco | Drill id | Expectativa | Situação |
|---|---|---|---|
| Barra / faixa de idade | `envelhecimento.faixa.{id}` | OS naquela faixa | ⚠️ `faixas[].total` + `partes`; **sem lista de OS por faixa** |
| KPI **IDADE MÉDIA** | — | — | ➖ Número derivado; drill pouco útil (ou = todas abertas) |
| KPI **AGUARDANDO TERCEIROS** | `envelhecimento.terceiros` | OS em Reparo externo / Contrato | ⚠️ Só contagem |
| KPI **SEM MOVIMENTO > 7 DIAS** | `envelhecimento.sem-movimento-7` | OS com proxy > 7d | ⚠️ Só contagem |
| KPI **PENDENTES SEM MOTIVO** | `envelhecimento.pendencia-sem-motivo` | OS pendente sem texto | ⚠️ Só contagem |
| Lista **mais antigas** | — | — | ➖ Já é detalhe (top-N) |

### 3.4 Compras

| Bloco | Drill id | Expectativa | Situação |
|---|---|---|---|
| Funil **1 · Aguarda resposta** | `compras.aguarda-resposta` | OCs naquele estágio | ✅ Lista `compras.pedidos` já traz abertas com `status`/`situacao` — **filtrar client-side** |
| Funil **2 · Aguarda entrega** | `compras.aguarda-entrega` | Idem | ✅ Idem |
| Funil **3 · Entregues no mês** | `compras.entregues-mes` | OCs entregues no mês | ❌ Entregues **saem** da lista de abertas; precisa incluir no snapshot um recorte `entreguesMesLista` ou endpoint drill |
| Card **% com OS / sem OS** | `compras.sem-os` | Abertas sem nº OS | ✅ Filtrar `pedidos` onde `numeroOs` vazio |
| Lista OC + pager | — | — | ➖ Já é detalhe; **não conflitar** com WIP de scroll / marcar entregue |

### 3.5 Programadas

| Bloco | Drill id | Expectativa | Situação |
|---|---|---|---|
| Cumprimento / por tipo | `programadas.tipo.{x}` / `programadas.faltam` | Pendentes do tipo | ✅ `pendentes[]` + `porTipo` — filtrar |
| Lista pendentes / impedimentos | — | — | ➖ Já listas |

### 3.6 Ciclo de vida

| Bloco | Drill id | Expectativa | Situação |
|---|---|---|---|
| Trilha (em uso, inservível…) | `ciclo.trilha.{etapa}` | Equipamentos da etapa | ⚠️ Contagens; listas parciais (`fimDeVida`, `maisAntigos`) |
| Histograma idade | `ciclo.idade.{faixa}` | Tags na faixa | ❌ Só agregados; montar arrays |
| Barras previsão EOL / em ciclo / vencem 5 anos | `ciclo.eol.{ano}` | Tags com EndOfLife naquele ano | ✅ `previsaoEol[].itens` no snapshot; overlay TV |
| Lista fim de vida | — | — | ➖ Já detalhe (top 8) |

### 3.7 Indicadores

| Bloco | Drill id | Expectativa | Situação |
|---|---|---|---|
| Cartões + sparkline | `indicadores.{titulo}` | Itens do mês corrente do KPI | ❌ Quase tudo é série agregada; drill real exige remontar o denominador/numerador por cartão (trabalho por indicador). **Fora das fases iniciais** salvo cartões trivialmente ligáveis a listas já existentes |

### 3.8 Processos

| Bloco | Drill id | Expectativa | Situação |
|---|---|---|---|
| P01–P03 | `processos.{id}` | Redirecionar mentalmente às telas Agora/Fluxo/Programadas/Ciclo | ⚠️ Contagens espelhadas; melhor **não** inventar lista — ou reusar drills das telas-fonte |
| Fora do horário | `processos.fora-horario` | OS abertas fora 7h–17h / fim de semana / feriado | ⚠️ Só contagem `foraDoHorario` |
| Melhorias | — | — | ➖ Já lista manual |

---

## 4. Abordagem técnica

### 4.1 Estado no cliente (compartilhado)

Em `sala-app` / tipos:

```ts
export type SalaDrillSelecao = {
  tela: TelaSala;
  id: string;      // ex.: "agora.grave"
  titulo: string;  // ex.: "ATRASO GRAVE"
};

// React: drill: SalaDrillSelecao | null
```

- Setar `drill` → rotação pausa por derivação (`pausado = pausadoManual || drill || osSelecionada || interacaoCompras`).  
- Esc / Limpar → `setDrill(null)` → retoma se não houver pausa manual.  
- Mudança de `tela` → limpar drill.  
- Stub UI: chip `selecionado: {titulo}` (sem drawer até Fase 1 implementar listas).

### 4.2 Dados: snapshot embutido vs API lazy

| Critério | `SalaSnapshot.detalhes[id]: Linha[]` | `GET /api/sala/snapshot/drill?tipo=` |
|---|---|---|
| Latência no clique | Instantâneo (já no payload de 60s) | 1 RTT + carga no servidor |
| Complexidade | Estende tipo + `montar-snapshot` | Nova rota, cache, auth, tipagem |
| Tamanho do snapshot | + algumas dezenas de linhas OS/OC | Snapshot leve |
| Dados já em memória no montador | Sim (Agora/Fluxo/Envelhecimento) | Redundante se já calculou |
| Listas enormes (parque inteiro) | Pode inchar | Melhor sob demanda |

### Recomendação: **híbrido com default = detalhes no snapshot**

1. **Padrão (Fases 1–3 operacionais):** adicionar ao snapshot um mapa opcional:

   ```ts
   detalhes?: Partial<Record<string, Array<LinhaDrillOs | LinhaDrillEquip | LinhaDrillOc>>>
   ```

   Chaves = drill ids (`agora.grave`, `fluxo.etapa.Sem 1º atendimento`, …).  
   Popular só as chaves das fases ativas (não precisa preencher tudo de uma vez).

2. **Lazy** só quando:
   - lista > ~80–100 itens estáveis, ou  
   - drill de Indicadores / histograma completo do parque, ou  
   - `entreguesMes` históricos pesados.

3. **Compras abertas:** preferir **filtro client-side** em `compras.pedidos` (já no snapshot) — zero mudança de API para funil 1/2 e sem OS.

Formato mínimo de linha OS (reuso da fila):

```ts
type LinhaDrillOs = {
  os: string;
  equipamento: string;
  tag: string;
  setor: string;
  situacao?: string;
  criticidade?: string;
  etapa?: string;
  idade?: string;
  parado?: boolean;
  compra?: boolean;
};
```

### 4.3 UI do overlay (implementado na Agora)

- Componente `SalaDrillOverlay` em `components/sala-tv/sala-app.tsx`.  
- Recebe `drill`, `linhas`, `onLimpar`. Backdrop + sheet com fade; Esc / Limpar / Fechar.  
- `TelaAgora` / … recebem `onDrill(id, titulo)` — **não** editar a lógica interna de Compras além de passar `onDrill` nos cards do funil quando for a fase de Compras.

### 4.4 Contrato de ids

Namespace estável: `{tela}.{recorte}` em kebab-case ASCII, sem acento na chave (`agora.fora-do-prazo`, `envelhecimento.sem-movimento-7`). Título humano separado no estado `titulo`.

---

## 5. Rollout por fases

### Fase 1 — Agora (maior valor operacional)

1. Tipos `SalaDrillSelecao` + estado no `SalaApp` (pausar, Esc, chip).  
2. Em `montar-snapshot`, preencher `detalhes` para:
   - `agora.grave`
   - `agora.fora-do-prazo`
   - `agora.sem-primeiro` (fila completa, não só 8)
   - `agora.parados` (tag + nome + setor + tempo proxy)
3. Contadores clicáveis → **overlay** com lista; toggle / Esc / Limpar / backdrop.  
4. Opcional: clique em “+ N ocultas” da fila = drill `agora.sem-primeiro`.

**Fora da Fase 1:** plano do mês, rodapé, detalhe rico de uma OS.

### Fase 2 — Fluxo + Envelhecimento

1. `detalhes` por etapa do fluxo + entraram hoje completo + encerradas hoje.  
2. Faixas e KPIs de envelhecimento (terceiros, sem movimento >7, pendência sem motivo).  
3. Mesmo drawer / chip.

### Fase 3 — Compras + Programadas

1. Compras: filtro client-side nos estágios 1/2 e sem OS; **não** quebrar pager / marcar entregue.  
2. Entregues no mês: acrescentar lista no snapshot ou drill lazy.  
3. Programadas: filtrar `pendentes` por tipo ao clicar no card.

### Fase 4 — Ciclo (parcial)

1. Drill de trilha + fim de vida já listados.  
2. Histograma / previsão EOL: só se houver demanda — provavelmente lazy.

### Fase 5 — Indicadores + Processos (sob demanda)

1. Processos: fora do horário com lista; P01–P03 como atalho visual, não duplicar dados.  
2. Indicadores: um cartão por vez, se o numerador for reconstruível sem inventar proxy novo.

---

## 6. Riscos e cuidados

| Risco | Mitigação |
|---|---|
| Conflito com WIP Compras (pager / entregue) | Não refatorar `TelaCompras` na Fase 1; drills de Compras só na Fase 3, com diff mínimo nos cards do funil |
| Snapshot maior | Limitar `detalhes` às chaves da fase; medir payload; lazy se > ~200 KB extras |
| Contagem ≠ lista (off-by-one de filtro) | Reusar exatamente os mesmos arrays do montador que geram o número; teste unitário “length === contador” |
| Operador esquece o filtro | Chip sempre visível + Limpar grande; limpar ao trocar de tela |
| Expectativa de “Power BI completo” | Comunicar: seleção + lista na TV, sem modelo semântico cruzado |

---

## 7. Critérios de aceite (Fase 1)

- [x] Clicar **ATRASO GRAVE** pausa a rotação e mostra as OS graves.
- [x] Clicar de novo / Esc / Limpar remove o filtro.
- [x] Quantidade no overlay = valor do contador.
- [x] Overlay **não** aperta a FILA (sem drawer side-by-side).
- [x] Demais telas e rotação continuam iguais sem drill ativo.
- [x] `TelaCompras` sem regressão (pager + marcar entregue).
- [x] Documentação deste arquivo alinhada ao que foi implementado.

---

## 8. Próximo passo sugerido

**Fase 1 + redesign TV Agora** (4 contadores + fila com grid estável + overlay).  
Próximo: **Fase 2 — Fluxo + Envelhecimento** (ver §5), reusando o mesmo overlay.

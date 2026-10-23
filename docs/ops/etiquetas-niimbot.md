# Etiquetas de plano · Niimbot B1

Gera e imprime etiquetas para equipamentos com OS **abertas** nas oficinas de plano:

- `PREVENTIVA EQUIPAMENTOS` → caixa **Manut. Preventiva**
- `CALIBRAÇÃO DE EQUIPAMENTOS` → caixa **Calibração**
- `SEGURANÇA ELÉTRICA` → caixa **Teste Seg. Elétrica**

Um equipamento pode ter só Preventiva, Prev+TSE, ou os três. A etiqueta mostra as três caixas; as aplicáveis saem sólidas com ✓.

## Kit oficial

Fonte da verdade do layout:

| Arquivo | Conteúdo |
| --- | --- |
| `docs/ops/etiqueta-aion-LEIA-ME.md` | Briefing (coordenadas 400×240 pt, tipografia, QR) |
| `docs/ops/etiqueta-aion.html` | Mock HTML/CSS escala 2× (800×480) |
| `docs/ops/etiqueta-nimbot-400x240.png` | Bitmap 1-bit 400×240 esperado |
| `docs/ops/etiqueta-preview-2x.png` | Prévia alta resolução |
| `docs/ops/etiqueta-50x30-layout.png` | Prévia gerada pelo app (`scripts/gen-etiqueta-preview.mjs`) |
| `docs/ops/etiqueta-preview-hidpi.png` | Mockup hi-DPI (CSS × DPR) capturado de `/etiquetas` |

## URLs

| Rota | Função |
| --- | --- |
| `/etiquetas` | UI: filtros, tabela, **mockup WYSIWYG**, PNG e impressão B1 |
| `/indicadores/etiquetas-plano` | Redireciona para `/etiquetas` |
| `/equipamentos/[tag]` | **Ficha vida** AionScope (fallback / link secundário do QR) |

### O que o QR abre

A API PBI `GET /api/pbi/v1/equipamentos` **não** devolve campo de URL/link do portal Effort. Campos úteis: `Id` (número interno), `Tag` (ex. `HSJ-90001`), `CodigoCliente` (no dump SJH vem 100% vazio).

**Deep link Effort confirmado** (Mobile → propriedade do equipamento):

```
https://sjh.globalthings.net/Mobile/MEquipamentoPropriedade.aspx?eqp={Id}
```

Exemplo: **HSJ-90001** → `Id=59` →

`https://sjh.globalthings.net/Mobile/MEquipamentoPropriedade.aspx?eqp=59`

Comportamento do QR:

1. **Padrão** — template `{base}/Mobile/MEquipamentoPropriedade.aspx?eqp={Id}` com `{base}` = `https://sjh.globalthings.net` (ou `NEXT_PUBLIC_ETIQUETA_QR_BASE`). O `{Id}` vem do `equipamentos.Id` da API.
2. **Override** — `NEXT_PUBLIC_EFFORT_EQUIPAMENTO_URL_TEMPLATE` se precisar de outro path.
3. **Fallback** — se `{Id}` estiver ausente → **ficha vida** AionScope `/equipamentos/{tag}`.

A UI de `/etiquetas` mostra a URL do QR e, quando Effort está ativo, a ficha vida como link secundário.

Placeholders do template: `{Id}`, `{Tag}`, `{CodigoCliente}`, `{base}`.

Defina `NEXT_PUBLIC_APP_URL=https://seu-host` no Railway/Coolify para URLs absolutas da ficha vida quando não houver `window` (na UI o QR usa `window.location.origin` como origin da ficha).

## Layout da etiqueta (50×30 mm · kit oficial)

Proporção **50:30**. Kit **400×240 pt**; bitmap B1 **384×240**. Faixa AION estreita (sem “ENGENHARIA”); sem VOID; rodapé **telefone · site**. PNG: supersample 2× + limiar 1-bit **suave** (traço fino — contraste alto entope); densidade B1 = **2**. Fonte: **Barlow Condensed**.

```
┌──────┬────────────────────────────────────┐
│AION  │ EQUIP. Nº              HSJ-90001   │
│ENG.  │ ────────────────────────────────── │
│  ○A  │ REALIZADO      07/26    ┌──────┐   │
│      │ [PRÓXIMO       07/27]   │  QR  │   │
│      │ [✓ Manut. Preventiva]   │      │   │
│      │ [✓ Calibração]          │      │   │
│      │ [  Teste Seg. Elétrica] │      │   │
│      │ tel · aion.eng.br       VOID…  │   │
└──────┴────────────────────────────────────┘
```

1. **Faixa preta (x 0–85):** logo AION + ENGENHARIA em branco, −90° (baixo→cima), 210 pt — sem “HSJ · Eng. Clínica”
2. **Header (y 8–60):** `EQUIP. Nº` + **TAG** 47 pt; linha 3 pt
3. **REALIZADO / PRÓXIMO:** data MM/AA; pill preta no próximo
4. **Caixas:** **Manut. Preventiva** / **Calibração** / **Teste Seg. Elétrica** — feitas = borda sólida + ✓; não feitas = tracejado + vazio
5. **QR:** 145×145, ECC **M**, módulo inteiro (ideal 5 pt); Effort `…?eqp={Id}`
6. **Rodapé:** `(16) 3030-0445 · aion.eng.br` + `VOID IF SEAL IS BROKEN`

A B1 pode deixar uma faixa branca mecânica à esquerda do adesivo (fora do cabeçote); o bitmap agora usa os 384 pt úteis para não cortar a direita.

Tamanho **40×30 mm** permanece opcional (escala do kit); padrão = **50×30**.

LGPD: sem CPF; apenas Tag e dados de equipamento/OS.

## Variáveis de ambiente

| Variável | Padrão | Uso |
| --- | --- | --- |
| `NEXT_PUBLIC_EFFORT_EQUIPAMENTO_URL_TEMPLATE` | `{base}/Mobile/MEquipamentoPropriedade.aspx?eqp={Id}` | Override do deep link Effort |
| `NEXT_PUBLIC_ETIQUETA_QR_BASE` | `https://sjh.globalthings.net` | Valor de `{base}` |
| `NEXT_PUBLIC_APP_URL` | _(origin do browser)_ | Base absoluta da ficha vida (fallback) |
| `NEXT_PUBLIC_ETIQUETA_BRAND` | _(vazio)_ | Não usar “HSJ · Eng. Clínica” (marca = faixa AION) |
| `NEXT_PUBLIC_ETIQUETA_SITE` | `aion.eng.br` | Site no rodapé (`tel · site`) |
| `NEXT_PUBLIC_ETIQUETA_TELEFONE` | `(16) 3030-0445` | Telefone no rodapé |
| `NEXT_PUBLIC_ETIQUETA_LOGO` | `/aion-mark.png` | Reservado (faixa usa SVG do kit) |

Exemplo no Railway/Coolify (opcional — o padrão já aponta para o Mobile Effort):

```env
NEXT_PUBLIC_ETIQUETA_TELEFONE=(16) 3030-0445
NEXT_PUBLIC_ETIQUETA_SITE=aion.eng.br
NEXT_PUBLIC_APP_URL=https://seu-host
NEXT_PUBLIC_ETIQUETA_QR_BASE=https://sjh.globalthings.net
NEXT_PUBLIC_EFFORT_EQUIPAMENTO_URL_TEMPLATE={base}/Mobile/MEquipamentoPropriedade.aspx?eqp={Id}
```

Sem Id na API, o QR cai na ficha vida AionScope.

Alterar `NEXT_PUBLIC_*` exige **rebuild/redeploy** (valores são embutidos no bundle).

## Fonte dos dados

- API: `GET /api/pbi/os-analitico` (mesmo pipeline dos indicadores).
- Aberta = `isOsAindaAberta` em `lib/pbi/volume-ec.ts` (sem Fechamento/DataDaSolucao e não cancelada).
- Mês = trabalho pendente (`PrazoDeEncerramentoOs` → `DataLimiteDaSolucao` → `Abertura`).
- Cronograma (opcional) complementa a **próxima realização** se a OS não tiver prazo.
- Id do QR: `GET /api/pbi/v1/equipamentos` → `equipamentos.Id` cruzado por Tag.

## Como usar

1. Abra `/etiquetas` no Chrome ou Edge.
2. Filtre por **setor** (e/ou busque tag/equipamento), escolha o(s) mês(es) e os tipos de plano.
3. Confira o **mockup** (50×30 por padrão) e a URL Effort do QR.
4. **PNG selecionadas** — baixe só o que marcou (também há PNG filtradas / PNG desta).
5. **Uma etiqueta** — toque/clique na linha → **Imprimir esta**, ou **B1** na tabela (desktop).
6. **Várias etiquetas** — marque os checkboxes (ou **Selecionar todas**), depois **Imprimir**. No celular a barra inferior fixa concentra a fila; **Cancelar** interrompe entre etiquetas.
7. Lista paginada (12/página); no desktop as colunas Tag / Equipamento / Setor / datas são ordenáveis.

### Celular

- Layout em **cards** + mockup no topo + **barra de ações fixa** na base.
- **Android Chrome/Edge** + HTTPS: Web Bluetooth pode imprimir direto na B1.
- **iPhone (Safari):** sem Web Bluetooth — use **PNG sel.** / **Imprimir setor** e o app Niimbot.
- Adicione à tela inicial (PWA leve via `apple-mobile-web-app`) para uso mais próximo de app.

### Fluxo operacional

| Recurso | Onde |
| --- | --- |
| Histórico “já impressa” (tag+mês) | `localStorage` neste aparelho · filtro **Ocultar já impressas** |
| **Imprimir setor** | Seleciona o setor filtrado e imprime na B1 (ou baixa PNG no iOS) |
| Pré-checagem BLE | Banner Android/iOS/desktop no topo dos filtros |
| Pacote offline | **Guardar setor offline** → IndexedDB; baixar depois sem rede |
| Traço térmico | Slider fino↔forte (limiar PNG + densidade B1) |
| **Abrir QR** | Valida o link Effort/ficha no navegador antes de gastar etiqueta |

## Impressão Niimbot B1 (Web Bluetooth)

Requisitos:

1. **Chrome** ou **Edge** (Chromium). Firefox e Safari **não** têm Web Bluetooth.
2. Página em **HTTPS** ou `localhost`. No Railway/Coolify o site já deve ser HTTPS.
3. Bluetooth ligado no celular/PC; impressora B1 ligada e com etiquetas **50×30 mm**.
4. Clique do usuário (o navegador só abre o seletor BLE em gesto humano).

Driver: `niimbot-web-bluetooth` (vendorizado em `public/vendor/niimbot.js`). Modelo B1 (`task: "b1"`, 203 dpi).

Se o BLE falhar, use o PNG no app oficial Niimbot / NiimBlue.

## Redeploy

Após merge em `main`, o Railway/Coolify faz redeploy automático do Dockerfile. Confirme a rota `/etiquetas` no host público. Se alterou `NEXT_PUBLIC_ETIQUETA_*` / `NEXT_PUBLIC_EFFORT_EQUIPAMENTO_URL_TEMPLATE` / `NEXT_PUBLIC_ETIQUETA_QR_BASE`, é obrigatório **rebuild** (não basta restart).

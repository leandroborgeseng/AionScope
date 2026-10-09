# Etiquetas de plano · Niimbot B1

Gera e imprime etiquetas para equipamentos com OS **abertas** nas oficinas de plano:

- `PREVENTIVA EQUIPAMENTOS` → caixa **M.P**
- `CALIBRAÇÃO DE EQUIPAMENTOS` → caixa **CAL.**
- `SEGURANÇA ELÉTRICA` → caixa **T.S.E**

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

## URLs

| Rota | Função |
| --- | --- |
| `/etiquetas` | UI: filtros, tabela, **mockup WYSIWYG**, PNG e impressão B1 |
| `/indicadores/etiquetas-plano` | Redireciona para `/etiquetas` |
| `/equipamentos/[tag]` | **Ficha vida** AionScope (fallback / link secundário do QR) |

### O que o QR abre

A API PBI `GET /api/pbi/v1/equipamentos` **não** devolve campo de URL/link do portal Effort. Campos úteis: `Id` (número interno), `Tag` (ex. `HSJ-00001`), `CodigoCliente` (no dump SJH vem 100% vazio).

**Deep link Effort confirmado** (Mobile → propriedade do equipamento):

```
https://sjh.globalthings.net/Mobile/MEquipamentoPropriedade.aspx?eqp={Id}
```

Exemplo: **HSJ-00001** → `Id=59` →

`https://sjh.globalthings.net/Mobile/MEquipamentoPropriedade.aspx?eqp=59`

Comportamento do QR:

1. **Padrão** — template `{base}/Mobile/MEquipamentoPropriedade.aspx?eqp={Id}` com `{base}` = `https://sjh.globalthings.net` (ou `NEXT_PUBLIC_ETIQUETA_QR_BASE`). O `{Id}` vem do `equipamentos.Id` da API.
2. **Override** — `NEXT_PUBLIC_EFFORT_EQUIPAMENTO_URL_TEMPLATE` se precisar de outro path.
3. **Fallback** — se `{Id}` estiver ausente → **ficha vida** AionScope `/equipamentos/{tag}`.

A UI de `/etiquetas` mostra a URL do QR e, quando Effort está ativo, a ficha vida como link secundário.

Placeholders do template: `{Id}`, `{Tag}`, `{CodigoCliente}`, `{base}`.

Defina `NEXT_PUBLIC_APP_URL=https://seu-host` no Railway/Coolify para URLs absolutas da ficha vida quando não houver `window` (na UI o QR usa `window.location.origin` como origin da ficha).

## Layout da etiqueta (50×30 mm · kit oficial)

Proporção **50:30**, bitmap B1 **400×240 pt @ 203 dpi** (8 pt/mm). O mockup em `/etiquetas` desenha o **mesmo layout** em coordenadas de impressão; a prévia de tela usa backing store **CSS × devicePixelRatio** (nítido em retina). PNG / Niimbot continuam no bitmap 203 dpi 1:1 — sem suavizar o dado térmico. Fonte: **Barlow Condensed**.

```
┌──────┬────────────────────────────────────┐
│AION  │ EQUIP. Nº              HSJ-00001   │
│ENG.  │ ────────────────────────────────── │
│  ○A  │ REALIZADO      07/26    ┌──────┐   │
│      │ [PRÓXIMO       07/27]   │  QR  │   │
│      │ [✓ M.P]                 │      │   │
│      │ [✓ CAL.]                │      │   │
│      │ [  T.S.E]               │      │   │
│      │ tel · aion.eng.br       VOID…  │   │
└──────┴────────────────────────────────────┘
```

1. **Faixa preta (x 0–85):** logo AION + ENGENHARIA em branco, −90° (baixo→cima), 210 pt — sem “HSJ · Eng. Clínica”
2. **Header (y 8–60):** `EQUIP. Nº` + **TAG** 47 pt; linha 3 pt
3. **REALIZADO / PRÓXIMO:** data MM/AA; pill preta no próximo
4. **Caixas:** **M.P** / **CAL.** / **T.S.E** — feitas = borda sólida + ✓; não feitas = tracejado + vazio
5. **QR:** 145×145, ECC **M**, módulo inteiro (ideal 5 pt); Effort `…?eqp={Id}`
6. **Rodapé:** `(16) 3030-0445 · aion.eng.br` + `VOID IF SEAL IS BROKEN`

A B1 pode deixar ~1 mm branco na borda da faixa preta; isso é normal.

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
2. Escolha o(s) mês(es) e os tipos PREV / CAL / TSE.
3. Confira o **mockup WYSIWYG** (50×30 por padrão) e a URL Effort do QR.
4. **Baixar PNG** — funciona em qualquer navegador (fallback).
5. **Uma etiqueta** — clique na linha (mockup) → **Imprimir esta**, ou o botão **B1** na linha.
6. **Várias etiquetas** — marque os checkboxes (ou **Selecionar todas**), depois **Imprimir selecionadas (N)**. A app conecta uma vez à B1, imprime em sequência com progresso `N de M` e erros por item; **Cancelar fila** interrompe entre etiquetas.

## Impressão Niimbot B1 (Web Bluetooth)

Requisitos:

1. **Chrome** ou **Edge** (Chromium). Firefox e Safari **não** têm Web Bluetooth.
2. Página em **HTTPS** ou `localhost`. No Railway/Coolify o site já deve ser HTTPS.
3. Bluetooth ligado no PC; impressora B1 ligada e com etiquetas **50×30 mm**.
4. Clique do usuário (o navegador só abre o seletor BLE em gesto humano).

Driver: `niimbot-web-bluetooth` (vendorizado em `public/vendor/niimbot.js`). Modelo B1 (`task: "b1"`, 203 dpi).

Se o BLE falhar, use o PNG no app oficial Niimbot / NiimBlue.

## Redeploy

Após merge em `main`, o Railway/Coolify faz redeploy automático do Dockerfile. Confirme a rota `/etiquetas` no host público. Se alterou `NEXT_PUBLIC_ETIQUETA_*` / `NEXT_PUBLIC_EFFORT_EQUIPAMENTO_URL_TEMPLATE` / `NEXT_PUBLIC_ETIQUETA_QR_BASE`, é obrigatório **rebuild** (não basta restart).

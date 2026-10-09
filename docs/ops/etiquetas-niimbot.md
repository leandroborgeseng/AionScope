# Etiquetas de plano · Niimbot B1

Gera e imprime etiquetas para equipamentos com OS **abertas** nas oficinas de plano:

- `PREVENTIVA EQUIPAMENTOS` → chip **PREV**
- `CALIBRAÇÃO DE EQUIPAMENTOS` → chip **CAL**
- `SEGURANÇA ELÉTRICA` → chip **TSE**

Um equipamento pode ter só Preventiva, Prev+TSE, ou os três. A etiqueta mostra todos os chips aplicáveis.

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

## Layout da etiqueta (50×30 mm · principal)

Proporção **50:30**, bitmap B1 **384×240 px @ 203 dpi**. O mockup em `/etiquetas` usa o **mesmo canvas** da impressão (WYSIWYG 1:1).

```
┌──────┬────────────────────────────────────┐
│AION  │ EQUIP. Nº              HSJ-00001   │
│ENG.  │ ────────────────────────────────── │
│  ○A  │ REALIZADO 07/26         ┌──────┐   │
│      │ [PRÓXIMO 07/27]         │  QR  │   │
│      │ [✓ M.P] [✓ CAL.] […]    │      │   │
│      │ tel · aion.eng.br       VOID…  │   │
└──────┴────────────────────────────────────┘
```

1. **Coluna preta (esquerda):** **AION** + **ENGENHARIA** verticais (baixo→cima) + marca circular branca — sem “HSJ · Eng. Clínica”
2. **Header:** `EQUIP. Nº` + **TAG** grande; hairline
3. **Datas:** `REALIZADO MM/AA` + pill preta `PRÓXIMO MM/AA`
4. **Caixas:** **M.P** / **CAL.** / **T.S.E** — sólidas + check quando há OS aberta do tipo; tracejadas + vazias quando N/A
5. **Direita:** QR → Effort `…?eqp={Id}` (ou ficha vida) + `VOID IF SEAL IS BROKEN`
6. **Rodapé:** `(16) 3030-0445 · aion.eng.br`

Tamanho **40×30 mm** permanece opcional; padrão e foco do mockup = **50×30**.

Prévia estática (layout): `docs/ops/etiqueta-50x30-layout.png`.

LGPD: sem CPF; apenas Tag e dados de equipamento/OS.

## Variáveis de ambiente

| Variável | Padrão | Uso |
| --- | --- | --- |
| `NEXT_PUBLIC_EFFORT_EQUIPAMENTO_URL_TEMPLATE` | `{base}/Mobile/MEquipamentoPropriedade.aspx?eqp={Id}` | Override do deep link Effort |
| `NEXT_PUBLIC_ETIQUETA_QR_BASE` | `https://sjh.globalthings.net` | Valor de `{base}` |
| `NEXT_PUBLIC_APP_URL` | _(origin do browser)_ | Base absoluta da ficha vida (fallback) |
| `NEXT_PUBLIC_ETIQUETA_BRAND` | _(vazio)_ | Não usar “HSJ · Eng. Clínica” (marca = coluna AION) |
| `NEXT_PUBLIC_ETIQUETA_SITE` | `aion.eng.br` | Site no rodapé (`tel · site`) |
| `NEXT_PUBLIC_ETIQUETA_TELEFONE` | `(16) 3030-0445` | Telefone no rodapé |
| `NEXT_PUBLIC_ETIQUETA_LOGO` | `/aion-mark.png` | Marca circular na coluna preta |

Exemplo no Railway/Coolify (opcional — o padrão já aponta para o Mobile Effort):

```env
NEXT_PUBLIC_ETIQUETA_TELEFONE=(16) 3030-0445
NEXT_PUBLIC_ETIQUETA_SITE=aion.eng.br
NEXT_PUBLIC_ETIQUETA_LOGO=/aion-mark.png
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
5. **Conectar B1** / **Imprimir** — Web Bluetooth (veja abaixo).

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

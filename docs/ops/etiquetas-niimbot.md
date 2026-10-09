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

A API PBI `GET /api/pbi/v1/equipamentos` **não** devolve campo de URL/link do portal Effort. Campos úteis para montar o deep link: `Id` (número interno), `Tag` (ex. `HSJ-03001`), `CodigoCliente` (no dump SJH vem 100% vazio). Não há padrão estável documentado no código AionScope (o portal GlobalThings só é linkado pela home `https://sjh.globalthings.net`).

Por isso o destino do QR é **configurável**:

1. Se `NEXT_PUBLIC_EFFORT_EQUIPAMENTO_URL_TEMPLATE` (ou `NEXT_PUBLIC_ETIQUETA_QR_BASE`) estiver definido → QR aponta para o **Effort** com o equipamento selecionado (placeholders abaixo).
2. Caso contrário (ou se o template exigir `{Id}` / `{CodigoCliente}` ausente) → **ficha vida** AionScope `/equipamentos/{tag}`.

A UI de `/etiquetas` mostra a URL do QR e, quando Effort está ativo, a ficha vida como link secundário.

Placeholders do template: `{Id}`, `{Tag}`, `{CodigoCliente}`, `{base}`.

Defina `NEXT_PUBLIC_APP_URL=https://seu-host` no Railway/Coolify para URLs absolutas da ficha vida quando não houver `window` (na UI o QR usa `window.location.origin` como origin da ficha).

## Layout da etiqueta (50×30 mm · principal)

Proporção **50:30**, bitmap B1 **384×240 px @ 203 dpi**. O mockup em `/etiquetas` usa o mesmo canvas que vai para a impressora (WYSIWYG).

Conteúdo (de cima para baixo / QR à direita):

1. **Logo Aion** (`/aion-logo.png` por padrão) + texto curto da marca  
2. **Tag** + nome do equipamento  
3. Chips **PREV · CAL · TSE** (só os presentes)  
4. **Realização** MM/AAAA · **Próxima** (dd/MM/yyyy ou MM/AAAA)  
5. **Site** · **telefone**  
6. **QR** → Effort (se template configurado) ou ficha vida `/equipamentos/{tag}`

Tamanho **40×30 mm** permanece opcional na UI; o padrão e o foco do mockup são **50×30**.

LGPD: sem CPF; apenas Tag e dados de equipamento/OS.

## Variáveis de ambiente

| Variável | Padrão | Uso |
| --- | --- | --- |
| `NEXT_PUBLIC_EFFORT_EQUIPAMENTO_URL_TEMPLATE` | _(vazio)_ | Template do deep link Effort. Ex.: `{base}/#/equipamento/{Id}` |
| `NEXT_PUBLIC_ETIQUETA_QR_BASE` | _(vazio → `{base}` = `https://sjh.globalthings.net`)_ | Valor de `{base}`; se setado **sem** template, vira `{base}/{Tag}` |
| `NEXT_PUBLIC_APP_URL` | _(origin do browser)_ | Base absoluta da ficha vida (fallback) |
| `NEXT_PUBLIC_ETIQUETA_BRAND` | `HSJ · Eng. Clínica` | Texto ao lado do logo |
| `NEXT_PUBLIC_ETIQUETA_SITE` | `aion.eng.br` | Site no rodapé |
| `NEXT_PUBLIC_ETIQUETA_TELEFONE` | _(vazio → "—" no mockup)_ | Telefone no rodapé |
| `NEXT_PUBLIC_ETIQUETA_LOGO` | `/aion-logo.png` | Path público do logo |

Exemplo no Railway/Coolify (Effort — **confirmar o path real com o suporte GlobalThings / um print do browser no Effort**):

```env
NEXT_PUBLIC_ETIQUETA_TELEFONE=(11) 99999-9999
NEXT_PUBLIC_ETIQUETA_SITE=aion.eng.br
NEXT_PUBLIC_ETIQUETA_LOGO=/aion-logo.png
NEXT_PUBLIC_APP_URL=https://seu-host
NEXT_PUBLIC_ETIQUETA_QR_BASE=https://sjh.globalthings.net
NEXT_PUBLIC_EFFORT_EQUIPAMENTO_URL_TEMPLATE={base}/#/equipamento/{Id}
```

Sem as variáveis Effort, o QR continua na ficha vida AionScope (comportamento anterior).

Alterar `NEXT_PUBLIC_*` exige **rebuild/redeploy** (valores são embutidos no bundle).

## Fonte dos dados

- API: `GET /api/pbi/os-analitico` (mesmo pipeline dos indicadores).
- Aberta = `isOsAindaAberta` em `lib/pbi/volume-ec.ts` (sem Fechamento/DataDaSolucao e não cancelada).
- Mês = trabalho pendente (`PrazoDeEncerramentoOs` → `DataLimiteDaSolucao` → `Abertura`).
- Cronograma (opcional) complementa a **próxima realização** se a OS não tiver prazo.

## Como usar

1. Abra `/etiquetas` no Chrome ou Edge.
2. Escolha o(s) mês(es) e os tipos PREV / CAL / TSE.
3. Confira o **mockup WYSIWYG** (50×30 por padrão).
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

Após merge em `main`, o Railway/Coolify faz redeploy automático do Dockerfile. Confirme a rota `/etiquetas` no host público e, se mudou telefone/site/logo/QR Effort, as variáveis `NEXT_PUBLIC_ETIQUETA_*` / `NEXT_PUBLIC_EFFORT_EQUIPAMENTO_URL_TEMPLATE`.

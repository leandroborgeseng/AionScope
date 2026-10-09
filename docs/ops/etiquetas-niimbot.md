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
| `/equipamentos/[tag]` | **Ficha vida** (destino estável do QR) |

Defina `NEXT_PUBLIC_APP_URL=https://seu-host` no Railway/Coolify para URLs absolutas consistentes em ambientes sem `window` (o QR na UI usa `window.location.origin`).

## Layout da etiqueta (50×30 mm · principal)

Proporção **50:30**, bitmap B1 **384×240 px @ 203 dpi**. O mockup em `/etiquetas` usa o mesmo canvas que vai para a impressora (WYSIWYG).

Conteúdo (de cima para baixo / QR à direita):

1. **Logo Aion** (`/aion-logo.png` por padrão) + texto curto da marca  
2. **Tag** + nome do equipamento  
3. Chips **PREV · CAL · TSE** (só os presentes)  
4. **Realização** MM/AAAA · **Próxima** (dd/MM/yyyy ou MM/AAAA)  
5. **Site** · **telefone**  
6. **QR** → ficha vida `/equipamentos/{tag}`

Tamanho **40×30 mm** permanece opcional na UI; o padrão e o foco do mockup são **50×30**.

LGPD: sem CPF; apenas Tag e dados de equipamento/OS.

## Variáveis de ambiente (branding)

| Variável | Padrão | Uso |
| --- | --- | --- |
| `NEXT_PUBLIC_ETIQUETA_BRAND` | `HSJ · Eng. Clínica` | Texto ao lado do logo |
| `NEXT_PUBLIC_ETIQUETA_SITE` | `aion.eng.br` | Site no rodapé |
| `NEXT_PUBLIC_ETIQUETA_TELEFONE` | _(vazio → "—" no mockup)_ | Telefone no rodapé |
| `NEXT_PUBLIC_ETIQUETA_LOGO` | `/aion-logo.png` | Path público do logo |
| `NEXT_PUBLIC_APP_URL` | _(origin do browser)_ | Base absoluta do QR |

Exemplo no Railway/Coolify:

```env
NEXT_PUBLIC_ETIQUETA_TELEFONE=(11) 99999-9999
NEXT_PUBLIC_ETIQUETA_SITE=aion.eng.br
NEXT_PUBLIC_ETIQUETA_LOGO=/aion-logo.png
NEXT_PUBLIC_APP_URL=https://seu-host
```

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

Após merge em `main`, o Railway/Coolify faz redeploy automático do Dockerfile. Confirme a rota `/etiquetas` no host público e, se mudou telefone/site/logo, as variáveis `NEXT_PUBLIC_ETIQUETA_*`.

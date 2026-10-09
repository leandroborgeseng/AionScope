# Etiquetas de plano · Niimbot B1

Gera e imprime etiquetas para equipamentos com OS **abertas** nas oficinas de plano:

- `PREVENTIVA EQUIPAMENTOS` → chip **PREV**
- `CALIBRAÇÃO DE EQUIPAMENTOS` → chip **CAL**
- `SEGURANÇA ELÉTRICA` → chip **TSE**

Um equipamento pode ter só Preventiva, Prev+TSE, ou os três. A etiqueta mostra todos os chips aplicáveis.

## URLs

| Rota | Função |
| --- | --- |
| `/etiquetas` | UI: filtros, tabela, preview, PNG e impressão B1 |
| `/indicadores/etiquetas-plano` | Redireciona para `/etiquetas` |
| `/equipamentos/[tag]` | **Ficha vida** (destino estável do QR) |

Defina `NEXT_PUBLIC_APP_URL=https://seu-host` no Railway/Coolify para URLs absolutas consistentes em ambientes sem `window` (o QR na UI usa `window.location.origin`).

## Fonte dos dados

- API: `GET /api/pbi/os-analitico` (mesmo pipeline dos indicadores).
- Aberta = `isOsAindaAberta` em `lib/pbi/volume-ec.ts` (sem Fechamento/DataDaSolucao e não cancelada).
- Mês = trabalho pendente (`PrazoDeEncerramentoOs` → `DataLimiteDaSolucao` → `Abertura`).
- Cronograma (opcional) complementa a **próxima realização** se a OS não tiver prazo.

### Campos na etiqueta

- Marca curta: `HSJ · Eng. Clínica`
- Tag + nome do equipamento (truncados)
- Chips: PREV · CAL · TSE (só os presentes)
- **Realização:** MM/AAAA (da Abertura mais antiga entre as OS do período)
- **Próxima:** dd/MM/yyyy ou MM/AAAA (prazo OS → cronograma → estimativa +1 ano)
- **QR:** URL absoluta da ficha vida `/equipamentos/{tag}`

LGPD: sem CPF; apenas Tag e dados de equipamento/OS.

## Como usar

1. Abra `/etiquetas` no Chrome ou Edge.
2. Escolha o(s) mês(es) e os tipos PREV / CAL / TSE.
3. Selecione o tamanho **50×30 mm** ou **40×30 mm** (geometria B1 @ 203 dpi).
4. Clique numa linha para pré-visualizar.
5. **Baixar PNG** — funciona em qualquer navegador (fallback).
6. **Conectar B1** / **Imprimir** — Web Bluetooth (veja abaixo).

## Impressão Niimbot B1 (Web Bluetooth)

Requisitos:

1. **Chrome** ou **Edge** (Chromium). Firefox e Safari **não** têm Web Bluetooth.
2. Página em **HTTPS** ou `localhost`. No Railway/Coolify o site já deve ser HTTPS.
3. Bluetooth ligado no PC; impressora B1 ligada e com etiquetas.
4. Clique do usuário (o navegador só abre o seletor BLE em gesto humano).

Driver: `niimbot-web-bluetooth` (vendorizado em `public/vendor/niimbot.js`). Modelo B1 (`task: "b1"`, 203 dpi).

Se o BLE falhar, use o PNG no app oficial Niimbot / NiimBlue.

## Redeploy

Após merge em `main`, o Railway/Coolify faz redeploy automático do Dockerfile. Confirme a rota `/etiquetas` no host público.

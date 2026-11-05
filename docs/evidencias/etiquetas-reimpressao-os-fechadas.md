# Evidência — reimpressão OS fechadas + setor na etiqueta

Data: 2026-11-05 (America/Sao_Paulo)  
Branch: `factory/etiquetas-reimpressao-os-fechadas`  
Aceite: E1–E10 + UX ET1–ET9 (`aceite-etiquetas-reimpressao.md`, `etiqueta-setor-nome-esboco.md`)

## Escopo entregue
1. **E1–E6** — OS fechadas do mês em `/etiquetas` (mês Fechamento/DataDaSolucao); canceladas fora; só leitura; preferir aberta no mesmo Tag/plano.
2. **E7/ET1–ET2** — ordenação padrão Tag **natural** crescente; filtro de setor mantido (inclui fechadas).
3. **E8** — setor vazio na lista/filtro = **"Sem setor"**.
4. **ET3/E9** — na B1 50×30, linha do setor **sob o Tag**, sem rótulo "SETOR:"; ≤28 chars + `…`; se vazio a linha **some** (não imprime "Sem setor"). Layout com setor: nome do equipamento em y≈52, divisor y≈64 — REALIZADO / PRÓXIMO / QR não sobrepõem.
5. **ET6–ET9 / SM-X516B** — `overflow-x-hidden` na página; chips/botões `min-h-11` (≥44 px); BLE B1 com fallback PNG + status claro. Sem app nativo.
6. **Fuso** — mês de fechamento em **America/Sao_Paulo**: OS fechada `31/10/2026 22:00` BRT (`2026-11-01T01:00:00.000Z`) conta em **outubro**, não novembro UTC (teste em `lib/etiquetas/agregar-plano.test.ts`).

## Arquivos de evidência visual
Pasta: `docs/evidencias/etiquetas-reimpressao-os-fechadas/`

| Arquivo | Critério |
| --- | --- |
| `b1-setor-curto.png` | ET4 — setor curto sob o Tag |
| `b1-setor-longo.png` | ET4 — setor longo truncado com `…` |
| `b1-setor-vazio.png` | ET3 — sem setor: linha some |
| `b1-equipamento-longo.png` | Layout com setor + nome longo; REALIZADO/PRÓXIMO/QR sem overlap |
| `viewport-800x1280.png` | ET9 — retrato SM-X516B; filtro setor; aberta+fechadas; prévia; sem overflow-x |
| `viewport-1280x800.png` | ET9 — paisagem; idem |
| `viewport-mock.html` | HTML sintético usado para os prints (dados demo TAG-2/10/3) |

Geração B1: `node scripts/gen-evidencias-etiquetas-pr22.mjs` (espelha `lib/etiquetas/render-label.ts`).

> Nota: no box, o Chrome headless recebia 403 em parte dos chunks Turbopack de `next dev`, então os viewports foram capturados do mock estático alinhado ao layout de `/etiquetas` (overflow-x hidden, filtro setor, misturando aberta/fechada, prévia B1). QA no aparelho/DevTools do Leandro fecha o ponto no app vivo.

Os PNGs antigos em `docs/ops/etiqueta-*.png` são do layout **sem** linha de setor — usar esta pasta para ET4/ET9.

## Comandos locais
```bash
npx tsc --noEmit
npx tsx --test lib/etiquetas/agregar-plano.test.ts
npx tsx --test lib/etiquetas/*.test.ts
TZ=UTC npx tsx --test lib/etiquetas/agregar-plano.test.ts   # mês BRT vs UTC
node scripts/gen-evidencias-etiquetas-pr22.mjs
```

## Viewport tablet (referência)
- Retrato **800×1280** e paisagem **1280×800** (Chrome Android / Galaxy Tab S9 FE SM-X516B).
- Prints: `viewport-800x1280.png`, `viewport-1280x800.png` (scrollWidth === clientWidth).

## Fora
Merge/deploy; app nativo; redesenho de logo/QR/telefone.

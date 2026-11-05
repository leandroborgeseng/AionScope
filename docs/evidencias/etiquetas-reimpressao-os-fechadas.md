# Evidência — reimpressão OS fechadas + setor na etiqueta

Data: 2026-11-05 (America/Sao_Paulo)  
Branch: `factory/etiquetas-reimpressao-os-fechadas`  
Aceite: E1–E9 + UX ET1–ET9 (`aceite-etiquetas-reimpressao.md`, `etiqueta-setor-nome-esboco.md`)

## Escopo entregue
1. **E1–E6** — OS fechadas do mês em `/etiquetas` (mês Fechamento/DataDaSolucao); canceladas fora; só leitura; preferir aberta no mesmo Tag/plano.
2. **E7/ET1–ET2** — ordenação padrão Tag **natural** crescente; filtro de setor mantido (inclui fechadas).
3. **E8** — setor vazio na lista/filtro = **"Sem setor"**.
4. **ET3/E9** — na B1 50×30, linha do setor **sob o Tag**, sem rótulo "SETOR:"; ≤28 chars + `…`; se vazio a linha **some** (não imprime "Sem setor").
5. **ET6–ET9 / SM-X516B** — `overflow-x-hidden` na página; chips/botões `min-h-11` (≥44 px); BLE B1 com fallback PNG + status claro (já existente). Sem app nativo.

## Comandos locais
```bash
npx tsc --noEmit
npx tsx --test lib/etiquetas/agregar-plano.test.ts
npx tsx --test lib/etiquetas/*.test.ts
```

## Viewport tablet (referência)
- Retrato 800×1280 e paisagem 1280×800 (Chrome Android / Galaxy Tab S9 FE SM-X516B).
- QA visual no aparelho do Leandro ou DevTools device mode nesses viewports: filtros + lista + prévia sem scroll horizontal; barra inferior alcançável.

## Fora
Merge/deploy; app nativo; redesenho de logo/QR/telefone.

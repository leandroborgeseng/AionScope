# Evidência — reimpressão de etiquetas de OS fechadas

Data: 2026-11-05 (America/Sao_Paulo)  
Branch: `factory/etiquetas-reimpressao-os-fechadas`  
Aceite: `aceite-etiquetas-reimpressao.md` (E1–E6)

## O que mudou

- `lib/etiquetas/agregar-plano.ts`: com `monthKeys`, inclui OS **fechadas** (não canceladas) pelo mês de `Fechamento`/`DataDaSolucao` (mesmo critério FECH. do painel). Preferência R1: aberta > fechada mais recente. Sem mês → só abertas (R2).
- Opção `incluirFechadas` em `AgregarEtiquetasOptions` (default = há mês).
- UI `/etiquetas`: texto de filtros esclarece abertas vs fechadas.
- Testes ZZTESTE cobrindo E1–E5, R1, R2. Sem dados de hospital.

## Comandos

```bash
npx tsc --noEmit
npx tsx --test lib/etiquetas/agregar-plano.test.ts
npx tsx --test lib/etiquetas/*.test.ts
```

Resultado local (2026-11-05): `tsc` ok; 13/13 em `agregar-plano.test.ts`; 35/35 nos testes de `lib/etiquetas`.

## Fora deste PR

- Merge e deploy.
- Alteração no Effort / reabertura de OS.
- Histórico de impressão em servidor.

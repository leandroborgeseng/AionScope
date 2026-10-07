# Treinamentos · bombas de infusão B. Braun

Painel de desempenho da Engenharia Clínica (HSJ / Unimed Franca).

## Rotas

| Rota | Uso |
| --- | --- |
| `/indicadores/treinamentos-bombas` | Painel completo (KPIs, gráficos, tabela, evidências) |
| `/sala/treinamentos` | Tela TV: maturidade (já aptos), setores e abertura das listas PDF (sem nomes) |
| `/api/treinamentos/resumo` | JSON agregado (sem nomes) |
| `/api/treinamentos/evidencias/2025` · `/2026` | PDFs (token obrigatório) |

A tela `treinamentos` entra na rotação padrão da Sala TV (após Indicadores).

## Dados

Fonte canônica: `data/treinamentos/treinamentos.json` (728 linhas).  
KPIs e setores são **calculados** em `lib/treinamentos/calcular.ts` (os JSON de resumo servem de teste).

Valores de referência: 434 (2025) · 294 (2026) · 227 já aptos (sem reforço) · 207 recorrentes · 47,7% · 87 novos · ≈181 h / 147 h.

Narrativa: treinamento **opcional**. Quem não participou no ano atual em geral já domina o equipamento — maturidade da equipe, não regressão.

Padronização de setores: `lib/treinamentos/setores.ts` (editável).

## Evidências (LGPD)

O repositório é público. Os PDFs **não** são commitados.

1. No painel `/indicadores/treinamentos-bombas` → **Listas de presença (PDF)** → **Enviar / atualizar lista** (grava no volume `/data/treinamentos-evidencias`).

2. Alternativa: copiar os PDFs manualmente no volume:

```text
/data/treinamentos-evidencias/2025_lista_presenca_bomba_infusao.pdf
/data/treinamentos-evidencias/2026_lista_presenca_bomba_infusao.pdf
```

3. (Opcional) `TREINAMENTOS_EVIDENCIAS_TOKEN` e `TREINAMENTOS_EVIDENCIAS_PATH`.

- Sem token: upload/abertura liberados (painel privado).
- Com token: desbloqueio grava cookie 8 h; token errado → 401.
- PDFs **não** vão no git (LGPD / CPF no 2026).

## Atualizar ano novo

Acrescente linhas em `treinamentos.json` (mesmo esquema). Recalcular é automático. Preferir campo **Setor** no Google Forms a partir de 2027.

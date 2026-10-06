# Treinamentos · bombas de infusão B. Braun

Painel de desempenho da Engenharia Clínica (HSJ / Unimed Franca).

## Rotas

| Rota | Uso |
| --- | --- |
| `/indicadores/treinamentos-bombas` | Painel completo (KPIs, gráficos, tabela, evidências) |
| `/sala/treinamentos` | Tela TV (KPIs + taxa por setor, sem nomes) |
| `/api/treinamentos/resumo` | JSON agregado (sem nomes) |
| `/api/treinamentos/evidencias/2025` · `/2026` | PDFs (token obrigatório) |

A tela `treinamentos` entra na rotação padrão da Sala TV (após Indicadores).

## Dados

Fonte canônica: `data/treinamentos/treinamentos.json` (728 linhas).  
KPIs e setores são **calculados** em `lib/treinamentos/calcular.ts` (os JSON de resumo servem de teste).

Valores de referência: 434 (2025) · 294 (2026) · −32,3% · 207 reciclados · 47,7% · 87 novos · ≈181 h / 147 h.

Padronização de setores: `lib/treinamentos/setores.ts` (editável).

## Evidências (LGPD)

O repositório é público. Os PDFs **não** são commitados.

1. No Coolify (ou local), copie para o volume:

```text
/data/treinamentos-evidencias/2025_lista_presenca_bomba_infusao.pdf
/data/treinamentos-evidencias/2026_lista_presenca_bomba_infusao.pdf
```

2. Defina `TREINAMENTOS_EVIDENCIAS_TOKEN` (e opcionalmente `TREINAMENTOS_EVIDENCIAS_PATH`).

3. No painel, informe o token em **Evidências** para gravar cookie de sessão (8 h) e abrir os PDFs.

Sem token configurado, a API responde 503; com token errado, 401.

## Atualizar ano novo

Acrescente linhas em `treinamentos.json` (mesmo esquema). Recalcular é automático. Preferir campo **Setor** no Google Forms a partir de 2027.

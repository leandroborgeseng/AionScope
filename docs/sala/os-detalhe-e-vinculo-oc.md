# Detalhe da OS + vínculo OC↔OS + oficinas de plano

Notas curtas · 06/10/2026

## 1) Clique na OS → detalhe operacional (TV Agora)

- Snapshot inclui `osDetalhes[numeroOs]` (`lib/ec/os-detalhe.ts` + `montar-snapshot.ts`).
- Campos: solicitação (requisição/serviço/ocorrência/obs), pendência, flags **manutenção externa (EXT)** e **pendência compra**, abertura, 1º atendimento, setor, tag, criticidade, responsável, situação, oficina.
- UI: clique na **fila** ou linha do **drill overlay** abre painel (`SalaOsDetalhePainel` em `sala-app.tsx`). Esc fecha o detalhe antes do drill.
- Demo: `/sala/agora?demo=1`.

## 2) Vincular OC a OS aberta

- Página: `/sala/ordens-compra` — campo `OsVinculoField` com busca (não só texto livre).
- API: `GET /api/sala/os-abertas?q=` (sugestões) e `?numero=` (status; avisa se fechada).
- PATCH existente de `numero_os` permanece; edição manual continua protegida no store.

## 3) Indicadores — abertas × fechadas por oficina de plano

- URL canônica: `/indicadores/oficinas-plano-abertas-fechadas`
- Tabela comparativa Preventiva / Calibração / TSE mês a mês no ano vigente + gráfico consolidado/filtros.
- Allowlist EC (sem Oficina Geral). Narrativa: proxy de cumprimento do cronograma.

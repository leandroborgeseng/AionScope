# Ciclo de vida · EOL, EOS e investimentos

## TV (`/sala/ciclo-de-vida`)

- **Valor de substituição do parque:** KPI no topo (`ciclo.valorSubstituicaoParque` / `valorSubstituicaoParqueNumero`) — soma ValorDeSubstituicao (fallback aquisição) dos ativos.
- **EOL (EndOfLife):** gráfico superior de 10 anos (ano corrente+1 … +10). Clique no ano → overlay com lista; chip **EOL YYYY**.
- **EOS (EndOfService):** gráfico imediatamente abaixo, mesma linguagem visual (azul/âmbar). Clique → chip **EOS YYYY**. EOS é o sinal mais crítico para peça/suporte.
- Em cada barra (EOL e EOS): quantidade + **% do valor do parque** (`investimento / valorSubstituicaoParqueNumero`). Hover/title: valor em BRL + qtd.
- **FIM DE SERVIÇO PRÓXIMO:** lista secundária baseada em **EndOfService** (vencido ou no horizonte), não EndOfLife. Payload legado: `fimDeVida` / `quantidadeFimDeVida`.
- Snapshot: `ciclo.previsaoEol` e `ciclo.previsaoEos` (quantidade, `investimento` = soma ValorDeSubstituicao, `itens[]` para drill).
- Botão **Relatório de investimentos** abre nova aba.

## Relatório (`/sala/ciclo-de-vida/investimentos`)

HTML interativo (não é a TV escalada):

- Gráfico + tabela de investimento anual se o parque for substituído no ano de **EOL** vs **EOS**.
- Filtro: Só EOL / Só EOS / Ambos (horizonte fixo 10 anos).
- Clique no ano → detalhe dos equipamentos.
- **Exportar PDF** = `window.print()` (Salvar como PDF no diálogo do navegador).
- Fonte: mesmo snapshot da Sala (`/api/sala/snapshot`), equipamentos médicos ATIVOS EC. Demo: `?demo=1`.

## Drill ids

| Bloco | Id | Chip |
|---|---|---|
| Barras EOL | `ciclo.eol.{ano}` | EOL YYYY |
| Barras EOS | `ciclo.eos.{ano}` | EOS YYYY |

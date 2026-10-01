# Progresso Sala EC — 01/10/2026 (sessão contínua)

Resumo do que já está no ar (branch + `main` Coolify):

## Feito nesta rodada

1. **Pedidos de compra**
   - CRUD em `/sala/pedidos` (criar / editar / apagar)
   - Sync M365 opcional (mesmo endpoint)
   - Tela **Compras** de volta na rotação da TV
   - Menu Sala → Pedidos

2. **Proxies rotulados na TV**
   - Parada = Abertura→Fechamento (texto em Agora)
   - Programadas = OS fechada no mês (texto sob o cumprimento)

3. **Processos enxutos**
   - Só P01–P03 + fora do horário + melhorias opcionais
   - P04–P07 fora dos cartões da TV

4. **Custo / parque**
   - KPI oficial = só custo de OS ÷ valor de substituição
   - Contratos informativos / fora do plano da Sala

5. **Envelhecimento**
   - “Sem movimento” ≈ dias desde `DataDoAtendimento` (ou Abertura se ainda sem 1º)
   - KPI “> 7 dias” deixa de ser sempre “—”

## Ainda depende de você

- Credenciais M365 (`M365_TENANT_ID`, `M365_CLIENT_ID`, `M365_CLIENT_SECRET`) para importar e-mail de verdade
- Coolify redeploy a partir de `main` (já recebe os commits)

## Próximo quando voltar

- Revisar pedidos reais vs parser de e-mail
- Ajustes finos de layout TV (Compras / Processos)
- Autenticação leve em `/sala/pedidos` e `/sala/registros` (ainda abertos na rede)

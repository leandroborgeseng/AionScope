# Padrão de e-mail para pedidos de compra — Engenharia Clínica AION · HSJ

Vale para todo pedido enviado de **leandro.borges@aion.eng.br** ou **oficina@aion.eng.br** para **compras@hsj.com.br** e/ou **manutencao@hsj.com.br**.

## Assunto (obrigatório)

```
[OS 202609588] Solicitação de compra – Placa de potência – Bisturi elétrico HSJ-01174
```

- Sempre começa com `[OS ` + número da OS do Effort + `]`.
- Um pedido por e-mail. Vários itens da mesma OS podem ir no mesmo e-mail.
- Nunca mudar o assunto ao responder ou cobrar: o sistema agrupa a conversa pelo assunto e pela thread.
- Sem OS ainda? Abra a OS primeiro. Se não for possível, use `[SEM OS]`. O pedido aparece na TV como "vincular a uma OS".

## Corpo (modelo)

```
OS: 202609588
Equipamento: Bisturi elétrico · TAG HSJ-01174
Setor: Centro Cirúrgico 10A
Item(ns):
  1. Placa de potência · ref. fabricante XXXX · qtd 1
Fornecedor sugerido (se houver): ...
Urgência: Alta (equipamento parado)
```

## Resposta da Manutenção (pedir que sigam)

Responder **na mesma conversa** com o número da SC numa linha própria:

```
SC: 48213
```

O sistema aceita também "SC nº 48213", "SC-48213" e "Solicitação de compra 48213". Peça à Manutenção para manter um desses formatos.

## Entrega

Quando a peça chegar, a EC **baixa a OS no Effort com a data da entrega**. Essa data fecha o pedido. Se a OS precisar continuar aberta após a entrega (instalação, testes), registre a entrega como lançamento na OS ou responda no e-mail com `ENTREGUE: dd/mm/aaaa`.

## Datas que o sistema registra

| Marco | De onde vem |
|---|---|
| Envio do pedido | data/hora do e-mail enviado (Itens Enviados) |
| SC criada | data/hora da resposta da Manutenção que contém o nº da SC |
| Entrega | data de baixa da OS no Effort (ou `ENTREGUE:` no e-mail) |

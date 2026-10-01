# Microsoft 365 — acesso só-leitura aos e-mails de compra (AION)

Os pedidos saem de `leandro.borges@aion.eng.br` e `oficina@aion.eng.br` para `compras@hsj.com.br` / `manutencao@hsj.com.br`. A Sala lê **Itens Enviados** e a **Caixa de Entrada** dessas duas caixas via Microsoft Graph (`Mail.Read` de aplicação). Nenhum e-mail é enviado pelo app.

**Sem M365 ainda:** o acompanhamento já funciona com cadastro/edição manual em `/sala/pedidos` (a TV em `/sala/compras` usa os mesmos registros). Este guia só liga a importação automática do Outlook.

Padrão de assunto/corpo: `docs/design/sala/PADRAO_EMAIL_COMPRAS.md`.

## 1. Registrar o aplicativo no Entra ID

1. Portal [Microsoft Entra](https://entra.microsoft.com) → **Aplicativos** → **Registros de aplicativo** → **Novo registro**.
2. Nome sugerido: `AionScope Sala Compras`.
3. Tipos de conta: **Somente esta organização**.
4. URI de redirecionamento: deixe em branco (fluxo client credentials).
5. Anote:
   - **ID do aplicativo (cliente)** → `M365_CLIENT_ID`
   - **ID do diretório (locatário)** → `M365_TENANT_ID`

## 2. Segredo do cliente

1. No app → **Certificados e segredos** → **Novo segredo do cliente**.
2. Descrição: `Coolify produção`, validade curta (ex.: 12 meses).
3. Copie o **Valor** na hora → `M365_CLIENT_SECRET` (não aparece de novo).

Alternativa mais segura: certificado (`.pem`) em vez de segredo; o código atual usa segredo.

## 3. Permissão de aplicação

1. **Permissões de API** → **Adicionar permissão** → **Microsoft Graph** → **Permissões do aplicativo**.
2. Marque **`Mail.Read`**.
3. **Conceder consentimento do administrador** para o tenant AION.

Não use `Mail.ReadWrite` nem `Mail.Send`.

## 4. Restringir o app só às duas caixas

Sem isso, `Mail.Read` de aplicativo enxerga todas as caixas do tenant. Restrinja com *Application Access Policy* (Exchange Online).

No PowerShell (Exchange Online / Microsoft Graph PowerShell), como admin:

```powershell
# Conecte ao Exchange Online
Connect-ExchangeOnline

# Grupo com as caixas permitidas (crie se ainda não existir)
New-DistributionGroup -Name "AionScope-MailRead" -Type Security -Members `
  "leandro.borges@aion.eng.br","oficina@aion.eng.br"

# Política: o app só acessa esse grupo
New-ApplicationAccessPolicy `
  -AppId "<M365_CLIENT_ID>" `
  -PolicyScopeGroupId "AionScope-MailRead" `
  -AccessRight RestrictAccess `
  -Description "AionScope Sala — só Itens Enviados/Inbox das caixas EC"

# Conferência
Test-ApplicationAccessPolicy `
  -Identity "leandro.borges@aion.eng.br" `
  -AppId "<M365_CLIENT_ID>"
# AccessCheckResult deve ser Granted

Test-ApplicationAccessPolicy `
  -Identity "alguem.outro@aion.eng.br" `
  -AppId "<M365_CLIENT_ID>"
# AccessCheckResult deve ser Denied
```

Propagação pode levar de minutos a ~1 h.

## 5. Variáveis no Coolify / `.env.local`

```bash
M365_TENANT_ID=
M365_CLIENT_ID=
M365_CLIENT_SECRET=
M365_CAIXAS=leandro.borges@aion.eng.br,oficina@aion.eng.br
COMPRAS_DESTINOS=compras@hsj.com.br,manutencao@hsj.com.br
COMPRAS_PRAZO_SC_DIAS_UTEIS=2
COMPRAS_PRAZO_ENTREGA_DIAS=15
# Opcional: forçar sync no boot do snapshot (segundos). 0 = só sob demanda / cron.
COMPRAS_SYNC_MIN_SECONDS=300
```

Nunca coloque esses valores no git.

## 6. Validar no servidor

Com o app no ar e as variáveis setadas:

```bash
# Lista os 30 últimos e-mails filtrados (assunto + trecho, sem anexos)
npx tsx scripts/compras-amostra.ts

# Sincroniza e grava em SQLite
npx tsx scripts/compras-sync.ts
```

Ou `POST /api/sala/compras/sync` (sem body). Resposta `configurado: false` = faltam variáveis; `401/403` do Graph = permissão ou policy.

## 7. O que o app faz depois

- Delta query em Sent Items + Inbox de cada caixa.
- Só persiste: enviados **para** `COMPRAS_DESTINOS`; recebidos **de** `@hsj.com.br` em conversa já conhecida.
- Extrai OS / TAG / SC por regra (`lib/compras/parse-email.ts`).
- Alimenta a TV `/sala/compras` e a lista em `/compras` (aba e-mail).

Quando o Entra estiver pronto, basta colar as três variáveis no Coolify e redeployar (ou só reiniciar o container se o env já for lido em runtime).

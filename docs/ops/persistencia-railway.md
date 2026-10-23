# Persistência no Railway (SQLite + uploads)

## Sintoma

Ordens via API, anexos e PDFs de treinamento **somem** após redeploy ou restart.

## Causa

O container Railway é **efêmero**. Sem Volume montado em `/data`, o app grava em `/app/data` e tudo some no próximo deploy.

Outra causa: Volume montado em `/data` como **root**, usuário `nextjs` sem permissão → fallback silencioso para disco efêmero. O `docker-entrypoint.sh` corrige o `chown` na subida.

## Checklist Railway

1. Serviço → **Settings → Volumes**
2. **Add Volume** (ou anexe um existente)
3. **Mount path:** `/data` (exato)
4. Variables:
   - `DATABASE_PATH=/data/aionscope.sqlite`
   - (opcional) `ORDENS_COMPRA_ANEXOS_PATH=/data/ordens-compra-anexos`
   - (opcional) `TREINAMENTOS_EVIDENCIAS_PATH=/data/treinamentos-evidencias`
5. **Redeploy**

## Conferir

```bash
curl -s 'https://SEU-HOST/api/v1/health?persistencia=1' | jq
```

Esperado:

- `persistencia.ok: true`
- `persistencia.ephemeral: false`
- `persistencia.databasePath` começa com `/data/`
- `persistencia.ordensCompra` > 0 depois de enviar a API

Sobrevivência ao redeploy: anote `persistencia.ordensCompra` e `persistencia.databaseBytes` antes do redeploy e confira que se mantêm depois. (O antigo `?stamp=1`, que gravava um arquivo no volume por um GET público, foi removido.)

## Depois de corrigir o volume

Reenvie o lote da API de ordens de compra e faça upload de novo das listas PDF no painel de treinamentos (dados antigos no disco efêmero não voltam).

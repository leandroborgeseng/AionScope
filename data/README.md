# Cadastros locais

Persistência principal: **SQLite** (`DATABASE_PATH`, default `/data/aionscope.sqlite`).
Os JSON abaixo existem só para **seed** na primeira abertura (se as tabelas estiverem vazias).

| Arquivo | Uso |
| --- | --- |
| `parque.json` | Seed legado do valor do parque |
| `contratos.json` | Seed legado de contratos |
| `aionscope.sqlite` | DB local (gitignored) quando `/data` não é gravável |

Schema: `lib/db/schema.ts` (`parque_meta`, `contratos`).

## Railway

1. Crie um **Volume** e monte em `/data`.
2. Defina `DATABASE_PATH=/data/aionscope.sqlite`.
3. Tokens `PBI_*` nas Variables.

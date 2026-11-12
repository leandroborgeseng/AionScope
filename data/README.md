# Cadastros locais

Persistência principal: **SQLite** (`DATABASE_PATH`, default `/data/aionscope.sqlite`).
Os JSON abaixo existem só para **seed** na primeira abertura (se as tabelas estiverem vazias).

| Arquivo | Uso |
| --- | --- |
| `parque.json` | Seed legado do valor do parque |
| `contratos.json` | Seed legado de contratos |
| `setores-effort-20261111.csv` | Lista de setores do Effort (código, nome, unidade, ativo). Sem pessoas. Export de 11/11/2026 21:30 BRT. A migration 017 faz a carga. |
| `aionscope.sqlite` | DB local (gitignored) quando `/data` não é gravável |

Schema: `lib/db/schema.ts` (`parque_meta`, `contratos`).

## Railway

1. Crie um **Volume** e monte em `/data`.
2. Defina `DATABASE_PATH=/data/aionscope.sqlite`.
3. Tokens `PBI_*` nas Variables.

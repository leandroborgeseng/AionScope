# Login do painel

Um usuário e uma senha protegem o site inteiro. A sessão de administrador dos contratos continua por cima, nas escritas.

## Variáveis

Nomes apenas. O valor fica no ambiente (Coolify), nunca no git.

| Nome | Papel |
| --- | --- |
| `AIONSCOPE_PAINEL_USUARIO` | Usuário do login único |
| `AIONSCOPE_PAINEL_SENHA` | Senha do login único |
| `SESSION_SECRET` | Assina o cookie (HMAC-SHA256). Mínimo 32 caracteres. A mesma variável da sessão de admin |
| `AIONSCOPE_PAINEL_GERACAO` | Opcional, até 64 caracteres. Entra no payload assinado. Trocar o valor derruba todas as sessões. Vazio é a geração padrão |
| `AIONSCOPE_PAINEL_ORIGENS` | Opcional. Origens extras do login e do logout (`https://host`, vírgula), quando o host interno difere do site |

Se faltar usuário, senha ou `SESSION_SECRET`, o painel fica fechado: páginas vão para `/login` com o texto "Login indisponível" e as APIs respondem 503. O formulário não aceita credencial.

`TRUST_CF_CONNECTING_IP` (já existente) define o IP do limite de tentativas. Com `true`, vale `CF-Connecting-IP`. Com `false`, vale o último `X-Forwarded-For` ou `x-real-ip`, como no formulário do convite.

## Sessão

Cookie `aion_painel_sessao`: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` em produção. O navegador guarda o cookie por 90 dias. O servidor impõe um teto absoluto de 8 horas desde o login: o payload assinado leva `auth_time` (o instante do login) junto com `iat`, `exp`, `j` e a geração. A renovação, se ocorrer, reemite `iat` e `exp` e preserva `auth_time` e `j`. Passadas 8 horas, a página volta para `/login` e a API responde 401, mesmo com uso contínuo. Cookie antigo, sem `auth_time` ou sem `j`, não abre. Assinatura inválida, geração diferente ou cookie vencido também não.

`j` identifica aquela sessão. `POST /api/v1/painel/logout` e `DELETE /api/cadastros/contratos/sessao` gravam o `j` em `painel_sessao_revogacao` até o teto de 8 horas (migration 020, só cria a tabela). Um cookie copiado antes do logout recebe 401. Outra sessão, com outro `j`, continua válida. Trocar `AIONSCOPE_PAINEL_GERACAO` continua derrubando todas, sem precisar da lista.

`POST /api/v1/painel/login` e `POST /api/v1/painel/logout` exigem `Origin` com o mesmo host do pedido. Sem o header `Origin`, vale o `Referer`. A lista `AIONSCOPE_PAINEL_ORIGENS` soma origens permitidas. Origem ausente ou de outro host: 403, sem `Set-Cookie`.

`POST /api/v1/painel/logout` apaga o cookie quando a origem confere. O botão **Sair** fica no layout.

Cinco falhas em 15 minutos, por IP, respondem 429 com `Retry-After`. O contador usa a tabela `bot_convite_limite` com outra chave, e não mistura com a cota do convite.

## Allowlist do proxy

O arquivo é `middleware.ts` com `runtime` Node. A lista abaixo é a mesma de antes.

Tudo o que não está aqui exige o cookie. Página sem cookie: 302 para `/login?next=<caminho interno>`. API (`/api/...`) sem cookie: 401 JSON. `next` só aceita caminho relativo interno.

Rotas exatas:

- `/login` — a tela de entrada
- `/api/v1/health` — diagnóstico, sem dado de convidado
- `/api/v1/painel/login` — recebe a credencial
- `/api/v1/painel/logout` — apaga o cookie mesmo se a sessão já estiver vencida

Convite público, um segmento só, token no formato que o app aceita (`[A-Za-z0-9_-]{20,200}`):

- `/convite/<token>` — a página e o POST do pré-cadastro são a mesma rota. Não libera `/convite`, `/conviteadmin` nem `/convite/<token>/outro`

API do robô, que já exige `ORDENS_COMPRA_API_KEY` na própria rota. O cookie do painel não substitui a chave:

- `/api/v1/ordens-compra`
- `/api/v1/ordens-compra/<resto>` (lote, número, anexos)

Não entra `/api/v1/ordens-compra-extra` nem `/api/sala/ordens-compra` (esta é a tela, fica atrás do login).

Não há rota de canal do bot com chave própria (`app/api/bot` não existe). O cadastro do bot (`/api/cadastros/bot-usuarios` e `/admin/bot-usuarios`) fica atrás do login do site e, nas mutações, da sessão de admin.

Estáticos, para a tela de login e os arquivos de `public/`:

- `/_next/static/<arquivo>`
- `/_next/image`
- `/favicon.ico`
- `/aion-logo.png`
- `/aion-mark.png`
- `/file.svg`
- `/globe.svg`
- `/next.svg`
- `/vercel.svg`
- `/window.svg`
- `/vendor/niimbot.js`

`/_next/data` e o restante de `/_next` não entram.

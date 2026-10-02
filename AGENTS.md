<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

- Dependências: `npm ci` (Node.js 22 já está na imagem). `better-sqlite3` usa o prebuild publicado.
- Se `.env.local` não existir, copie `.env.example`. Os tokens `PBI_TOKEN_*` e `M365_*` podem ficar vazios: a interface sobe, e `/sala/registros` grava no SQLite. As páginas da GlobalThings mostram o aviso de token ausente.
- `DATABASE_PATH=/data/aionscope.sqlite` cai para `data/aionscope.sqlite` quando `/data` não é gravável.
- Servidor: `npm run dev -- --hostname 0.0.0.0 --port 3000`. Abra `http://127.0.0.1:3000` ou `http://localhost:3000`. `allowedDevOrigins` inclui `127.0.0.1` para os assets de desenvolvimento.
- `npm test` e `npx tsc --noEmit` passam. `npm run lint` falha por achados já existentes de `react-hooks`.
- `npm run build` (Turbopack) falha em `next/font/google`. `npx next build --webpack` conclui.

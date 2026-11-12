/**
 * Compara usuário e senha do painel. Só no runtime Node (rota de login).
 * Os dois lados viram SHA-256 antes do timingSafeEqual, então o tamanho
 * da senha não vaza e os dois campos são sempre conferidos.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { PAINEL_SENHA_ENV, PAINEL_USUARIO_ENV, painelConfigurado } from "@/lib/auth/painel-sessao";

const USUARIO_MAX = 200;
const SENHA_MAX = 500;

function digest(valor: string) {
  return createHash("sha256").update(valor, "utf8").digest();
}

export function credencialConfere(usuario: unknown, senha: unknown) {
  const informadoUsuario = typeof usuario === "string" ? usuario.trim() : "";
  const informadoSenha = typeof senha === "string" ? senha : "";
  const esperadoUsuario = (process.env[PAINEL_USUARIO_ENV] ?? "").trim();
  const esperadoSenha = (process.env[PAINEL_SENHA_ENV] ?? "").trim();
  const usuarioOk = timingSafeEqual(digest(informadoUsuario), digest(esperadoUsuario));
  const senhaOk = timingSafeEqual(digest(informadoSenha), digest(esperadoSenha));
  const tamanhoOk =
    informadoUsuario.length > 0 &&
    informadoUsuario.length <= USUARIO_MAX &&
    informadoSenha.length > 0 &&
    informadoSenha.length <= SENHA_MAX;
  return painelConfigurado() && tamanhoOk && usuarioOk && senhaOk;
}

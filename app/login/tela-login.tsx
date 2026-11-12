export function TelaLogin({
  disponivel,
  next,
  erro,
}: {
  disponivel: boolean;
  next: string | null;
  erro: string | undefined;
}) {
  const mensagem =
    erro === "1"
      ? "Usuário ou senha incorretos."
      : erro === "limite"
        ? "Muitas tentativas. Tente de novo em alguns minutos."
        : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-8">
      <div className="w-full rounded-2xl border border-aion-line bg-white px-4 py-6 shadow-[var(--aion-shadow)] sm:px-6">
        <img src="/aion-logo.png" alt="Aion Engenharia" className="h-10 w-auto max-w-full object-contain object-left" />
        <h1 className="mt-5 text-xl font-semibold text-aion-ink">Entrar no AionScope</h1>
        <p className="mt-1 text-sm text-aion-muted">Acesso restrito a convidados.</p>
        {disponivel ? (
          <form method="post" action="/api/v1/painel/login" className="mt-6 space-y-4">
            {next ? <input type="hidden" name="next" value={next} /> : null}
            {mensagem ? (
              <p role="alert" className="rounded-lg bg-aion-mist px-3 py-2 text-sm font-medium text-aion-ink">
                {mensagem}
              </p>
            ) : null}
            <div>
              <label htmlFor="usuario" className="mb-1.5 block text-sm font-semibold text-aion-ink">
                Usuário
              </label>
              <input
                id="usuario"
                name="usuario"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                maxLength={200}
                className="h-11 w-full rounded-lg border border-aion-line bg-white px-3 text-base text-aion-ink focus:border-aion-blue focus:outline-none focus:ring-2 focus:ring-aion-blue/20"
              />
            </div>
            <div>
              <label htmlFor="senha" className="mb-1.5 block text-sm font-semibold text-aion-ink">
                Senha
              </label>
              <input
                id="senha"
                name="senha"
                type="password"
                autoComplete="current-password"
                required
                maxLength={500}
                className="h-11 w-full rounded-lg border border-aion-line bg-white px-3 text-base text-aion-ink focus:border-aion-blue focus:outline-none focus:ring-2 focus:ring-aion-blue/20"
              />
            </div>
            <button
              type="submit"
              className="h-11 w-full rounded-lg bg-aion-blue text-base font-semibold text-white hover:bg-aion-deep"
            >
              Entrar
            </button>
          </form>
        ) : (
          <p role="alert" className="mt-6 text-sm font-semibold text-aion-ink">
            Login indisponível
          </p>
        )}
      </div>
    </main>
  );
}

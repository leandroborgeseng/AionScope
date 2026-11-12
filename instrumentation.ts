/** Next.js: roda uma vez ao subir o servidor. Inicia a renovação agendada da cópia da GlobalThings. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { textoAvisoOrigens } = await import("./lib/bot/origem");
  console.warn(textoAvisoOrigens());
  if (process.env.PBI_SCHEDULER === "off") return;
  const { startPbiScheduler } = await import("./lib/pbi/scheduler");
  startPbiScheduler();
}

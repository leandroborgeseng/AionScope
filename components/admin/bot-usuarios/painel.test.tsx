import "./setup-dom";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, describe, test } from "node:test";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PAPEIS_BOT_PADRAO } from "@/lib/bot/papeis";
import {
  TEXTO_AJUDA_CONFLITO,
  TEXTO_AJUDA_MOTIVO,
  TEXTO_ERRO,
  TEXTO_ESCOLHA_PAPEL,
  TEXTO_PAPEL_PENDENTE,
  TEXTO_SEM_PERMISSAO,
  TEXTO_TOAST_REVELAR,
  TEXTO_VAZIO_CADASTRADOS,
  TEXTO_VAZIO_PENDENTES,
  textoToastAprovar,
  type UsuarioBot,
} from "@/lib/bot/apresentacao";
import { PainelBotUsuarios, type ResultadoAcao } from "./painel";

function pessoa(parcial: Partial<UsuarioBot> & Pick<UsuarioBot, "id" | "nome" | "situacao">): UsuarioBot {
  return {
    papel: "Compras",
    telefone_mascarado: "+55 11 •••••-0001",
    dono: "dpo",
    email_mascarado: null,
    setor: "UTI Exemplo",
    outros_setores: "Plantão exemplo",
    aprovado_por: null,
    criado_em: "2026-11-10T15:00:00.000Z",
    atualizado_em: "2026-11-10T15:00:00.000Z",
    verificado_em: null,
    entrega_status: "pendente",
    entrega_pedido_em: null,
    motivo_recusa: null,
    ...parcial,
  };
}

const ANA = pessoa({
  id: "11111111-1111-4111-8111-111111111111",
  nome: "Ana Exemplo",
  situacao: "pendente",
  setor: "UTI <script>ZZALERTA</script>",
});
const BRUNO = pessoa({
  id: "22222222-2222-4222-8222-222222222222",
  nome: "Bruno Exemplo",
  situacao: "ativo",
  papel: "Manutenção",
  dono: "plantao",
  telefone_mascarado: "+55 11 •••••-0002",
  entrega_status: "falhou",
});

let raiz: Root | null = null;

function base(extra: Partial<Parameters<typeof PainelBotUsuarios>[0]> = {}) {
  return {
    fase: "pronto" as const,
    usuarios: [ANA],
    papeis: [...PAPEIS_BOT_PADRAO],
    conflitos: {},
    onRecarregar: () => {},
    onAcao: async () => ({ ok: true }) as ResultadoAcao,
    onRevelar: async () => ({ ok: true as const, telefone: "+5511900000001" }),
    onCarregarAuditoria: async () => ({ dias: 90, eventos: [] }),
    duracaoRevelacaoMs: 30,
    ...extra,
  };
}

async function renderizar(ui: ReactNode) {
  await act(async () => {
    raiz?.unmount();
  });
  document.body.innerHTML = '<div id="root"></div>';
  raiz = createRoot(document.getElementById("root")!);
  await act(async () => {
    raiz?.render(ui);
  });
}

afterEach(async () => {
  await act(async () => {
    raiz?.unmount();
  });
  raiz = null;
});

function botao(nome: string, escopo: ParentNode = document) {
  return [...escopo.querySelectorAll("button")].find((el) => el.textContent?.includes(nome)) as HTMLButtonElement | undefined;
}

describe("painel do bot", { concurrency: 1 }, () => {
test("estados usam os textos da tela e não vazam a lista", async () => {
  await renderizar(<PainelBotUsuarios {...base({ fase: "carregando", usuarios: [ANA] })} />);
  assert.match(document.body.textContent ?? "", /Bot · usuários/);
  assert.equal((document.body.textContent ?? "").includes(TEXTO_VAZIO_PENDENTES), false);
  assert.equal((document.body.textContent ?? "").includes("Ana Exemplo"), false);

  await renderizar(<PainelBotUsuarios {...base({ fase: "erro", usuarios: [ANA] })} />);
  assert.match(document.body.textContent ?? "", new RegExp(TEXTO_ERRO.replace(".", "\\.")));
  assert.ok(botao("Tentar de novo"));
  assert.equal((document.body.textContent ?? "").includes("Ana Exemplo"), false);

  await renderizar(<PainelBotUsuarios {...base({ fase: "sem-permissao", usuarios: [ANA] })} />);
  assert.match(document.body.textContent ?? "", new RegExp(TEXTO_SEM_PERMISSAO));
  assert.equal((document.body.textContent ?? "").includes("Ana Exemplo"), false);
  assert.equal((document.body.textContent ?? "").includes("90000"), false);

  await renderizar(<PainelBotUsuarios {...base({ usuarios: [] })} />);
  assert.match(document.body.textContent ?? "", new RegExp(TEXTO_VAZIO_PENDENTES));
});

test("aprovar sem papel fica bloqueado; 409 aparece sem o número", async () => {
  let chamadas = 0;
  await renderizar(
    <PainelBotUsuarios
      {...base({
        onAcao: async () => {
          chamadas += 1;
          return { ok: false, message: "Já existe um cadastro aprovado com este número." };
        },
      })}
    />,
  );
  const aprovar = botao("Aprovar");
  assert.equal(aprovar?.disabled, true);
  assert.match(aprovar?.className ?? "", /min-h-11/);
  await act(async () => {
    aprovar?.click();
  });
  assert.equal(chamadas, 0);

  const select = document.querySelector('select[aria-label="Papel de Ana Exemplo"]') as HTMLSelectElement;
  await act(async () => {
    select.value = "Compras";
    select.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
  assert.equal(botao("Aprovar")?.disabled, false);
  await act(async () => {
    botao("Aprovar")?.click();
  });
  assert.equal(chamadas, 1);
  assert.match(document.body.textContent ?? "", /Já existe um cadastro aprovado com este número/);
  assert.equal((document.body.textContent ?? "").includes("900000001"), false);
  assert.equal(document.querySelector("#root script"), null);
  assert.match(document.body.textContent ?? "", /<script>ZZALERTA<\/script>/);
});

test("modal Recusar prende o foco, Esc fecha e o foco volta ao botão", async () => {
  await renderizar(<PainelBotUsuarios {...base()} />);
  const origem = botao("Recusar");
  assert.ok(origem);
  await act(async () => {
    origem?.click();
  });
  const dialog = document.querySelector("[role='dialog'][aria-modal='true']") as HTMLElement;
  assert.ok(dialog);
  assert.match(dialog.textContent ?? "", /Recusar vínculo\?/);
  assert.match(dialog.textContent ?? "", /Ana Exemplo não poderá consultar o bot com este número/);
  assert.match(dialog.textContent ?? "", /Motivo \(opcional, uso interno\)/);
  assert.match(dialog.textContent ?? "", new RegExp(TEXTO_AJUDA_MOTIVO.replace(".", "\\.")));
  assert.match(dialog.textContent ?? "", /0\/80/);
  const confirmar = [...dialog.querySelectorAll("button")].find((el) => el.textContent?.trim() === "Recusar");
  assert.match(confirmar?.className ?? "", /rose/);
  const focaveis = [...dialog.querySelectorAll<HTMLElement>("textarea, button")];
  const primeiro = focaveis[0]!;
  const ultimo = focaveis[focaveis.length - 1]!;
  assert.equal(primeiro.tagName, "TEXTAREA");
  ultimo.focus();
  await act(async () => {
    document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
  });
  assert.equal(document.activeElement === primeiro, true, document.activeElement?.tagName ?? "sem foco");

  await act(async () => {
    document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  });
  assert.equal(document.querySelector("[role='dialog']"), null);
  assert.equal(document.activeElement === origem, true, document.activeElement?.textContent?.trim() ?? "sem foco");
});

test("revelar mostra o número, o toast e volta a mascarar", async () => {
  await renderizar(<PainelBotUsuarios {...base()} />);
  assert.equal((document.body.textContent ?? "").includes("90000-0001"), false);
  await act(async () => {
    botao("Revelar")?.click();
  });
  assert.match(document.body.textContent ?? "", /\+55 11 90000-0001/);
  assert.match(document.body.textContent ?? "", new RegExp(TEXTO_TOAST_REVELAR));
  const ocultar = botao("Ocultar");
  assert.equal(ocultar?.getAttribute("aria-label"), "Ocultar telefone de Ana Exemplo");
  await act(async () => {
    ocultar?.click();
  });
  assert.equal((document.body.textContent ?? "").includes("90000-0001"), false);
  assert.match(document.body.textContent ?? "", /•••••-0001/);
  await act(async () => {
    botao("Revelar")?.click();
  });
  await act(async () => {
    await new Promise((resolver) => setTimeout(resolver, 80));
  });
  assert.equal((document.body.textContent ?? "").includes("90000"), false);
  assert.match(document.body.textContent ?? "", /•••••-0001/);
});

test("filtro Inativo troca a lista sem navegar", async () => {
  const href = window.location.href;
  await renderizar(
    <PainelBotUsuarios {...base({ usuarios: [{ ...ANA, situacao: "ativo" }, { ...BRUNO, situacao: "inativo" }] })} />,
  );
  await act(async () => {
    botao("Cadastrados")?.click();
  });
  assert.match(document.body.textContent ?? "", /Ana Exemplo/);
  assert.match(document.body.textContent ?? "", /Bruno Exemplo/);
  assert.match(document.body.textContent ?? "", /Entrega: Envio falhou/);
  assert.equal(botao("Reenviar") != null, true, "reenviar visível");
  const select = document.querySelector('select[aria-label="Filtrar por situação"]') as HTMLSelectElement;
  await act(async () => {
    select.value = "inativo";
    select.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
  assert.equal((document.body.textContent ?? "").includes("Ana Exemplo"), false);
  assert.match(document.body.textContent ?? "", /Bruno Exemplo/);
  assert.equal((document.body.textContent ?? "").includes(TEXTO_VAZIO_CADASTRADOS), false);
  assert.equal(window.location.href, href);
});

test("a tela não injeta HTML e não declara dangerouslySetInnerHTML", () => {
  for (const arquivo of [
    "components/admin/bot-usuarios/painel.tsx",
    "components/admin/bot-usuarios/tela.tsx",
    "components/admin/bot-usuarios/modal-confirmacao.tsx",
    "app/admin/bot-usuarios/page.tsx",
  ]) {
    const fonte = readFileSync(arquivo, "utf8");
    assert.equal(fonte.includes("dangerouslySetInnerHTML"), false, arquivo);
    assert.equal(fonte.includes("console."), false, arquivo);
  }
});

test("detalhe prende o foco, não repete Abrir e mostra o papel ainda por definir", async () => {
  await renderizar(<PainelBotUsuarios {...base()} />);
  assert.equal(document.querySelector('select[aria-label="Filtrar por papel"]'), null);
  assert.match(document.body.textContent ?? "", new RegExp(TEXTO_ESCOLHA_PAPEL.replace(".", "\\.")));
  const origem = botao("Abrir");
  assert.ok(origem);
  await act(async () => {
    origem?.click();
  });
  const dialog = document.querySelector("aside[role='dialog']") as HTMLElement;
  assert.ok(dialog);
  assert.equal(document.activeElement === dialog.querySelector("#detalhe-bot-titulo"), true, "foco no título");
  assert.match(dialog.textContent ?? "", new RegExp(TEXTO_PAPEL_PENDENTE.replace(".", "\\.")));
  assert.equal(dialog.textContent?.includes("Papel atual:"), false);
  assert.equal(botao("Abrir", dialog), undefined);
  const focaveis = [...dialog.querySelectorAll<HTMLElement>("button:not([disabled]), select:not([disabled])")];
  const primeiro = focaveis[0]!;
  const ultimo = focaveis[focaveis.length - 1]!;
  ultimo.focus();
  await act(async () => {
    document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
  });
  assert.equal(document.activeElement === primeiro, true, document.activeElement?.textContent?.trim() ?? "sem foco");
  await act(async () => {
    document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  });
  assert.equal(document.querySelector("aside[role='dialog']"), null);
  assert.equal(document.activeElement === origem, true, document.activeElement?.textContent?.trim() ?? "sem foco");
});

test("reenvio some quando a mensagem já foi enviada e o toast usa o texto literal", async () => {
  let corpo = "";
  await renderizar(
    <PainelBotUsuarios
      {...base({
        usuarios: [ANA, { ...BRUNO, entrega_status: "enviada" }],
        onAcao: async (_id, pedido) => {
          corpo = JSON.stringify(pedido);
          return { ok: true };
        },
      })}
    />,
  );
  const select = document.querySelector('select[aria-label="Papel de Ana Exemplo"]') as HTMLSelectElement;
  await act(async () => {
    select.value = "Compras";
    select.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
  await act(async () => {
    botao("Aprovar")?.click();
  });
  assert.equal(corpo.includes("Compras"), true);
  assert.match(document.body.textContent ?? "", new RegExp(textoToastAprovar("Ana Exemplo", "Compras").replace(".", "\\.")));
  await act(async () => {
    botao("Cadastrados")?.click();
  });
  assert.equal(botao("Reenviar"), undefined);
  assert.match(document.body.textContent ?? "", /Entrega: Mensagem enviada/);
});

test("conflito explica que um pedido não bloqueia o outro", async () => {
  await renderizar(
    <PainelBotUsuarios
      {...base({
        conflitos: {
          [ANA.id]: { pendentes: [{ id: "outro", nome: "Carla Exemplo", telefone_mascarado: "+55 11 •••••-0001" }], aprovados: [] },
        },
      })}
    />,
  );
  assert.match(document.body.textContent ?? "", /Conflito de número/);
  assert.match(document.body.textContent ?? "", new RegExp(TEXTO_AJUDA_CONFLITO.replace(".", "\\.")));
});

test("inativar usa o texto destrutivo e o botão de origem", async () => {
  await renderizar(<PainelBotUsuarios {...base({ fase: "pronto", usuarios: [BRUNO] })} />);
  await act(async () => {
    botao("Cadastrados")?.click();
  });
  await act(async () => {
    botao("Inativar")?.click();
  });
  const dialog = document.querySelector("[role='dialog']");
  assert.match(dialog?.textContent ?? "", /Inativar usuário\?/);
  assert.match(
    dialog?.textContent ?? "",
    /Bruno Exemplo deixa de receber respostas imediatamente\. O histórico de auditoria permanece\./,
  );
});

test("função declarada pré-seleciona o papel e aparece com a descrição e os setores", async () => {
  await renderizar(
    <PainelBotUsuarios
      {...base({
        usuarios: [
          {
            ...ANA,
            funcao_declarada: "Compras",
            descricao_funcao: "Cuido dos equipamentos da UTI exemplo",
            setores: [{ codigo: "55D", nome: "ALMOXARIFADO AION" }],
            email_mascarado: "a•••@a•••",
          },
        ],
      })}
    />,
  );
  const select = document.querySelector('select[aria-label="Papel de Ana Exemplo"]') as HTMLSelectElement;
  assert.equal(select.value, "Compras");
  assert.equal(botao("Aprovar")?.disabled, false);
  const texto = document.body.textContent ?? "";
  assert.match(texto, /Função declarada: Compras/);
  assert.match(texto, /Cuido dos equipamentos da UTI exemplo/);
  assert.match(texto, /ALMOXARIFADO AION/);
  assert.match(texto, /a•••@a•••/);
  assert.equal(texto.includes("Meu setor não está na lista"), false);
});

test("cancelar Excluir cadastro não chama a ação", async () => {
  let chamadas = 0;
  await renderizar(
    <PainelBotUsuarios
      {...base({
        onExcluir: async () => {
          chamadas += 1;
          return { ok: true };
        },
      })}
    />,
  );
  await act(async () => {
    botao("Excluir cadastro")?.click();
  });
  const dialog = document.querySelector("[role='dialog']") as HTMLElement;
  assert.match(dialog.textContent ?? "", /Excluir cadastro\?/);
  assert.match(dialog.textContent ?? "", /apaga o nome, o telefone, o e-mail/);
  await act(async () => {
    botao("Cancelar", dialog)?.click();
  });
  assert.equal(chamadas, 0);
  assert.equal(document.querySelector("[role='dialog']"), null);
});

test("gerar novo link pede confirmação e cancelar não revoga", async () => {
  let pedido = "";
  await renderizar(
    <PainelBotUsuarios
      {...base({
        convite: {
          validade_dias: 7,
          ativo: {
            expira_em: "2026-11-19T00:00:00.000Z",
            criado_em: "2026-11-12T00:00:00.000Z",
            cadastros: 2,
            url: "https://painel.exemplo.test/convite/token-sintetico-de-teste",
          },
        },
        onConvite: async (corpo) => {
          pedido = JSON.stringify(corpo);
          return { ok: true };
        },
      })}
    />,
  );
  assert.match(document.body.textContent ?? "", /2 cadastros por este link/);
  await act(async () => {
    botao("Gerar novo link")?.click();
  });
  const dialog = document.querySelector("[role='dialog']") as HTMLElement;
  assert.match(dialog.textContent ?? "", /O link anterior deixa de valer na hora/);
  await act(async () => {
    botao("Cancelar", dialog)?.click();
  });
  assert.equal(pedido, "");
  await act(async () => {
    botao("Gerar novo link")?.click();
  });
  const deNovo = document.querySelector("[role='dialog']") as HTMLElement;
  const confirmar = [...deNovo.querySelectorAll("button")].find((el) => el.textContent?.trim() === "Gerar novo link");
  await act(async () => {
    confirmar?.click();
  });
  assert.equal(pedido, JSON.stringify({ acao: "gerar" }));
});
});

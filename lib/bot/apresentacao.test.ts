import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DURACAO_REVELACAO_MS,
  TEXTO_ERRO,
  TEXTO_SEM_PERMISSAO,
  TEXTO_AJUDA_CONFLITO,
  TEXTO_ESCOLHA_PAPEL,
  TEXTO_PAPEL_PENDENTE,
  TEXTO_TOAST_REENVIO,
  TEXTO_TOAST_RECUSAR,
  TEXTO_TOAST_REVELAR,
  TEXTO_VAZIO_CADASTRADOS,
  TEXTO_VAZIO_PENDENTES,
  filtrarUsuarios,
  podeReenviar,
  rotuloEntrega,
  temConflito,
  textoToastAprovar,
  textoInativar,
  textoRecusar,
  type UsuarioBot,
} from "./apresentacao";

function pessoa(parcial: Partial<UsuarioBot> & Pick<UsuarioBot, "id" | "nome" | "situacao">): UsuarioBot {
  return {
    papel: "Compras",
    telefone_mascarado: "+55 11 •••••-0001",
    dono: "dpo",
    email_mascarado: null,
    setor: "UTI Exemplo",
    outros_setores: null,
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

const ANA = pessoa({ id: "ana", nome: "Ana Exemplo", situacao: "ativo", telefone_mascarado: "+55 11 •••••-0001" });
const BRUNO = pessoa({
  id: "bruno",
  nome: "Bruno Exemplo",
  situacao: "inativo",
  papel: "Manutenção",
  dono: "plantao",
  telefone_mascarado: "+55 11 •••••-0002",
});

test("textos de estado, modal e revelação ficam literais", () => {
  assert.equal(TEXTO_VAZIO_PENDENTES, "Nenhuma solicitação pendente.");
  assert.equal(TEXTO_VAZIO_CADASTRADOS, "Nenhum usuário neste filtro.");
  assert.equal(TEXTO_ERRO, "Não foi possível carregar. Tentar de novo.");
  assert.equal(TEXTO_SEM_PERMISSAO, "Você não tem acesso a esta tela.");
  assert.equal(TEXTO_TOAST_REVELAR, "Número revelado · evento registrado na auditoria.");
  assert.equal(
    TEXTO_TOAST_REENVIO,
    'Reenvio pedido. A mensagem sai pelo WhatsApp; o status fica "Envio pendente" até a confirmação.',
  );
  assert.equal(TEXTO_TOAST_RECUSAR, "Pedido recusado.");
  assert.equal(TEXTO_PAPEL_PENDENTE, "Papel: definido na aprovação");
  assert.equal(TEXTO_ESCOLHA_PAPEL, "Escolha o papel para aprovar.");
  assert.equal(TEXTO_AJUDA_CONFLITO, "Outro pedido ou cadastro usa o mesmo número. Confira antes de aprovar. Um pedido não bloqueia o outro.");
  assert.equal(rotuloEntrega("enviada"), "Mensagem enviada");
  assert.equal(rotuloEntrega("falhou"), "Envio falhou");
  assert.equal(rotuloEntrega("pendente"), "Envio pendente");
  assert.equal(textoToastAprovar("Ana Exemplo", "Compras"), "Ana Exemplo aprovada como Compras. Entrega: Envio pendente.");
  assert.equal(podeReenviar({ situacao: "ativo", entrega_status: "falhou" }), true);
  assert.equal(podeReenviar({ situacao: "ativo", entrega_status: "enviada" }), false);
  assert.equal(podeReenviar({ situacao: "inativo", entrega_status: "falhou" }), false);
  assert.equal(textoRecusar("Ana Exemplo"), "Ana Exemplo não poderá consultar o bot com este número.");
  assert.equal(
    textoInativar("Bruno Exemplo"),
    "Bruno Exemplo deixa de receber respostas imediatamente. O histórico de auditoria permanece.",
  );
  assert.equal(DURACAO_REVELACAO_MS, 30_000);
});

test("filtro de situação, papel e dono não depende de navegação", () => {
  const base = { busca: "", situacao: "todos" as const, papel: "", dono: "" };
  assert.deepEqual(
    filtrarUsuarios([ANA, BRUNO], "cadastrados", base).map((item) => item.nome),
    ["Ana Exemplo", "Bruno Exemplo"],
  );
  assert.deepEqual(
    filtrarUsuarios([ANA, BRUNO], "cadastrados", { ...base, situacao: "inativo" }).map((item) => item.nome),
    ["Bruno Exemplo"],
  );
  assert.deepEqual(
    filtrarUsuarios([ANA, BRUNO], "cadastrados", { ...base, papel: "Compras" }).map((item) => item.nome),
    ["Ana Exemplo"],
  );
  assert.deepEqual(
    filtrarUsuarios([ANA, BRUNO], "cadastrados", { ...base, dono: "plantao" }).map((item) => item.nome),
    ["Bruno Exemplo"],
  );
  assert.deepEqual(filtrarUsuarios([ANA], "pendentes", base), []);
  const pendente = pessoa({ id: "p", nome: "Carla Exemplo", situacao: "pendente", papel: "Compras" });
  assert.deepEqual(
    filtrarUsuarios([pendente], "pendentes", { ...base, papel: "Manutenção" }).map((item) => item.nome),
    ["Carla Exemplo"],
  );
});

test("conflito exige outro pendente ou um aprovado no mesmo número", () => {
  assert.equal(temConflito("ana", { pendentes: [{ id: "ana", nome: "Ana Exemplo", telefone_mascarado: "+55 11 •••••-0001" }], aprovados: [] }), false);
  assert.equal(
    temConflito("ana", {
      pendentes: [
        { id: "ana", nome: "Ana Exemplo", telefone_mascarado: "+55 11 •••••-0001" },
        { id: "bruno", nome: "Bruno Exemplo", telefone_mascarado: "+55 11 •••••-0001" },
      ],
      aprovados: [],
    }),
    true,
  );
  assert.equal(
    temConflito("ana", {
      pendentes: [{ id: "ana", nome: "Ana Exemplo", telefone_mascarado: "+55 11 •••••-0001" }],
      aprovados: [{ id: "bruno", nome: "Bruno Exemplo", telefone_mascarado: "+55 11 •••••-0001" }],
    }),
    true,
  );
});

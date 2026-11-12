/**
 * HTML da página pública. Sem navegação do AionScope e sem dado pessoal.
 * O token não entra no documento: o envio usa o caminho atual.
 */
import { AVISO_PRIVACIDADE, MSG_CONVITE_OFFLINE, MSG_LINK_INATIVO } from "./mensagens";
import type { SetorAtivo } from "./setores";

function esc(valor: string) {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const ESTILO = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html, body { margin: 0; max-width: 100%; overflow-x: hidden; }
  body {
    font-family: "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background: #f4f8fb;
    color: #24313c;
    line-height: 1.45;
  }
  .moldura { padding: 16px 16px 32px; }
  .cartao {
    width: 100%;
    max-width: 520px;
    margin: 0 auto;
    background: #fff;
    border: 1px solid #d5e4ef;
    border-radius: 16px;
    padding: 20px 16px 24px;
    box-shadow: 0 1px 2px rgba(1, 104, 176, 0.06), 0 10px 28px rgba(1, 104, 176, 0.05);
  }
  .marca {
    display: block;
    width: 100%;
    max-width: 180px;
    height: auto;
    max-height: 64px;
    aspect-ratio: 980 / 285;
    object-fit: contain;
    margin: 0 0 16px;
  }
  h1 { font-size: 1.25rem; margin: 0; }
  .sub { margin: 4px 0 16px; color: #3e5563; }
  .aviso {
    background: #e8f2f8;
    border-radius: 12px;
    padding: 12px 14px;
    margin: 0 0 16px;
  }
  .aviso p { margin: 0 0 8px; }
  .aviso p:last-child { margin-bottom: 0; }
  label, .rotulo { display: block; font-weight: 600; margin: 14px 0 6px; }
  .contador { float: right; font-weight: 500; color: #3e5563; }
  input, select, textarea, button {
    width: 100%;
    font: inherit;
    color: inherit;
  }
  input, select, textarea {
    border: 1px solid #5b6e7c;
    border-radius: 10px;
    padding: 10px 12px;
    background: #fff;
    min-height: 44px;
  }
  textarea { min-height: 96px; resize: vertical; }
  button {
    min-height: 44px;
    border: 0;
    border-radius: 10px;
    background: #0168b0;
    color: #fff;
    font-weight: 700;
    margin-top: 18px;
    cursor: pointer;
  }
  button:disabled { opacity: 0.6; cursor: default; }
  .ajuda { margin: 6px 0 0; color: #3e5563; font-size: 0.95rem; }
  .erro { color: #8d1d18; font-weight: 600; min-height: 1.2em; }
  .check { display: flex; gap: 10px; align-items: flex-start; margin-top: 16px; font-weight: 600; }
  .check input { width: 22px; height: 22px; min-height: 22px; margin-top: 2px; }
  .etiquetas { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
  .etiqueta {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    background: #e8f2f8;
    border-radius: 999px;
    padding: 6px 8px 6px 12px;
  }
  .etiqueta span { overflow-wrap: anywhere; }
  .etiqueta button {
    width: 44px;
    min-height: 44px;
    margin: 0;
    background: transparent;
    color: #014a80;
    font-size: 1.1rem;
  }
  .lista {
    display: none;
    margin: 8px 0 0;
    padding: 8px;
    list-style: none;
    border: 1px solid #d5e4ef;
    border-radius: 12px;
    background: #fff;
    max-height: 240px;
    overflow: auto;
  }
  .lista.aberta { display: block; }
  .lista button {
    margin: 0;
    background: #fff;
    color: #24313c;
    text-align: left;
    font-weight: 500;
    border-radius: 8px;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  .lista button[aria-selected="true"], .lista button:hover { background: #e8f2f8; }
  .sucesso { font-size: 1.05rem; font-weight: 600; }
  .armadilha {
    position: absolute;
    left: -10000px;
    width: 1px;
    height: 1px;
    overflow: hidden;
  }
  :focus-visible { outline: 3px solid #0168b0; outline-offset: 2px; }
  @media (min-width: 768px) {
    .moldura { padding-top: 40px; }
    .cartao { padding: 28px 28px 32px; }
  }
  @media (max-width: 767px) {
    .lista.aberta {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 20;
      max-height: 70vh;
      margin: 0;
      border-radius: 16px 16px 0 0;
      box-shadow: 0 -8px 24px rgba(36, 49, 60, 0.18);
    }
  }
`;

const SCRIPT = `
(function () {
  var form = document.getElementById("form");
  if (!form) return;
  var erros = document.getElementById("erros");
  var botao = document.getElementById("enviar");
  var busca = document.getElementById("setores-busca");
  var lista = document.getElementById("setores-lista");
  var etiquetas = document.getElementById("setores-etiquetas");
  var contador = document.getElementById("setores-contador");
  var dadosEl = document.getElementById("setores-dados");
  var setores = [];
  try { setores = JSON.parse(dadosEl.textContent || "[]"); } catch (e) { setores = []; }
  var selecionados = [];
  var destaque = -1;

  function digitos(valor) {
    return String(valor || "").replace(/\\D/g, "").slice(0, 11);
  }
  function mascara(d) {
    if (!d) return "";
    if (d.length < 3) return "(" + d;
    var ddd = d.slice(0, 2);
    var resto = d.slice(2);
    if (d.length <= 6) return "(" + ddd + ") " + resto;
    if (d.length <= 10) return "(" + ddd + ") " + resto.slice(0, 4) + "-" + resto.slice(4);
    return "(" + ddd + ") " + resto.slice(0, 5) + "-" + resto.slice(5);
  }
  function semAcento(s) {
    return String(s).normalize("NFD").replace(/\\p{M}/gu, "").toLocaleLowerCase("pt-BR");
  }
  function mostrarErro(texto) {
    erros.textContent = texto || "";
  }
  function atualizarContador(id, max) {
    var el = document.getElementById(id);
    var alvo = document.getElementById(id.replace("-contador", ""));
    if (!el || !alvo) return;
    el.textContent = String(alvo.value.length) + "/" + String(max);
  }
  function textoSelecao() {
    var n = selecionados.length;
    if (n === 1) return "1 setor selecionado";
    return String(n) + " setores selecionados";
  }
  function desenharEtiquetas() {
    etiquetas.textContent = "";
    selecionados.forEach(function (setor) {
      var item = document.createElement("span");
      item.className = "etiqueta";
      var nome = document.createElement("span");
      nome.textContent = setor.nome;
      var remover = document.createElement("button");
      remover.type = "button";
      remover.textContent = "×";
      remover.setAttribute("aria-label", "Remover " + setor.nome);
      remover.addEventListener("click", function () {
        selecionados = selecionados.filter(function (atual) { return atual.codigo !== setor.codigo; });
        desenharEtiquetas();
        desenharLista();
      });
      item.appendChild(nome);
      item.appendChild(remover);
      etiquetas.appendChild(item);
    });
    contador.textContent = textoSelecao();
  }
  function filtrados() {
    var q = semAcento(busca.value.trim());
    return setores.filter(function (setor) {
      if (!q) return true;
      return semAcento(setor.nome).indexOf(q) >= 0;
    });
  }
  function desenharLista() {
    var itens = filtrados();
    lista.textContent = "";
    if (!itens.length) {
      var vazio = document.createElement("li");
      vazio.textContent = "Nenhum setor com esse nome.";
      lista.appendChild(vazio);
      return;
    }
    itens.forEach(function (setor, indice) {
      var li = document.createElement("li");
      var opcao = document.createElement("button");
      opcao.type = "button";
      opcao.setAttribute("role", "option");
      opcao.setAttribute("aria-selected", selecionados.some(function (atual) { return atual.codigo === setor.codigo; }) ? "true" : "false");
      opcao.textContent = setor.nome;
      if (indice === destaque) opcao.id = "setor-destaque";
      opcao.addEventListener("click", function () {
        var ja = selecionados.some(function (atual) { return atual.codigo === setor.codigo; });
        if (ja) selecionados = selecionados.filter(function (atual) { return atual.codigo !== setor.codigo; });
        else selecionados.push(setor);
        destaque = -1;
        desenharEtiquetas();
        desenharLista();
        busca.focus();
      });
      li.appendChild(opcao);
      lista.appendChild(li);
    });
  }
  function abrirLista(aberto) {
    lista.className = aberto ? "lista aberta" : "lista";
    busca.setAttribute("aria-expanded", aberto ? "true" : "false");
    if (!aberto) destaque = -1;
  }
  ["nome", "descricao"].forEach(function (id) {
    var campo = document.getElementById(id);
    var max = id === "nome" ? 120 : 200;
    campo.addEventListener("input", function () { atualizarContador(id + "-contador", max); });
  });
  ["telefone", "confirmacao"].forEach(function (id) {
    var campo = document.getElementById(id);
    campo.addEventListener("input", function () { campo.value = mascara(digitos(campo.value)); });
  });
  busca.addEventListener("input", function () { destaque = -1; abrirLista(true); desenharLista(); });
  busca.addEventListener("focus", function () { abrirLista(true); desenharLista(); });
  busca.addEventListener("keydown", function (event) {
    var botoes = lista.querySelectorAll("button");
    if (event.key === "ArrowDown") {
      event.preventDefault();
      abrirLista(true);
      destaque = Math.min(botoes.length - 1, destaque + 1);
      desenharLista();
      var alvo = document.getElementById("setor-destaque");
      if (alvo) alvo.focus();
    } else if (event.key === "Escape") {
      abrirLista(false);
    }
  });
  lista.addEventListener("keydown", function (event) {
    var botoes = Array.prototype.slice.call(lista.querySelectorAll("button"));
    var atual = botoes.indexOf(document.activeElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      var proximo = event.key === "ArrowDown" ? atual + 1 : atual - 1;
      if (proximo < 0) { busca.focus(); return; }
      if (proximo >= botoes.length) proximo = botoes.length - 1;
      destaque = proximo;
      botoes[proximo].focus();
    } else if (event.key === "Escape") {
      abrirLista(false);
      busca.focus();
    }
  });
  document.addEventListener("click", function (event) {
    if (event.target === busca || lista.contains(event.target)) return;
    abrirLista(false);
  });
  function validar() {
    var nome = document.getElementById("nome").value.trim();
    var tel = digitos(document.getElementById("telefone").value);
    var conf = digitos(document.getElementById("confirmacao").value);
    var email = document.getElementById("email").value.trim();
    var funcao = document.getElementById("funcao").value;
    var descricao = document.getElementById("descricao").value.trim();
    var aceite = document.getElementById("aceite").checked;
    if (!nome) return { mensagem: "Preencha o nome completo.", foco: "nome" };
    if (nome.length > 120) return { mensagem: "Máximo de 120 caracteres.", foco: "nome" };
    if (!tel) return { mensagem: "Informe seu WhatsApp com DDD.", foco: "telefone" };
    if (tel.length < 10 || tel.length > 11) return { mensagem: "Use o DDD e o número, por exemplo (16) 99999-9999.", foco: "telefone" };
    if (!conf) return { mensagem: "Confirme o número.", foco: "confirmacao" };
    if (tel !== conf) return { mensagem: "Os números não coincidem. Confira o DDD e o número.", foco: "confirmacao" };
    if (!email) return { mensagem: "Informe seu e-mail.", foco: "email" };
    if (email.length > 120) return { mensagem: "Máximo de 120 caracteres.", foco: "email" };
    if (!funcao) return { mensagem: "Selecione sua função.", foco: "funcao" };
    if (!descricao) return { mensagem: "Descreva sua função.", foco: "descricao" };
    if (descricao.length > 200) return { mensagem: "Máximo de 200 caracteres.", foco: "descricao" };
    if (!selecionados.length) return { mensagem: "Selecione pelo menos um setor.", foco: "setores-busca" };
    if (!aceite) return { mensagem: "Marque o aceite para continuar.", foco: "aceite" };
    return null;
  }
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (botao.disabled) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      mostrarErro(${JSON.stringify(MSG_CONVITE_OFFLINE)});
      return;
    }
    var invalido = validar();
    if (invalido) {
      mostrarErro(invalido.mensagem);
      var campo = document.getElementById(invalido.foco);
      if (campo) campo.focus();
      return;
    }
    botao.disabled = true;
    botao.textContent = "Enviando…";
    mostrarErro("");
    var corpo = {
      nome: document.getElementById("nome").value,
      telefone: document.getElementById("telefone").value,
      confirmacao: document.getElementById("confirmacao").value,
      email: document.getElementById("email").value,
      funcao: document.getElementById("funcao").value,
      descricao: document.getElementById("descricao").value,
      setores: selecionados.map(function (setor) { return setor.codigo; }),
      aceite: true,
      csrf: document.getElementById("csrf").value,
      empresa: document.getElementById("empresa").value
    };
    fetch(location.pathname, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(corpo),
      credentials: "same-origin"
    }).then(function (resposta) {
      return resposta.json().then(function (json) { return { resposta: resposta, json: json }; }).catch(function () {
        return { resposta: resposta, json: null };
      });
    }).then(function (resultado) {
      if (resultado.resposta.ok && resultado.json && resultado.json.ok === true) {
        form.hidden = true;
        var sucesso = document.getElementById("sucesso");
        sucesso.hidden = false;
        sucesso.textContent = resultado.json.message;
        sucesso.focus();
        return;
      }
      var mensagem = resultado.json && typeof resultado.json.message === "string"
        ? resultado.json.message
        : "Não foi possível enviar agora. Tente de novo em alguns minutos.";
      mostrarErro(mensagem);
      botao.disabled = false;
      botao.textContent = "Enviar cadastro";
    }).catch(function () {
      mostrarErro(${JSON.stringify(MSG_CONVITE_OFFLINE)});
      botao.disabled = false;
      botao.textContent = "Enviar cadastro";
    });
  });
  desenharEtiquetas();
})();
`;

function documento(titulo: string, miolo: string, script = "") {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <meta name="referrer" content="no-referrer">
  <title>${esc(titulo)}</title>
  <style>${ESTILO}</style>
</head>
<body>
  <main class="moldura">
    <article class="cartao">
      <header>
        <img class="marca" src="/aion-logo.png" alt="Aion Engenharia" width="980" height="285">
        <h1>Engenharia Clínica · AionScope</h1>
        <p class="sub">Cadastro do assistente de consultas</p>
      </header>
      ${miolo}
    </article>
  </main>
  ${script ? `<script>${script}</script>` : ""}
</body>
</html>`;
}

export function paginaInativa() {
  return documento(
    "Cadastro do assistente",
    `<p class="sucesso" role="status">${esc(MSG_LINK_INATIVO)}</p>`,
  );
}

export function paginaFormulario(opcoes: { csrf: string; setores: SetorAtivo[]; papeis: string[] }) {
  const setoresJson = JSON.stringify(opcoes.setores).replace(/</g, "\\u003c");
  const opcoesPapel = opcoes.papeis
    .map((papel) => `<option value="${esc(papel)}">${esc(papel)}</option>`)
    .join("");
  const aviso = AVISO_PRIVACIDADE.map((paragrafo) => `<p>${esc(paragrafo)}</p>`).join("");
  const miolo = `
    <div class="aviso" role="note">${aviso}</div>
    <form id="form" method="post" action="" novalidate onsubmit="return false">
      <label for="nome">Nome completo * <span id="nome-contador" class="contador">0/120</span></label>
      <input id="nome" name="nome" autocomplete="name" maxlength="120" required>
      <label for="telefone">WhatsApp com DDD *</label>
      <input id="telefone" name="telefone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="(16) 99999-9999" required>
      <p class="ajuda">O assistente só vai responder neste número.</p>
      <label for="confirmacao">Confirme o WhatsApp *</label>
      <input id="confirmacao" name="confirmacao" type="tel" inputmode="numeric" autocomplete="off" required>
      <label for="email">E-mail *</label>
      <input id="email" name="email" type="email" autocomplete="email" maxlength="120" required>
      <label for="funcao">Sua função *</label>
      <select id="funcao" name="funcao" required>
        <option value="">Selecione</option>
        ${opcoesPapel}
      </select>
      <label for="descricao">Descreva sua função no hospital * <span id="descricao-contador" class="contador">0/200</span></label>
      <textarea id="descricao" name="descricao" rows="3" maxlength="200" placeholder="Ex.: Enfermeira chefe da UTI Adulto, cuido das escalas e dos equipamentos do setor." required></textarea>
      <p class="rotulo" id="setores-rotulo">Setores que você atende *</p>
      <div id="setores-etiquetas" class="etiquetas" aria-live="polite"></div>
      <p id="setores-contador" class="ajuda">0 setores selecionados</p>
      <label for="setores-busca" class="rotulo">Buscar setor</label>
      <input id="setores-busca" role="combobox" aria-expanded="false" aria-controls="setores-lista" aria-autocomplete="list" autocomplete="off" placeholder="Buscar setor…">
      <ul id="setores-lista" class="lista" role="listbox" aria-labelledby="setores-rotulo"></ul>
      <label class="check" for="aceite">
        <input id="aceite" name="aceite" type="checkbox" value="1">
        <span>Li e concordo com o aviso de privacidade *</span>
      </label>
      <div class="armadilha" aria-hidden="true">
        <label for="empresa">Empresa</label>
        <input id="empresa" name="empresa" tabindex="-1" autocomplete="off">
      </div>
      <input id="csrf" name="csrf" type="hidden" value="${esc(opcoes.csrf)}">
      <p id="erros" class="erro" role="status" aria-live="polite"></p>
      <button id="enviar" type="submit">Enviar cadastro</button>
    </form>
    <p id="sucesso" class="sucesso" tabindex="-1" hidden></p>
    <script type="application/json" id="setores-dados">${setoresJson}</script>
  `;
  return documento("Cadastro do assistente", miolo, SCRIPT);
}

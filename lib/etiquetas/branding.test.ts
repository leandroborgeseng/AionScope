import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { etiquetaContatoLine, type EtiquetaBranding } from "./branding";

describe("etiquetaContatoLine", () => {
  it("inclui telefone e site (sem www)", () => {
    const b: EtiquetaBranding = {
      brand: "HSJ",
      site: "www.aion.eng.br",
      telefone: "(16) 3030-0445",
      logoUrl: "/aion-mark.png",
    };
    assert.equal(etiquetaContatoLine(b), "(16) 3030-0445 · aion.eng.br");
  });

  it("usa telefone padrão Aion quando vazio", () => {
    const b: EtiquetaBranding = {
      brand: "HSJ",
      site: "aion.eng.br",
      telefone: "",
      logoUrl: "/aion-mark.png",
    };
    assert.equal(etiquetaContatoLine(b), "(16) 3030-0445 · aion.eng.br");
  });
});

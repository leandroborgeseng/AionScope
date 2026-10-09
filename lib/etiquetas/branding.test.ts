import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { etiquetaContatoLine, type EtiquetaBranding } from "./branding";

describe("etiquetaContatoLine", () => {
  it("inclui site e telefone", () => {
    const b: EtiquetaBranding = {
      brand: "HSJ",
      site: "www.aion.eng.br",
      telefone: "(16) 3030-0445",
      logoUrl: "/aion-logo.png",
    };
    assert.equal(etiquetaContatoLine(b), "www.aion.eng.br · (16) 3030-0445");
  });

  it("usa telefone padrão Aion quando vazio", () => {
    const b: EtiquetaBranding = {
      brand: "HSJ",
      site: "www.aion.eng.br",
      telefone: "",
      logoUrl: "/aion-logo.png",
    };
    assert.equal(etiquetaContatoLine(b), "www.aion.eng.br · (16) 3030-0445");
  });
});

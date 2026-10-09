import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { etiquetaContatoLine, type EtiquetaBranding } from "./branding";

describe("etiquetaContatoLine", () => {
  it("inclui site e telefone", () => {
    const b: EtiquetaBranding = {
      brand: "HSJ",
      site: "aion.eng.br",
      telefone: "(11) 1234-5678",
      logoUrl: "/aion-logo.png",
    };
    assert.equal(etiquetaContatoLine(b), "aion.eng.br · (11) 1234-5678");
  });

  it("mantém slot de telefone quando vazio", () => {
    const b: EtiquetaBranding = {
      brand: "HSJ",
      site: "aion.eng.br",
      telefone: "",
      logoUrl: "/aion-logo.png",
    };
    assert.equal(etiquetaContatoLine(b), "aion.eng.br · Tel. —");
  });
});

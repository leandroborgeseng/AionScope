import { JSDOM } from "jsdom";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: "https://painel.exemplo.test/admin/bot-usuarios",
  pretendToBeVisual: true,
});

dom.window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {
    return false;
  },
})) as typeof window.matchMedia;

const destino = globalThis as typeof globalThis & {
  window: Window & typeof globalThis;
  document: Document;
  HTMLElement: typeof HTMLElement;
  Node: typeof Node;
  navigator: Navigator;
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
destino.window = dom.window as unknown as Window & typeof globalThis;
destino.document = dom.window.document;
destino.HTMLElement = dom.window.HTMLElement;
destino.Node = dom.window.Node;
destino.IS_REACT_ACT_ENVIRONMENT = true;

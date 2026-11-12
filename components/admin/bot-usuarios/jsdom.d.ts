declare module "jsdom" {
  export class JSDOM {
    constructor(html?: string, options?: { url?: string; pretendToBeVisual?: boolean });
    window: Window &
      typeof globalThis & {
        document: Document;
        HTMLElement: typeof HTMLElement;
        Node: typeof Node;
        matchMedia: typeof matchMedia;
      };
  }
}

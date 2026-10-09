/** Tipagem mínima de Web Bluetooth (Chrome/Edge) para impressão Niimbot. */
interface Navigator {
  bluetooth?: {
    requestDevice: (options?: unknown) => Promise<unknown>;
    getAvailability?: () => Promise<boolean>;
  };
}

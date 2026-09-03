import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((v) => (v ?? "").trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "pt-BR"),
  );
}

export function includesNormalized(haystack: string | null | undefined, needle: string) {
  return (haystack ?? "").toLocaleLowerCase("pt-BR").includes(needle.toLocaleLowerCase("pt-BR"));
}

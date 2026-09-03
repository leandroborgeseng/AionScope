import { cn } from "@/lib/utils";

type AionLogoProps = {
  className?: string;
  imgClassName?: string;
  /** Placa branca só quando o wordmark azul ficar sobre fundo escuro. */
  onDark?: boolean;
};

export function AionLogo({ className, imgClassName, onDark = false }: AionLogoProps) {
  const image = (
    <img
      src="/aion-logo.png"
      alt="Aion Engenharia"
      className={cn("h-8 w-auto max-w-none object-contain object-left", imgClassName)}
    />
  );

  if (!onDark) {
    return <div className={cn("inline-flex items-center", className)}>{image}</div>;
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-black/5",
        className,
      )}
    >
      {image}
    </div>
  );
}

import type { ReactNode } from "react";
import { SectionError } from "@/components/pending/pending-banner";
import { ChartSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function IndicadorSection({
  eyebrow,
  title,
  description,
  actions,
  loading,
  error,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  loading?: boolean;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-aion-line bg-white shadow-[var(--aion-shadow)]">
      <div className="aion-bar" />
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-aion-line bg-white px-5 py-4">
        <div>
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-aion-blue">{eyebrow}</p>
          ) : null}
          <h2 className="text-lg font-semibold tracking-tight text-aion-ink">{title}</h2>
          {description ? <p className="mt-1 max-w-3xl text-sm text-aion-muted">{description}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </header>
      <div className="p-5">
        {error ? (
          <div className="mb-4">
            <SectionError message={error} />
          </div>
        ) : null}
        {loading ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-aion-mist" />
              ))}
            </div>
            <ChartSkeleton />
            <TableSkeleton />
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

export function FilterChip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-semibold transition",
        active ? "bg-aion-blue text-white" : "border border-aion-line bg-white text-aion-ink hover:border-aion-blue",
      )}
    >
      {children}
    </button>
  );
}

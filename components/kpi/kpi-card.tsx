import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  hint,
  tone = "neutral",
  loading,
  error,
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "ok" | "warn" | "danger";
  loading?: boolean;
  error?: string | null;
  onClick?: () => void;
}) {
  const toneClass = {
    neutral: "border-aion-line",
    ok: "border-emerald-200",
    warn: "border-amber-200",
    danger: "border-rose-200",
  }[tone];

  return (
    <Card
      className={cn("p-4", toneClass, onClick && "cursor-pointer transition hover:border-aion-blue")}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-aion-muted">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-24" />
      ) : error ? (
        <p className="mt-2 text-sm text-rose-700">{error}</p>
      ) : (
        <p
          className={cn(
            "mt-1 text-2xl font-semibold tabular-nums",
            tone === "ok" && "text-emerald-700",
            tone === "warn" && "text-amber-700",
            tone === "danger" && "text-rose-700",
            tone === "neutral" && "text-aion-ink",
          )}
        >
          {value}
        </p>
      )}
      {hint ? <p className="mt-1 text-xs text-aion-muted">{hint}</p> : null}
    </Card>
  );
}

export function toneFromPct(value: number | null, invert = false): "ok" | "warn" | "danger" | "neutral" {
  if (value == null) return "neutral";
  const v = invert ? 100 - value : value;
  if (v >= 90) return "ok";
  if (v >= 70) return "warn";
  return "danger";
}

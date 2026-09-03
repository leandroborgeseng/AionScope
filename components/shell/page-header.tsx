import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-aion-ink">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm text-aion-muted">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

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
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3 sm:mb-5">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-aion-ink sm:text-2xl">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-aion-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex w-full flex-wrap gap-2 sm:w-auto">{actions}</div> : null}
    </div>
  );
}

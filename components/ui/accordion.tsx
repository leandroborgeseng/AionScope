"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Accordion({
  items,
  defaultOpenIds = [],
  className,
}: {
  items: Array<{ id: string; title: string; children: ReactNode }>;
  defaultOpenIds?: string[];
  className?: string;
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(defaultOpenIds));
  const baseId = useId();

  const toggle = (id: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className={cn("overflow-hidden rounded-xl border border-aion-line bg-white", className)}>
      {items.map((item, index) => {
        const isOpen = open.has(item.id);
        const panelId = `${baseId}-${item.id}-panel`;
        const buttonId = `${baseId}-${item.id}-button`;
        return (
          <div key={item.id} className={cn(index > 0 && "border-t border-aion-line")}>
            <h3>
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(item.id)}
                className="flex w-full items-center justify-between gap-3 bg-white px-4 py-3 text-left text-sm font-semibold text-aion-ink transition hover:bg-aion-mist/60"
              >
                <span>{item.title}</span>
                <ChevronDown
                  className={cn("h-4 w-4 shrink-0 text-aion-muted transition-transform", isOpen && "rotate-180")}
                />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!isOpen}
              className="border-t border-aion-mist px-4 py-4 text-sm text-aion-ink"
            >
              {isOpen ? item.children : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

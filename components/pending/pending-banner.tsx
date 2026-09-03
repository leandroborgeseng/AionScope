import { AlertTriangle } from "lucide-react";

export function PendingBanner({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-amber-900/80">
          {detail ?? "Aguardando liberação do suporte GlobalThings. A seção será ativada automaticamente quando o endpoint responder 200."}
        </p>
      </div>
    </div>
  );
}

export function SectionError({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
      {message}
    </div>
  );
}

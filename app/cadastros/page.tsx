import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CADASTROS } from "@/lib/indicadores/catalog";

export default function CadastrosHubPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Cadastros"
        description="Contratos, valor do parque e equipamentos de terceiros. Persistência em SQLite no volume /data."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {CADASTROS.map((item) => (
          <Link key={item.href} href={item.href} className="group block rounded-xl focus-visible:outline-none">
            <Card className="h-full border-aion-line transition-colors group-hover:border-aion-blue/40 group-hover:bg-aion-mist/50 group-focus-visible:ring-2 group-focus-visible:ring-aion-blue/35">
              <CardHeader className="p-5">
                <CardTitle className="text-base text-aion-ink group-hover:text-aion-blue">{item.label}</CardTitle>
                <CardDescription className="mt-1 text-sm leading-relaxed text-aion-ink/60">
                  {item.blurb}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

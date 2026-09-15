import { redirect } from "next/navigation";
import { oficinasPlanoCanonicalHref } from "@/lib/pbi/volume-ec";

/** Rota antiga → página canônica com filtro Preventiva. */
export default function OficinaPreventivaAbertasFechadasRedirect() {
  redirect(oficinasPlanoCanonicalHref("preventiva"));
}

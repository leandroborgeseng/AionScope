import { redirect } from "next/navigation";
import { oficinasPlanoCanonicalHref } from "@/lib/pbi/volume-ec";

/** Rota antiga → página canônica com filtro Segurança elétrica. */
export default function OficinaSegurancaEletricaAbertasFechadasRedirect() {
  redirect(oficinasPlanoCanonicalHref("seguranca-eletrica"));
}

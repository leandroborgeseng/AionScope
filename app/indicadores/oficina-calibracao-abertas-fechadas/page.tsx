import { redirect } from "next/navigation";
import { oficinasPlanoCanonicalHref } from "@/lib/pbi/volume-ec";

/** Rota antiga → página canônica com filtro Calibração. */
export default function OficinaCalibracaoAbertasFechadasRedirect() {
  redirect(oficinasPlanoCanonicalHref("calibracao"));
}

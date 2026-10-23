import { redirect } from "next/navigation";

/** A tela Processos saiu da Sala (D-SD4). Links antigos caem na Sala. */
export default function Page() {
  redirect("/sala");
}

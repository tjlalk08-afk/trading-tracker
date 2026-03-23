import { redirect } from "next/navigation";

export default function SymbolsRedirectPage() {
  redirect("/dashboard/trades");
}

import { redirect } from "next/navigation";

export default function TradingViewRedirectPage() {
  redirect("/dashboard/trades");
}

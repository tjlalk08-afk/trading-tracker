import { redirect } from "next/navigation";

export default function BotRedirectPage() {
  redirect("/dashboard/live");
}

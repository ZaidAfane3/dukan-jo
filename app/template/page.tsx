import { redirect } from "next/navigation";

/* A short link for the admin's starter-template editor */
export default function TemplatePage() {
  redirect("/design?template=1");
}

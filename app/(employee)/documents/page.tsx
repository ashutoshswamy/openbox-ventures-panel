import { employeePage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { PageHeader } from "@/components/shell";
import { DocumentList } from "@/components/documents";

export const metadata = { title: "Documents" };

// Own documents HR keeps for you (RLS: employee_documents read policy).
export default async function Documents() {
  const me = await employeePage();
  const { data } = await db().from("employee_documents").select("id, category, title, expires_on, created_at").eq("employee_id", me.id).order("created_at", { ascending: false });
  return (
    <>
      <PageHeader title="Documents" sub="Offer letter, contract and other files HR keeps for you." />
      <section className="card"><DocumentList docs={data ?? []} /></section>
    </>
  );
}

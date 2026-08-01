import { redirect } from "next/navigation";

export default async function NotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/student/notes/${id}/summary`);
}

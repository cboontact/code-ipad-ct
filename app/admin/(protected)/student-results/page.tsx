import { StudentAdmin } from "@/components/admin/student-admin";

export default async function StudentResultsPage({ searchParams }: { searchParams: Promise<{ grade?: string; room?: string }> }) {
  const { grade = "", room = "" } = await searchParams;
  return <StudentAdmin view="results" initialGrade={grade} initialRoom={room} />;
}

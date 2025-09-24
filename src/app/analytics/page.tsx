import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { redirect } from "next/navigation";
import { getUserAnalytics } from "@/lib/analytics";
import UserReportsClient from "../../components/analytics/user-reports-client";

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");

  const stats = await getUserAnalytics(session.user.id);

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">My Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Overview across all your projects.</p>
      </div>

      <UserReportsClient stats={stats} />
    </main>
  );
}

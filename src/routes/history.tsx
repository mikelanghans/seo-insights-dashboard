import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { RecentScans } from "@/components/seo/RecentScans";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Scan history — SEOAudit" },
      { name: "description", content: "Your recent SEO and accessibility scans." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { user, loading } = useAuth();

  if (!loading && !user) return <Navigate to="/auth" />;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Scan history</h1>
            <p className="text-sm text-muted-foreground">Your recent SEO and accessibility scans.</p>
          </div>
          <Link to="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              New scan
            </Button>
          </Link>
        </div>
        <RecentScans />
      </main>
    </div>
  );
}

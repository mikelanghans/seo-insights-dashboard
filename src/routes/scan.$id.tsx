import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ScanSearch, ArrowLeft } from "lucide-react";
import { SiteResults } from "@/components/seo/SiteResults";
import { AppHeader } from "@/components/AppHeader";
import { loadScan, updateScanReport, type SavedScan } from "@/lib/scans";
import type { SiteAuditReport } from "@/lib/seo-types";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/scan/$id")({
  component: ScanPage,
  head: () => ({
    meta: [
      { title: "Saved scan — SEO Audit" },
      { name: "description", content: "View a saved SEO site audit." },
    ],
  }),
});

function ScanPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [scan, setScan] = useState<SavedScan | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      void navigate({ to: "/auth" });
      return;
    }
    let active = true;
    setLoading(true);
    loadScan(id).then((data) => {
      if (!active) return;
      if (!data) setNotFound(true);
      else setScan(data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [id, user, authLoading, navigate]);

  function handleReportUpdate(next: SiteAuditReport) {
    setScan((prev) => (prev ? { ...prev, report: next } : prev));
    void updateScanReport(id, next);
  }

  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)]">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to scanner
        </Link>

        {loading || authLoading ? (
          <div className="flex items-center justify-center rounded-xl border border-border bg-card p-12">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading scan…</span>
          </div>
        ) : notFound ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <ScanSearch className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Scan not found</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              It may have been deleted or belongs to another account.
            </p>
          </div>
        ) : scan ? (
          <SiteResults report={scan.report} onReportUpdate={handleReportUpdate} />
        ) : null}
      </main>
    </div>
  );
}

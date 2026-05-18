import { Link } from "@tanstack/react-router";
import { Briefcase, Clock, Home, LogOut, ScanSearch, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export function AppHeader() {
  const { user, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    toast.success("Signed out");
  }

  return (
    <header className="border-b border-border/80 bg-card/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--gradient-hero)] shadow-[var(--shadow-elegant)]">
            <ScanSearch className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-foreground">
              SEO<span className="text-primary">Audit</span>
            </h1>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Agency Edition
            </p>
          </div>
        </Link>

        {user ? (
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <Home className="mr-1.5 h-3.5 w-3.5" />
                Home
              </Button>
            </Link>
            <Link to="/clients">
              <Button variant="ghost" size="sm">
                <Briefcase className="mr-1.5 h-3.5 w-3.5" />
                Clients
              </Button>
            </Link>
            <Link to="/history">
              <Button variant="ghost" size="sm">
                <Clock className="mr-1.5 h-3.5 w-3.5" />
                History
              </Button>
            </Link>
            <div className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              <UserIcon className="h-3.5 w-3.5" />
              <span className="max-w-[180px] truncate">{user.email}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-1.5 h-3.5 w-3.5" />
              Sign out
            </Button>
          </div>
        ) : (
          <Link to="/auth">
            <Button size="sm">Sign in</Button>
          </Link>
        )}
      </div>
    </header>
  );
}

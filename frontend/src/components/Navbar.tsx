import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Tag } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthUser, setLocalUser } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Navbar() {
  const user = useAuthUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await api.auth.signOut();
    setLocalUser(null);
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow shadow-[0_0_24px_-4px_var(--primary)]">
            <span className="text-lg font-bold text-primary-foreground">R</span>
            <span className="absolute -inset-1 -z-10 rounded-2xl bg-primary/40 blur-md" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">Reunite</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Link
            to="/items"
            className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&.active]:bg-accent [&.active]:text-foreground"
          >
            Browse items
          </Link>
          {user && (
            <Link
              to="/my-reports"
              className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&.active]:bg-accent [&.active]:text-foreground"
            >
              My reports
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="hero"
            size="sm"
            className="hidden sm:inline-flex"
          >
            <Link to="/report">
              <Plus className="h-4 w-4" />
              Report an item
            </Link>
          </Button>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-foreground ring-1 ring-border transition hover:ring-ring"
                  aria-label="Account menu"
                >
                  {(user.email ?? "U")[0].toUpperCase()}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-2xl">
                <DropdownMenuLabel className="font-normal">
                  <span className="block text-sm font-medium text-foreground">
                    {user.email}
                  </span>
                  <span className="text-xs text-muted-foreground">Signed in</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/my-reports" className="flex items-center gap-2">
                    <Tag className="h-4 w-4" /> My reports
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/items" className="flex items-center gap-2">
                    <Search className="h-4 w-4" /> Browse items
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

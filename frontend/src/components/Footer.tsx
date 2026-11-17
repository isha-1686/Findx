import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-border/60 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-glow text-xs font-bold text-primary-foreground">
            R
          </span>
          <span className="font-display font-medium text-foreground">Reunite</span>
          <span>— helping lost things get found.</span>
        </div>
        <nav className="flex items-center gap-5">
          <Link to="/items" className="transition-colors hover:text-foreground">
            Browse
          </Link>
          <Link to="/report" className="transition-colors hover:text-foreground">
            Report an item
          </Link>
          <Link to="/auth" className="transition-colors hover:text-foreground">
            Sign in
          </Link>
        </nav>
      </div>
    </footer>
  );
}

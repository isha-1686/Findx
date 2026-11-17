import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { CheckCircle2, CircleDashed, MapPin, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthUser } from "@/lib/auth-store";
import { timeAgo, type ItemRow } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/my-reports")({
  head: () => ({
    meta: [
      { title: "My Reports — Reunite" },
      {
        name: "description",
        content: "Manage your lost and found reports: mark them resolved or remove them.",
      },
      { property: "og:title", content: "My Reports — Reunite" },
      {
        property: "og:description",
        content: "Manage your lost and found reports on Reunite.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyReportsPage,
});

function MyReportsPage() {
  const user = useAuthUser();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: items = [], isPending } = useQuery({
    queryKey: ["my-reports", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<ItemRow[]> => {
      return api.reports.list({ user_id: user!.id, status: "all" });
    },
  });

  async function toggleStatus(item: ItemRow) {
    const next = item.status === "open" ? "resolved" : "open";
    try {
      await api.reports.updateStatus(item.id, next as "open" | "resolved");
      queryClient.invalidateQueries({ queryKey: ["my-reports"] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["item", item.id] });
      toast.success(next === "resolved" ? "Marked as reunited 🎉" : "Reopened");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await api.reports.delete(id);
      queryClient.invalidateQueries({ queryKey: ["my-reports"] });
      toast.success("Report deleted");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete report");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">
            My <span className="text-gradient">reports</span>
          </h1>
          <p className="mt-2 text-muted-foreground">
            Track your posts — mark one resolved when it's back with its owner.
          </p>
        </div>
        <Button asChild variant="hero" className="rounded-full">
          <Link to="/report">
            <Plus className="h-4 w-4" />
            New report
          </Link>
        </Button>
      </div>

      {isPending ? (
        <div className="mt-8 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-3xl bg-card/50" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="glow-card mt-8 rounded-3xl px-8 py-16 text-center">
          <p className="font-display text-xl font-semibold">No reports yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Lost something or found something? Post your first report.
          </p>
          <Button asChild variant="hero" className="mt-6 rounded-full">
            <Link to="/report">
              <Plus className="h-4 w-4" />
              Report an item
            </Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-4 rounded-3xl border border-border bg-card/60 p-5"
            >
              <span
                className={`hidden shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider sm:inline ${
                  item.type === "lost" ? "bg-lost/15 text-lost" : "bg-found/15 text-found"
                }`}
              >
                {item.type}
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  to="/items/$id"
                  params={{ id: item.id }}
                  className="truncate font-display text-base font-semibold hover:text-primary-glow"
                >
                  {item.title}
                </Link>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {item.location} · {timeAgo(item.created_at)}
                </p>
              </div>
              <button
                onClick={() => toggleStatus(item)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  item.status === "resolved"
                    ? "bg-primary/15 text-primary-glow hover:bg-primary/25"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
                title={item.status === "resolved" ? "Reopen" : "Mark as reunited"}
              >
                {item.status === "resolved" ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <CircleDashed className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">
                  {item.status === "resolved" ? "Reunited" : "Open"}
                </span>
              </button>
              <button
                onClick={() => handleDelete(item.id)}
                disabled={deletingId === item.id}
                className="shrink-0 rounded-full p-2 text-muted-foreground transition hover:bg-destructive/15 hover:text-destructive"
                title="Delete report"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

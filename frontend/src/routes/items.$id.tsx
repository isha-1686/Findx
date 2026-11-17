import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowLeft,
  Clock,
  MapPin,
  User,
  Sparkles,
  CheckCircle2,
  ExternalLink,
  HeartHandshake,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthUser } from "@/lib/auth-store";
import { timeAgo, type ItemRow, type AIMatchResult } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/items/$id")({
  head: () => ({
    meta: [
      { title: "Item details — Reunite" },
      {
        name: "description",
        content: "Details and AI-assisted visual matches for lost and found reports.",
      },
    ],
  }),
  component: ItemDetailPage,
});

function ItemDetailPage() {
  const { id } = Route.useParams();
  const user = useAuthUser();
  const queryClient = useQueryClient();
  const [selectedMatch, setSelectedMatch] = useState<AIMatchResult | null>(null);
  const [confirmingMatch, setConfirmingMatch] = useState(false);

  // Fetch report details
  const {
    data: item,
    isPending,
    isError,
  } = useQuery({
    queryKey: ["item", id],
    queryFn: () => api.reports.get(id),
  });

  // Fetch AI potential matches for this item
  const {
    data: matchData,
    isPending: matchesPending,
    isError: matchesError,
  } = useQuery({
    queryKey: ["matches", id],
    queryFn: () => api.matching.getItemMatches(id, 6),
    enabled: !!item && item.status === "open",
  });

  async function confirmMatch() {
    if (!selectedMatch || !item) return;

    setConfirmingMatch(true);
    try {
      await api.matching.confirmItemMatch(item.id, selectedMatch.item.id);
      setSelectedMatch(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["item", item.id] }),
        queryClient.invalidateQueries({ queryKey: ["item", selectedMatch.item.id] }),
        queryClient.invalidateQueries({ queryKey: ["matches", item.id] }),
        queryClient.invalidateQueries({ queryKey: ["items"] }),
        queryClient.invalidateQueries({ queryKey: ["latest-items"] }),
        queryClient.invalidateQueries({ queryKey: ["stats"] }),
        queryClient.invalidateQueries({ queryKey: ["my-reports"] }),
      ]);
      toast.success("Both reports are marked reunited and removed from active listings.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not confirm this match");
    } finally {
      setConfirmingMatch(false);
    }
  }

  if (isPending) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="h-96 animate-pulse rounded-3xl bg-card/50" />
      </div>
    );
  }

  if (isError || !item) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-24 text-center">
        <p className="font-display text-2xl font-semibold">Report not found</p>
        <p className="mt-2 text-muted-foreground">It may have been removed or resolved.</p>
        <Link
          to="/items"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary-glow hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to browse
        </Link>
      </div>
    );
  }

  const isLost = item.type === "lost";
  const matches = matchData?.matches || [];
  const canConfirmMatch = !!user && user.id === item.user_id && item.status === "open";

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        to="/items"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to browse
      </Link>

      <div className="flex flex-col">
      {/* AI Matches Section */}
      <section className="order-1 mt-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-glow">
              <Sparkles className="h-3.5 w-3.5" /> AI Visual Matching Engine
            </div>
            <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
              Potential matches ({matchData?.searched_in || (isLost ? "found" : "lost")} items)
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              AI ranks likely matches. Review the details and confirm only when you are sure.
            </p>
          </div>
        </div>

        {item.status !== "open" ? (
          <div className="glow-card mt-6 rounded-3xl p-8 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-primary-glow" />
            <p className="mt-3 font-display text-base font-semibold">
              This report has been reunited
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              It is no longer included in active match suggestions or listings.
            </p>
          </div>
        ) : matchesPending ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-3xl bg-card/50" />
            ))}
          </div>
        ) : matchesError ? (
          <div className="glow-card mt-6 rounded-3xl p-8 text-center">
            <p className="font-display text-base font-semibold">Match suggestions unavailable</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Please try again later. Your report is still open.
            </p>
          </div>
        ) : matches.length === 0 ? (
          <div className="glow-card mt-6 rounded-3xl p-8 text-center">
            <p className="font-display text-base font-semibold">No potential matches found yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              When someone uploads a matching photograph in the opposite section, it will appear
              here.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {matches.map((match: AIMatchResult) => (
              <CandidateCard
                key={match.item.id}
                match={match}
                canConfirm={canConfirmMatch}
                onConfirm={() => setSelectedMatch(match)}
              />
            ))}
          </div>
        )}

        {!canConfirmMatch && item.status === "open" && matches.length > 0 && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Sign in as the person who posted this report to confirm a match.
          </p>
        )}
      </section>

      {/* Main Item Report Card */}
      <article
        className={`order-2 mt-8 overflow-hidden rounded-3xl border p-6 sm:p-8 ${
          isLost ? "lost-tint" : "found-tint"
        }`}
      >
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Photo */}
          <div className="relative h-72 sm:h-80 w-full overflow-hidden rounded-2xl bg-muted/40 border border-border/60">
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.title}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                No photograph provided
              </div>
            )}
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <span
                className={`rounded-full px-3.5 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur-md text-white ${
                  isLost ? "bg-lost/80" : "bg-found/80"
                }`}
              >
                {item.type}
              </span>
              {item.category && (
                <span className="rounded-full bg-background/80 px-3 py-1 text-xs font-medium backdrop-blur-md">
                  {item.category}
                </span>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2">
                {item.status === "resolved" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-3 py-1 text-xs font-semibold text-primary-glow">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Reunited with owner
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                    Status: Open
                  </span>
                )}
              </div>

              <h1 className="mt-4 font-display text-2xl font-bold leading-tight sm:text-3xl">
                {item.title}
              </h1>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {item.description}
              </p>
            </div>

            <div className="mt-6 space-y-3 rounded-2xl border border-border/70 bg-background/50 p-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 text-primary-glow" /> Location:
                </span>
                <span className="font-medium text-foreground">{item.location}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> Posted:
                </span>
                <span className="font-medium text-foreground">{timeAgo(item.created_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <User className="h-3.5 w-3.5" /> Reported by:
                </span>
                <span className="font-medium text-foreground">
                  {item.profiles?.display_name ?? "Anonymous"}
                </span>
              </div>
            </div>

            {item.contact_info && (
              <div className="mt-4 rounded-2xl border border-primary/40 bg-primary/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary-glow">
                  {isLost ? "Contact Finder / Reporter" : "Think it's yours?"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Reach out directly:{" "}
                  <span className="font-semibold text-foreground">{item.contact_info}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </article>

      </div>

      <AlertDialog
        open={!!selectedMatch}
        onOpenChange={(open) => {
          if (!open && !confirmingMatch) setSelectedMatch(null);
        }}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm these items are reunited?</AlertDialogTitle>
            <AlertDialogDescription>
              Confirm that <strong>{item.title}</strong> matches{" "}
              <strong>{selectedMatch?.item.title}</strong>. Both reports will be marked reunited and
              removed from active listings, but will remain in My Reports.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmingMatch}>Not yet</AlertDialogCancel>
            <Button onClick={confirmMatch} disabled={confirmingMatch}>
              <HeartHandshake className="mr-2 h-4 w-4" />
              {confirmingMatch ? "Confirming..." : "Yes, mark reunited"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CandidateCard({
  match,
  canConfirm,
  onConfirm,
}: {
  match: AIMatchResult;
  canConfirm: boolean;
  onConfirm: () => void;
}) {
  const { item, match_percentage, visual_similarity, category_matched } = match;

  return (
    <div className="glow-card flex flex-col overflow-hidden rounded-3xl border border-border transition-all hover:border-primary/50">
      <div className="relative h-44 w-full bg-muted/40">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            No image
          </div>
        )}
        <div className="absolute top-3 left-3">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider backdrop-blur-md text-white ${
              item.type === "lost" ? "bg-lost/85" : "bg-found/85"
            }`}
          >
            {item.type}
          </span>
        </div>
        {/* Match Percentage Pill */}
        <div className="absolute top-3 right-3 rounded-full bg-background/90 px-3 py-1 text-xs font-bold text-primary-glow shadow-md backdrop-blur-md">
          {match_percentage}% Match
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h4 className="font-display text-base font-semibold text-foreground line-clamp-1">
          {item.title}
        </h4>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {item.description}
        </p>

        {/* AI Breakdown */}
        <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="rounded-md bg-card px-2 py-0.5 border border-border">
            Visual: <strong>{visual_similarity}%</strong>
          </span>
          {category_matched && (
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-primary-glow font-medium">
              Category Matched
            </span>
          )}
        </div>

        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 text-primary-glow shrink-0" />
          <span className="truncate">{item.location}</span>
        </div>

        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
          {item.contact_info ? (
            <span className="text-[11px] text-muted-foreground truncate max-w-[140px]" title={item.contact_info}>
              Contact: {item.contact_info}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              By: {item.profiles?.display_name ?? "Anonymous"}
            </span>
          )}

          <Button asChild size="sm" variant="outline" className="rounded-full text-xs h-7 px-3">
            <Link to="/items/$id" params={{ id: item.id }}>
              View <ExternalLink className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
        {canConfirm && (
          <Button
            type="button"
            variant="hero"
            size="sm"
            className="mx-4 mb-4 rounded-full"
            onClick={onConfirm}
          >
            <HeartHandshake className="mr-1.5 h-4 w-4" />
            Confirm this match
          </Button>
        )}
      </div>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, KeyRound, Plus, SearchCheck, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { HeroScene } from "@/components/HeroScene";
import { ItemCard } from "@/components/ItemCard";
import { Button } from "@/components/ui/button";
import { CATEGORIES, type ItemRow } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Reunite — Lost & Found, Reimagined" },
      {
        name: "description",
        content:
          "Report a lost item, post something you found, and help belongings find their way home. Browse live lost & found reports.",
      },
      { property: "og:title", content: "Reunite — Lost & Found, Reimagined" },
      {
        property: "og:description",
        content:
          "Report a lost item, post something you found, and help belongings find their way home.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

async function fetchLatest(): Promise<ItemRow[]> {
  return api.reports.list({ limit: 6, status: "open" });
}

async function fetchStats() {
  return api.reports.getStats();
}

function Index() {
  const { data: items = [] } = useQuery({ queryKey: ["latest-items"], queryFn: fetchLatest });
  const statsQuery = useQuery({ queryKey: ["stats"], queryFn: fetchStats });
  const stats = statsQuery.data ?? { lost: 0, found: 0, resolved: 0, total: 0 };
  const lostCount = { data: stats.lost };
  const foundCount = { data: stats.found };
  const resolvedCount = { data: stats.resolved };

  const lostItems = items.filter((i) => i.type === "lost").slice(0, 3);
  const foundItems = items.filter((i) => i.type === "found").slice(0, 3);

  return (
    <div className="mx-auto max-w-6xl px-4">
      {/* ---------- Hero ---------- */}
      <section className="grid items-center gap-8 py-14 lg:grid-cols-2 lg:py-20">
        <div>
          <div className="animate-fade-up mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary-glow">
            <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-primary-glow" />
            Community lost & found
          </div>
          <h1 className="animate-fade-up-delay-1 font-display text-4xl font-bold leading-[1.08] sm:text-5xl lg:text-6xl">
            Lost something?
            <br />
            <span className="text-gradient">Found something?</span>
          </h1>
          <p className="animate-fade-up-delay-2 mt-5 max-w-lg text-lg text-muted-foreground">
            Post what went missing or what you picked up, with a description and where it
            happened — and help belongings get back to their people.
          </p>
          <div className="animate-fade-up-delay-3 mt-8 flex flex-wrap items-center gap-3">
            <Button asChild variant="hero" size="lg" className="rounded-full text-base">
              <Link to="/report">
                <Plus className="h-5 w-5" />
                Report an item
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-full text-base">
              <Link to="/items">
                Browse items
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="mt-10 flex gap-8 text-sm">
            <Stat label="Lost reports" value={lostCount.data ?? 0} tone="text-lost" />
            <Stat label="Found posts" value={foundCount.data ?? 0} tone="text-found" />
            <Stat label="Reunited" value={resolvedCount.data ?? 0} tone="text-primary-glow" />
          </div>
        </div>

        <div className="animate-fade-up-delay-2">
          <HeroScene />
        </div>
      </section>

      {/* ---------- Bento grid ---------- */}
      <section className="grid gap-4 pb-6 md:grid-cols-6">
        {/* Lost CTA */}
        <Link
          to="/report"
          search={{ type: "lost" }}
          className="lost-tint group relative col-span-full overflow-hidden rounded-3xl border p-7 transition-transform hover:-translate-y-1 md:col-span-3"
        >
          <span className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-lost/20 blur-3xl transition group-hover:bg-lost/30" />
          <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-lost/15">
            <SearchCheck className="h-6 w-6 text-lost" />
          </span>
          <h3 className="font-display text-2xl font-semibold">I lost something</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Describe the item and where you last had it. Someone out there may have picked
            it up.
          </p>
          <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-lost">
            Post a lost report
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>

        {/* Found CTA */}
        <Link
          to="/report"
          search={{ type: "found" }}
          className="found-tint group relative col-span-full overflow-hidden rounded-3xl border p-7 transition-transform hover:-translate-y-1 md:col-span-3"
        >
          <span className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-found/20 blur-3xl transition group-hover:bg-found/30" />
          <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-found/15">
            <KeyRound className="h-6 w-6 text-found" />
          </span>
          <h3 className="font-display text-2xl font-semibold">I found something</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Found a wallet, phone or keys? Post it here so its owner can reach you.
          </p>
          <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-found">
            Post a found report
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>

        {/* How it works */}
        <div className="glow-card col-span-full rounded-3xl p-7 md:col-span-6">
          <h3 className="font-display text-xl font-semibold">How Reunite works</h3>
          <div className="mt-5 grid gap-6 sm:grid-cols-3">
            {[
              [
                "Report it",
                "Add a description, category and the location where it was lost or found.",
              ],
              [
                "Get matched",
                "See AI-ranked reports that may match yours, with photos and details to compare.",
              ],
              [
                "Reunite",
                "Confirm a match when you're sure; both reports leave active listings and stay in My Reports.",
              ],
            ].map(([title, body], i) => (
              <div key={title} className="relative">
                <span className="font-display text-4xl font-bold text-primary/25">
                  0{i + 1}
                </span>
                <h4 className="mt-1 font-display text-base font-semibold">{title}</h4>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Latest lost */}
        <div className="col-span-full rounded-3xl border border-border bg-card/60 p-6 md:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">
              Latest <span className="text-lost">lost</span> reports
            </h3>
            <Link
              to="/items"
              className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              See all →
            </Link>
          </div>
          <div className="space-y-3">
            {lostItems.length === 0 && (
              <p className="text-sm text-muted-foreground">No lost reports yet — be the first.</p>
            )}
            {lostItems.map((item) => (
              <ItemRowMini key={item.id} item={item} />
            ))}
          </div>
        </div>

        {/* Latest found */}
        <div className="col-span-full rounded-3xl border border-border bg-card/60 p-6 md:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">
              Latest <span className="text-found">found</span> posts
            </h3>
            <Link
              to="/items"
              className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              See all →
            </Link>
          </div>
          <div className="space-y-3">
            {foundItems.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing posted as found yet.</p>
            )}
            {foundItems.map((item) => (
              <ItemRowMini key={item.id} item={item} />
            ))}
          </div>
        </div>

        {/* Categories */}
        <div className="col-span-full rounded-3xl border border-border bg-card/60 p-6 md:col-span-6">
          <h3 className="mb-4 font-display text-lg font-semibold">Browse by category</h3>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat}
                to="/items"
                search={{ category: cat }}
                className="rounded-full border border-border bg-secondary/60 px-4 py-2 text-sm text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
              >
                {cat}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Closing band ---------- */}
      <section className="glow-card relative my-10 overflow-hidden rounded-3xl px-8 py-14 text-center">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_100%_at_50%_0%,var(--primary)_0%,transparent_70%)] opacity-40" />
        <h2 className="font-display text-3xl font-bold sm:text-4xl">
          Someone is looking for what you <span className="text-gradient">just found</span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Every report you post is a chance to make someone's day.
        </p>
        <Button asChild variant="hero" size="lg" className="mt-8 rounded-full text-base">
          <Link to="/report">
            <Plus className="h-5 w-5" />
            Report an item now
          </Link>
        </Button>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <p className={`font-display text-2xl font-bold ${tone}`}>{value}</p>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function ItemRowMini({ item }: { item: ItemRow }) {
  return (
    <Link
      to="/items/$id"
      params={{ id: item.id }}
      className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/40 px-4 py-3 transition hover:border-primary/40"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="truncate text-xs text-muted-foreground">{item.location}</p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
          item.type === "lost" ? "bg-lost/15 text-lost" : "bg-found/15 text-found"
        }`}
      >
        {item.type}
      </span>
    </Link>
  );
}

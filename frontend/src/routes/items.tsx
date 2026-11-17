import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { ItemCard } from "@/components/ItemCard";
import { Input } from "@/components/ui/input";
import { CATEGORIES, type ItemRow, type ItemType } from "@/lib/format";

export const Route = createFileRoute("/items")({
  validateSearch: (search: Record<string, unknown>) => ({
    type: (search.type as ItemType | undefined) ?? undefined,
    category: (search.category as string | undefined) ?? undefined,
    q: (search.q as string | undefined) ?? undefined,
  }),
  head: () => ({
    meta: [
      { title: "Browse Lost & Found Items — Reunite" },
      {
        name: "description",
        content:
          "Browse live lost and found reports with descriptions and locations. Search by category or keyword.",
      },
      { property: "og:title", content: "Browse Lost & Found Items — Reunite" },
      {
        property: "og:description",
        content: "Browse live lost and found reports with descriptions and locations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ItemsPage,
});

async function fetchItems(filters: { type?: ItemType; category?: string; q?: string }) {
  return api.reports.list({
    type: filters.type,
    category: filters.category,
    q: filters.q,
    limit: 48,
    status: "open",
  });
}

function ItemsPage() {
  const isItemDetailRoute = useRouterState({
    select: (state) => state.matches.some((match) => match.routeId === "/items/$id"),
  });

  if (isItemDetailRoute) return <Outlet />;
  return <ItemsListPage />;
}

function ItemsListPage() {
  const { type, category, q } = Route.useSearch();
  const navigate = useNavigateSafe();
  const [searchDraft, setSearchDraft] = useState(q ?? "");

  const filters = useMemo(() => ({ type, category, q }), [type, category, q]);
  const { data: items = [], isPending } = useQuery({
    queryKey: ["items", filters],
    queryFn: () => fetchItems(filters),
  });

  const tabs: Array<{ label: string; value?: ItemType; tone: string }> = [
    { label: "All", value: undefined, tone: "text-foreground" },
    { label: "Lost", value: "lost", tone: "text-lost" },
    { label: "Found", value: "found", tone: "text-found" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">
            Browse <span className="text-gradient">lost & found</span>
          </h1>
          <p className="mt-2 text-muted-foreground">
            Scan recent reports — maybe you recognise something.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {tabs.map((tab) => {
              const active = (type ?? undefined) === tab.value;
              return (
                <button
                  key={tab.label}
                  onClick={() =>
                    navigate({ type: tab.value, category, q: q ?? undefined })
                  }
                  className={`rounded-full border px-5 py-2 text-sm font-semibold transition ${
                    active
                      ? "border-primary/60 bg-primary/15 text-foreground"
                      : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className={active ? tab.tone : undefined}>{tab.label}</span>
                </button>
              );
            })}
            <form
              className="relative ml-auto w-full sm:w-72"
              onSubmit={(e) => {
                e.preventDefault();
                navigate({ type, category, q: searchDraft || undefined });
              }}
            >
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder="Search by title…"
                className="rounded-full bg-card/60 pl-10"
              />
            </form>
          </div>

          <div className="flex flex-wrap gap-2">
            <Chip
              active={!category}
              onClick={() => navigate({ type, q, category: undefined })}
            >
              All categories
            </Chip>
            {CATEGORIES.map((cat) => (
              <Chip
                key={cat}
                active={category === cat}
                onClick={() => navigate({ type, q, category: cat })}
              >
                {cat}
              </Chip>
            ))}
          </div>
        </div>

        {/* Grid */}
        {isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-52 animate-pulse rounded-3xl bg-card/50" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-border bg-card/60 px-8 py-16 text-center">
            <p className="font-display text-xl font-semibold">No matching reports</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Try clearing filters, or be the first to post.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function useNavigateSafe() {
  const { navigate } = useNavigateInternal();
  return (params: { type?: ItemType; category?: string; q?: string }) =>
    navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, ...params }) });
}

import { useNavigate as useNavigateInternal } from "@tanstack/react-router";

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
        active
          ? "border-primary/60 bg-primary/15 text-foreground"
          : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

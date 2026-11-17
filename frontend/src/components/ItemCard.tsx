import { useRef } from "react";
import { Link } from "@tanstack/react-router";
import { MapPin, User, ImageIcon } from "lucide-react";
import { timeAgo, type ItemRow } from "@/lib/format";

/**
 * Item card with image thumbnail and subtle 3D tilt.
 */
export function ItemCard({ item }: { item: ItemRow }) {
  const innerRef = useRef<HTMLDivElement>(null);

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = innerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${(-py * 8).toFixed(2)}deg) rotateY(${(px * 10).toFixed(2)}deg) translateY(-4px)`;
  }

  function handleLeave() {
    const el = innerRef.current;
    if (el) el.style.transform = "";
  }

  const isLost = item.type === "lost";

  return (
    <div onMouseMove={handleMove} onMouseLeave={handleLeave} className="[perspective:900px]">
      <div ref={innerRef} className="tilt-3d h-full">
        <Link
          to="/items/$id"
          params={{ id: item.id }}
          className={`group flex h-full flex-col overflow-hidden rounded-3xl border transition-colors ${
            isLost ? "lost-tint hover:border-lost/60" : "found-tint hover:border-found/60"
          }`}
        >
          {/* Item Photograph / Image Header */}
          <div className="relative h-44 w-full overflow-hidden bg-muted/40">
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.title}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
                <ImageIcon className="h-12 w-12 stroke-1" />
              </div>
            )}
            <div className="absolute top-3 left-3 flex items-center gap-1.5">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur-md shadow-sm ${
                  isLost
                    ? "bg-lost/80 text-white"
                    : "bg-found/80 text-white"
                }`}
              >
                {item.type}
              </span>
              {item.category && (
                <span className="rounded-full bg-background/80 px-2.5 py-0.5 text-xs font-medium text-foreground backdrop-blur-md">
                  {item.category}
                </span>
              )}
            </div>
            {item.status === "resolved" && (
              <span className="absolute top-3 right-3 rounded-full bg-primary/90 px-3 py-1 text-xs font-semibold text-primary-foreground backdrop-blur-md">
                Reunited
              </span>
            )}
          </div>

          <div className="flex flex-1 flex-col p-5">
            <h3 className="font-display text-lg font-semibold leading-snug text-foreground group-hover:text-primary-glow">
              {item.title}
            </h3>
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>

            <div className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0 text-primary-glow" />
              <span className="truncate">{item.location}</span>
            </div>

            <div className="mt-auto flex items-center justify-between pt-4 text-xs text-muted-foreground border-t border-border/40">
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                {item.profiles?.display_name ?? "Anonymous"}
              </span>
              <span>{timeAgo(item.created_at)}</span>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

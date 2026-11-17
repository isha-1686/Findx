export const CATEGORIES = [
  "bag",
  "book",
  "card",
  "earphone",
  "key",
  "lipstick",
  "phone",
  "umbrella",
  "USBflashdisk",
  "vacuumcup",
  "other",
] as const;

export type ItemType = "lost" | "found";
export type ItemStatus = "open" | "resolved" | "closed";

export type ItemRow = {
  id: string;
  type: ItemType;
  title: string;
  description: string;
  location: string;
  category: string | null;
  contact_info: string | null;
  image_url: string | null;
  status: ItemStatus;
  user_id: string | null;
  created_at: string;
  updated_at?: string;
  profiles?: { display_name: string | null } | null;
};

export type AIMatchResult = {
  item: ItemRow;
  similarity_score: number;
  match_percentage: number;
  visual_similarity: number;
  category_matched: boolean;
  context_score?: number;
};

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(days / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

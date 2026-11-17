/**
 * API client connecting Frontend to FastAPI AI Lost & Found Backend.
 */
import type { ItemRow, ItemType, AIMatchResult } from "./format";

const API_BASE = (typeof import.meta !== "undefined" && import.meta.env?.["VITE_API_URL"]) || "http://localhost:8000/api/v1";
const TOKEN_KEY = "reunite_auth_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = `Request failed (${response.status})`;
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errorDetail;
    } catch {
      // Use fallback
    }
    throw new Error(errorDetail);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  auth: {
    async signUp(email: string, password: string, displayName?: string) {
      const res = await request<{ user: { id: string; email: string; display_name: string }; token: string }>(
        "/auth/signup",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, display_name: displayName }),
        }
      );
      setStoredToken(res.token);
      return res;
    },

    async signIn(email: string, password: string) {
      const res = await request<{ user: { id: string; email: string; display_name: string }; token: string }>(
        "/auth/signin",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }
      );
      setStoredToken(res.token);
      return res;
    },

    async demoLogin() {
      const res = await request<{ user: { id: string; email: string; display_name: string }; token: string }>(
        "/auth/demo",
        { method: "POST" }
      );
      setStoredToken(res.token);
      return res;
    },

    async me() {
      const token = getStoredToken();
      if (!token) return null;
      try {
        const res = await request<{ user: { id: string; email: string; display_name: string } }>("/auth/me");
        return res.user;
      } catch {
        setStoredToken(null);
        return null;
      }
    },

    async signOut() {
      try {
        await request("/auth/signout", { method: "POST" });
      } catch {
        // ignore error on sign out
      } finally {
        setStoredToken(null);
      }
    },
  },

  reports: {
    async list(filters: {
      type?: ItemType;
      category?: string;
      q?: string;
      user_id?: string;
      status?: string;
      limit?: number;
      offset?: number;
    } = {}): Promise<ItemRow[]> {
      const params = new URLSearchParams();
      if (filters.type) params.append("type", filters.type);
      if (filters.category) params.append("category", filters.category);
      if (filters.q) params.append("q", filters.q);
      if (filters.user_id) params.append("user_id", filters.user_id);
      if (filters.status) params.append("status", filters.status);
      if (filters.limit) params.append("limit", filters.limit.toString());
      if (filters.offset) params.append("offset", filters.offset.toString());

      const res = await request<{ items: ItemRow[]; count: number }>(`/reports?${params.toString()}`);
      return res.items;
    },

    async get(id: string): Promise<ItemRow> {
      return request<ItemRow>(`/reports/${id}`);
    },

    async getStats(): Promise<{ lost: number; found: number; resolved: number; total: number }> {
      return request<{ lost: number; found: number; resolved: number; total: number }>("/reports/stats");
    },

    async create(formData: FormData): Promise<{
      message: string;
      item: ItemRow;
      ai_prediction: { predicted_category: string; confidence: number; has_embedding: boolean };
    }> {
      return request("/reports", {
        method: "POST",
        body: formData,
      });
    },

    async updateStatus(id: string, status: "open" | "resolved"): Promise<void> {
      const form = new FormData();
      form.append("status", status);
      await request(`/reports/${id}/status`, {
        method: "PATCH",
        body: form,
      });
    },

    async delete(id: string): Promise<void> {
      await request(`/reports/${id}`, {
        method: "DELETE",
      });
    },
  },

  matching: {
    async search(formData: FormData): Promise<{
      query_predicted_category: string;
      query_confidence: number;
      searched_in: string;
      total_candidates: number;
      matches: AIMatchResult[];
      note: string;
    }> {
      return request("/matching/search", {
        method: "POST",
        body: formData,
      });
    },

    async getItemMatches(itemId: string, topK: number = 5): Promise<{
      source_item_id: string;
      searched_in: string;
      matches: AIMatchResult[];
    }> {
      return request(`/matching/item/${itemId}?top_k=${topK}`);
    },

    async confirmItemMatch(
      itemId: string,
      matchedItemId: string,
    ): Promise<{
      message: string;
      resolved_item_ids: string[];
    }> {
      return request(`/matching/item/${itemId}/confirm/${matchedItemId}`, {
        method: "POST",
      });
    },
  },

  ml: {
    async predictCategory(file: File): Promise<{
      predicted_category: string;
      confidence: number;
    }> {
      const form = new FormData();
      form.append("image", file);
      return request("/ml/predict-category", {
        method: "POST",
        body: form,
      });
    },
  },
};

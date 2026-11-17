import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { api, getStoredToken } from "@/lib/api";

/**
 * Authentication gate: client-only, redirects unauthenticated visitors to /auth.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const token = getStoredToken();
    if (!token) {
      throw redirect({ to: "/auth" });
    }
    const user = await api.auth.me();
    if (!user) {
      throw redirect({ to: "/auth" });
    }
  },
  component: () => <Outlet />,
});

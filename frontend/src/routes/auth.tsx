import { useEffect, useState } from "react";
import { useNavigate, createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Sparkles, ShieldCheck } from "lucide-react";
import { api, getStoredToken } from "@/lib/api";
import { setLocalUser } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Reunite" },
      {
        name: "description",
        content: "Sign in or create a Reunite account to report lost and found items.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  // If already signed in, go home
  useEffect(() => {
    if (getStoredToken()) {
      api.auth.me().then((u) => {
        if (u) {
          setLocalUser(u);
          navigate({ to: "/", replace: true });
        }
      });
    }
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const res = await api.auth.signIn(email.trim(), password);
        setLocalUser(res.user);
        toast.success(`Welcome back, ${res.user.display_name}!`);
        navigate({ to: "/", replace: true });
      } else {
        const res = await api.auth.signUp(email.trim(), password, displayName.trim());
        setLocalUser(res.user);
        toast.success(`Account created! Welcome, ${res.user.display_name}!`);
        navigate({ to: "/", replace: true });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDemoLogin() {
    setBusy(true);
    try {
      const res = await api.auth.demoLogin();
      setLocalUser(res.user);
      toast.success("Signed in as Campus Security Desk (Demo)");
      navigate({ to: "/", replace: true });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Demo sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">
          {mode === "signin" ? "Welcome back" : "Join Reunite"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Sign in to post lost & found reports and see AI matches."
            : "Create an account to report lost or found items."}
        </p>
      </div>

      <div className="glow-card mt-8 rounded-3xl p-7">
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                placeholder="Janavi Arora"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="rounded-xl"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              placeholder="you@campus.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-xl"
            />
          </div>

          <Button type="submit" variant="hero" className="w-full rounded-full" disabled={busy}>
            {busy ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <span className="relative bg-card px-3 text-xs uppercase tracking-wider text-muted-foreground">
            Or quick demo
          </span>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleDemoLogin}
          disabled={busy}
          className="w-full rounded-full border-primary/40 bg-primary/10 hover:bg-primary/20"
        >
          <ShieldCheck className="mr-2 h-4 w-4 text-primary-glow" />
          Instant Demo Sign In (Campus Desk)
        </Button>

        <div className="mt-6 text-center text-sm">
          {mode === "signin" ? (
            <p className="text-muted-foreground">
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="font-medium text-primary-glow hover:underline"
              >
                Sign up
              </button>
            </p>
          ) : (
            <p className="text-muted-foreground">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="font-medium text-primary-glow hover:underline"
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

function PageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const next = params.get("next") || "/photographer";

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/staff-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Invalid password");
      }
      router.push(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-4 py-12">
      <div className="card w-full max-w-lg p-8">
        <p className="text-sm uppercase tracking-[0.3em] text-ig-gold/80">
          Staff Access
        </p>
        <h1 className="mt-2 font-display text-3xl text-ig-cream">
          Enter the staff password
        </h1>
        <p className="mt-2 text-sm text-ig-cream/70">
          Photographer and assistant screens require a shared password. Ask the
          event lead if you don&apos;t have it.
        </p>
        <form className="mt-6 space-y-3" onSubmit={handleSubmit}>
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-ig-emerald to-ig-gold px-5 py-3 text-lg font-semibold text-ig-forest shadow-lg transition hover:scale-[1.01]"
          >
            {loading ? "Signing in..." : "Unlock staff area"}
          </button>
          {error && <p className="text-sm text-red-200">{error}</p>}
        </form>
        <div className="mt-6 flex items-center justify-between text-sm text-ig-cream/70">
          <Link
            href="/"
            className="rounded-full border border-white/20 px-3 py-2 font-semibold text-ig-cream transition hover:border-ig-gold hover:text-ig-gold"
          >
            Back to parent view
          </Link>
          <span>Next: {next}</span>
        </div>
      </div>
    </div>
  );
}

export default function StaffLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-ig-cream">
          Loading...
        </div>
      }
    >
      <PageContent />
    </Suspense>
  );
}

"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function SignInPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = form.get("email")?.toString() ?? "";
    const password = form.get("password")?.toString() ?? "";
    if (!email || !password) return;
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (!res?.error) router.push("/dashboard");
    // else keep minimal feedback
  }
  return (
    <section className="max-w-md space-y-4">
      <h1 className="text-2xl font-semibold">sign in</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          name="email"
          type="email"
          placeholder="email"
          className="w-full rounded border px-3 py-2"
          required
        />
        <input
          name="password"
          type="password"
          placeholder="password"
          className="w-full rounded border px-3 py-2"
          required
        />
        <button disabled={loading} className="w-full rounded bg-black px-4 py-2 text-white">
          {loading ? "signing in..." : "sign in"}
        </button>
      </form>
    </section>
  );
}

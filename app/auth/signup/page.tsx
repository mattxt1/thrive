"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

function newIdemKey() {
  return crypto.randomUUID();
}

export default function SignUpPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const fullName = form.get("fullName")?.toString().trim();
    const username = form.get("username")?.toString().trim();
    const email = form.get("email")?.toString().trim();
    const password = form.get("password")?.toString() ?? "";
    if (!fullName || !username || !email || !password) return;
    setLoading(true);
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": newIdemKey(),
      },
      body: JSON.stringify({
        email,
        username,
        fullName,
        password,
      }),
    });
    setLoading(false);
    if (res.ok) router.push("/auth/signin");
  }
  return (
    <section className="max-w-md space-y-4">
      <h1 className="text-2xl font-semibold">create account</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          name="fullName"
          placeholder="full name"
          className="w-full rounded border px-3 py-2"
          required
        />
        <input
          name="username"
          placeholder="username (a–z, 0–9, _)"
          className="w-full rounded border px-3 py-2"
          required
        />
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
          placeholder="password (min 8)"
          className="w-full rounded border px-3 py-2"
          required
        />
        <button disabled={loading} className="w-full rounded bg-black px-4 py-2 text-white">
          {loading ? "creating..." : "create account"}
        </button>
      </form>
    </section>
  );
}

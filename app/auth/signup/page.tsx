"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

function newIdemKey() {
  return crypto.randomUUID();
}

export default function SignUpPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const form = new FormData(e.currentTarget);
    const payload = {
      fullName: String(form.get("fullName") || ""),
      username: String(form.get("username") || ""),
      email: String(form.get("email") || ""),
      password: String(form.get("password") || ""),
    };

    setLoading(true);
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": newIdemKey() },
      body: JSON.stringify(payload),
    }).catch(() => null);
    setLoading(false);

    if (!res) {
      setMsg("network error. try again.");
      return;
    }
    if (res.ok) {
      router.push("/auth/signin");
      return;
    }
    // Minimal, safe messages based on status code
    if (res.status === 409) setMsg("email or username already in use.");
    else if (res.status === 400) setMsg("check your inputs and try again.");
    else setMsg("unable to process. try again later.");
  }

  return (
    <section className="max-w-md space-y-4">
      <h1 className="text-2xl font-semibold">create account</h1>
      {msg && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {msg}
        </div>
      )}
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
          minLength={3}
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
          minLength={8}
        />
        <button disabled={loading} className="w-full rounded bg-black px-4 py-2 text-white">
          {loading ? "creating..." : "create account"}
        </button>
      </form>
    </section>
  );
}

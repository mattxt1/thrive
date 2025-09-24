"use client";
import { useEffect, useState } from "react";

type Account = {
  id: string;
  displayName: string;
  type: "CHECKING" | "SAVINGS";
  balanceCents: number;
};

function newIdemKey() {
  return crypto.randomUUID();
}

export default function TransferPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tab, setTab] = useState<"internal" | "p2p">("internal");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts ?? []));
  }, []);

  async function post(url: string, payload: Record<string, unknown>) {
    setMsg(null);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": newIdemKey() },
      body: JSON.stringify(payload),
    }).catch(() => null);
    if (!res) {
      setMsg("network error");
      return;
    }
    if (res.ok) {
      setMsg("ok");
      return;
    }
    if (res.status === 409) setMsg("insufficient funds");
    else if (res.status === 429) setMsg("daily limit reached");
    else if (res.status === 403) setMsg("account blocked");
    else if (res.status === 400) setMsg("invalid request");
    else setMsg("unable to process");
  }

  return (
    <section className="max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">transfer</h1>
      <div className="flex gap-2">
        <button
          onClick={() => setTab("internal")}
          className={`rounded px-3 py-1.5 border ${tab === "internal" ? "bg-black text-white" : "bg-white"}`}
        >
          internal
        </button>
        <button
          onClick={() => setTab("p2p")}
          className={`rounded px-3 py-1.5 border ${tab === "p2p" ? "bg-black text-white" : "bg-white"}`}
        >
          p2p
        </button>
      </div>
      {msg && <div className="rounded-md border p-2 text-sm">{msg}</div>}

      {tab === "internal" ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            post("/api/transfers/internal", {
              fromAccountId: String(f.get("from")),
              toAccountId: String(f.get("to")),
              amountCents: Math.round(Number(f.get("amount")) * 100),
            });
          }}
        >
          <select name="from" className="w-full rounded border px-3 py-2" required>
            <option value="">from account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.displayName} (${(a.balanceCents / 100).toFixed(2)})
              </option>
            ))}
          </select>
          <select name="to" className="w-full rounded border px-3 py-2" required>
            <option value="">to account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.displayName}
              </option>
            ))}
          </select>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="amount (USD)"
            className="w-full rounded border px-3 py-2"
            required
          />
          <button className="w-full rounded bg-black px-4 py-2 text-white">send</button>
        </form>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            post("/api/transfers/p2p", {
              fromAccountId: String(f.get("from")),
              toUsername: String(f.get("toUsername")),
              amountCents: Math.round(Number(f.get("amount")) * 100),
            });
          }}
        >
          <select name="from" className="w-full rounded border px-3 py-2" required>
            <option value="">from account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.displayName} (${(a.balanceCents / 100).toFixed(2)})
              </option>
            ))}
          </select>
          <input
            name="toUsername"
            placeholder="recipient username"
            className="w-full rounded border px-3 py-2"
            required
          />
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="amount (USD)"
            className="w-full rounded border px-3 py-2"
            required
          />
          <button className="w-full rounded bg-black px-4 py-2 text-white">send</button>
        </form>
      )}
    </section>
  );
}

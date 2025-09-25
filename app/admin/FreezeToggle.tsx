"use client";

import { useState, useTransition } from "react";

type FreezeToggleProps = {
  accountId: string;
  initialFrozen: boolean;
};

export function FreezeToggle({ accountId, initialFrozen }: FreezeToggleProps) {
  const [isFrozen, setIsFrozen] = useState(initialFrozen);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    setError(null);
    const next = !isFrozen;
    startTransition(async () => {
      const response = await fetch("/api/admin/accounts/freeze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ accountId, isFrozen: next }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "unable to update");
        return;
      }

      setIsFrozen(next);
    });
  };

  return (
    <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:justify-end">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "saving..." : isFrozen ? "unfreeze" : "freeze"}
      </button>
      <div className="text-xs text-gray-500">frozen: {String(isFrozen)}</div>
      {error ? <div className="text-xs text-red-600">{error}</div> : null}
    </div>
  );
}

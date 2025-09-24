import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createPostedJE,
  getAccountBalanceCents,
  getTodayOutgoingCents,
  canDebit,
} from "@/lib/services/ledger";

export const runtime = "nodejs";

const Schema = z.object({
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  amountCents: z.number().int().positive().max(10_000_000_00), // <= $10M
  description: z.string().max(200).optional(),
  initiatedByUserId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const idem = req.headers.get("idempotency-key")?.trim();
    if (!idem || idem.length < 8 || idem.length > 200) {
      return NextResponse.json({ error: "invalid request" }, { status: 400 });
    }
    const body = await req.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "invalid request" }, { status: 400 });

    const { fromAccountId, toAccountId, amountCents, description, initiatedByUserId } = parsed.data;
    if (fromAccountId === toAccountId)
      return NextResponse.json({ error: "invalid request" }, { status: 400 });

    const [from, to] = await Promise.all([
      prisma.bankAccount.findUnique({ where: { id: fromAccountId } }),
      prisma.bankAccount.findUnique({ where: { id: toAccountId } }),
    ]);
    if (!from || !to) return NextResponse.json({ error: "invalid request" }, { status: 400 });
    if (from.isFrozen || to.isFrozen)
      return NextResponse.json({ error: "blocked" }, { status: 403 });

    const balance = await getAccountBalanceCents(from.id);
    if (!canDebit(balance, amountCents))
      return NextResponse.json({ error: "insufficient" }, { status: 409 });

    const todayOut = await getTodayOutgoingCents(from.id, new Date());
    if (todayOut + amountCents > from.dailyLimitCents)
      return NextResponse.json({ error: "limit" }, { status: 429 });

    await createPostedJE({
      idempotencyKey: idem,
      description: description ?? "internal transfer",
      initiatedByUserId,
      lines: [
        { bankAccountId: from.id, amountCents: -amountCents },
        { bankAccountId: to.id, amountCents: amountCents },
      ],
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "unable to process" }, { status: 500 });
  }
}

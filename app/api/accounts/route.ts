import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccountBalanceCents } from "@/lib/services/ledger";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function GET() {
  try {
    const accounts = await prisma.bankAccount.findMany({
      include: { user: { select: { id: true, username: true, fullName: true } } },
      orderBy: { createdAt: "asc" },
    });
    const withBalances = await Promise.all(
      accounts.map(async (a) => ({
        ...a,
        balanceCents: await getAccountBalanceCents(a.id),
      })),
    );
    return NextResponse.json({ accounts: withBalances });
  } catch {
    return NextResponse.json({ error: "unable to process" }, { status: 500 });
  }
}

const CreateSchema = z.object({
  userId: z.string().min(1),
  type: z.enum(["CHECKING", "SAVINGS"]),
  displayName: z.string().min(1).max(60),
});

export async function POST(req: Request) {
  try {
    const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0]?.trim() ?? "unknown";
    try {
      rateLimit({ key: `accounts:${ip}`, limit: 30, windowMs: 60_000 });
    } catch {
      return NextResponse.json({ error: "ratelimited" }, { status: 429 });
    }

    const idem = req.headers.get("idempotency-key")?.trim();
    if (!idem || idem.length < 8 || idem.length > 200) {
      return NextResponse.json({ error: "invalid request" }, { status: 400 });
    }
    const body = await req.json().catch(() => null);
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "invalid request" }, { status: 400 });

    // Idempotency via JournalEntry not applicable here — use AuditLog to mark completion
    const existingLog = await prisma.auditLog.findUnique({ where: { idempotencyKey: idem } });
    if (existingLog) return NextResponse.json({ ok: true });

    const acct = await prisma.bankAccount.create({
      data: {
        userId: parsed.data.userId,
        type: parsed.data.type,
        displayName: parsed.data.displayName,
        accountNumber: Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join(""),
        routingNumber: Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join(""),
      },
    });

    await prisma.auditLog.create({
      data: { userId: parsed.data.userId, action: "ACCOUNT_CREATE", idempotencyKey: idem },
    });
    return NextResponse.json({ ok: true, accountId: acct.id });
  } catch {
    return NextResponse.json({ error: "unable to process" }, { status: 500 });
  }
}

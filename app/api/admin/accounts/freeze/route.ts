import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/ratelimit";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const BodySchema = z.object({
  accountId: z.string().min(1),
  isFrozen: z.boolean(),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const me = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (me?.role !== "ADMIN") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0]?.trim() ?? "unknown";
    try {
      rateLimit({ key: `admin:${ip}:freeze`, limit: 20, windowMs: 60_000 });
    } catch {
      return NextResponse.json({ error: "ratelimited" }, { status: 429 });
    }

    const idempotencyKey = req.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 200) {
      return NextResponse.json({ error: "invalid request" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid request" }, { status: 400 });
    }

    const { accountId, isFrozen } = parsed.data;

    const existing = await prisma.auditLog.findUnique({ where: { idempotencyKey } });
    if (existing) {
      return NextResponse.json({ ok: true });
    }

    const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
    if (!account) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const updated = await prisma.bankAccount.update({
      where: { id: account.id },
      data: { isFrozen },
    });

    await prisma.auditLog.create({
      data: {
        userId: me.id,
        action: isFrozen ? "ADMIN_FREEZE" : "ADMIN_UNFREEZE",
        idempotencyKey,
        ip,
        metadata: { accountId: updated.id, isFrozen: updated.isFrozen },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("/api/admin/accounts/freeze error", error);
    return NextResponse.json({ error: "unable to process" }, { status: 500 });
  }
}

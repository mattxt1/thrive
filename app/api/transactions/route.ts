import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

function parseDate(s: string | null): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}

type TransactionType = "credit" | "debit";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const me = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const accountIdParam = searchParams.get("accountId") ?? undefined;
    const from = parseDate(searchParams.get("from"));
    const to = parseDate(searchParams.get("to"));
    const type = searchParams.get("type") as TransactionType | null;
    const q = searchParams.get("q") ?? undefined;

    // Fetch account ids the user is allowed to see
    const myAccounts = await prisma.bankAccount.findMany({
      where: { userId: me.id },
      select: { id: true },
    });
    const myAccountIds = myAccounts.map((a) => a.id);
    const myIdSet = new Set(myAccountIds);

    // If no accountId is provided and the user has no accounts, return empty set early
    if (!accountIdParam && myAccountIds.length === 0) {
      return NextResponse.json({ items: [] });
    }

    // If accountId provided, enforce ownership
    if (accountIdParam && !myIdSet.has(accountIdParam)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // Base where: limit to user's accounts (and optionally the one provided)
    const where: Prisma.LedgerLineWhereInput = accountIdParam
      ? { bankAccountId: accountIdParam }
      : { bankAccountId: { in: myAccountIds } };

    if (type === "credit") {
      where.amountCents = { gt: 0 };
    } else if (type === "debit") {
      where.amountCents = { lt: 0 };
    }

    const journalFilter: Prisma.JournalEntryWhereInput = {};
    const createdAtFilter: Prisma.DateTimeFilter = {};
    if (from) createdAtFilter.gte = from;
    if (to) createdAtFilter.lte = to;
    if (Object.keys(createdAtFilter).length > 0) {
      journalFilter.createdAt = createdAtFilter;
    }
    if (Object.keys(journalFilter).length > 0) {
      where.journalEntry = { is: journalFilter };
    }

    if (q) {
      where.OR = [
        { memo: { contains: q, mode: "insensitive" } },
        { journalEntry: { is: { description: { contains: q, mode: "insensitive" } } } },
      ];
    }

    const items = await prisma.ledgerLine.findMany({
      where,
      include: {
        journalEntry: true,
        bankAccount: { select: { id: true, displayName: true } },
      },
      orderBy: [{ journalEntry: { createdAt: "desc" } }, { id: "desc" }],
      take: 500,
    });

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: "unable to process" }, { status: 500 });
  }
}

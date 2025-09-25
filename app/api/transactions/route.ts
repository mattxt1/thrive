import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TransactionType = "credit" | "debit";

function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? undefined : dt;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId") ?? undefined;
    const from = parseDate(searchParams.get("from"));
    const to = parseDate(searchParams.get("to"));
    const type = searchParams.get("type") as TransactionType | null;
    const q = searchParams.get("q") ?? undefined;

    const where: Prisma.LedgerLineWhereInput = {};

    if (accountId) {
      where.bankAccountId = accountId;
    }

    if (type === "credit") {
      where.amountCents = { gt: 0 };
    } else if (type === "debit") {
      where.amountCents = { lt: 0 };
    }

    const journalFilter: Prisma.JournalEntryWhereInput = {};
    const createdAtFilter: Prisma.DateTimeFilter = {};
    if (from) {
      createdAtFilter.gte = from;
    }
    if (to) {
      createdAtFilter.lte = to;
    }
    if (Object.keys(createdAtFilter).length > 0) {
      journalFilter.createdAt = createdAtFilter;
    }

    if (Object.keys(journalFilter).length > 0) {
      where.journalEntry = { is: journalFilter };
    }

    if (q) {
      where.OR = [
        { memo: { contains: q, mode: "insensitive" } },
        {
          journalEntry: {
            is: {
              description: { contains: q, mode: "insensitive" },
            },
          },
        },
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
  } catch (error) {
    console.error("/api/transactions error", error);
    return NextResponse.json({ error: "unable to process" }, { status: 500 });
  }
}

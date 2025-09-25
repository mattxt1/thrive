import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? undefined : dt;
}

function csvEscape(value: unknown): string {
  const text = value == null ? "" : String(value);
  const escaped = text.replace(/"/g, '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");
    if (!accountId) {
      return new NextResponse("accountId required", { status: 400 });
    }

    const from = parseDate(searchParams.get("from"));
    const to = parseDate(searchParams.get("to"));

    const where: Prisma.LedgerLineWhereInput = {
      bankAccountId: accountId,
    };

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

    const rows = await prisma.ledgerLine.findMany({
      where,
      include: { journalEntry: true },
      orderBy: [{ journalEntry: { createdAt: "asc" } }, { id: "asc" }],
      take: 5_000,
    });

    const header = [
      "createdAt",
      "postedAt",
      "accountId",
      "amountCents",
      "currency",
      "memo",
      "description",
      "journalEntryId",
    ];

    const lines = [header.join(",")];
    for (const row of rows) {
      lines.push(
        [
          row.journalEntry?.createdAt?.toISOString() ?? "",
          row.journalEntry?.postedAt?.toISOString() ?? "",
          row.bankAccountId,
          row.amountCents,
          row.currency,
          row.memo,
          row.journalEntry?.description,
          row.journalEntryId,
        ]
          .map(csvEscape)
          .join(","),
      );
    }

    return new NextResponse(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="transactions_${accountId}.csv"`,
      },
    });
  } catch (error) {
    console.error("/api/transactions/export error", error);
    return new NextResponse("unable to process", { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

function parseDate(s: string | null): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  const needsQuotes = /[",\n]/.test(s);
  const t = s.replace(/"/g, '""');
  return needsQuotes ? `"${t}"` : t;
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return new NextResponse("forbidden", { status: 403 });

    const me = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!me) return new NextResponse("forbidden", { status: 403 });

    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");
    if (!accountId) return new NextResponse("accountId required", { status: 400 });

    // Ownership check
    const acct = await prisma.bankAccount.findUnique({ where: { id: accountId } });
    if (!acct || acct.userId !== me.id) return new NextResponse("forbidden", { status: 403 });

    const from = parseDate(searchParams.get("from"));
    const to = parseDate(searchParams.get("to"));

    const where: Prisma.LedgerLineWhereInput = { bankAccountId: accountId };
    if (from || to) {
      const createdAtFilter: Prisma.DateTimeFilter = {};
      if (from) createdAtFilter.gte = from;
      if (to) createdAtFilter.lte = to;
      where.journalEntry = { is: { createdAt: createdAtFilter } };
    }

    const rows = await prisma.ledgerLine.findMany({
      where,
      include: { journalEntry: true },
      orderBy: [{ journalEntry: { createdAt: "asc" } }, { id: "asc" }],
      take: 5000,
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
    for (const r of rows) {
      lines.push(
        [
          r.journalEntry?.createdAt?.toISOString() ?? "",
          r.journalEntry?.postedAt?.toISOString() ?? "",
          r.bankAccountId,
          r.amountCents,
          r.currency,
          r.memo ?? "",
          r.journalEntry?.description ?? "",
          r.journalEntryId,
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
  } catch {
    return new NextResponse("unable to process", { status: 500 });
  }
}

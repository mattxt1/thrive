import { prisma } from "@/lib/prisma";

/** PURE HELPERS (testable without DB) **/

export type Money = { amountCents: number; currency: "USD" };
export function assertBalanced(pairs: Money[]): void {
  const sum = pairs.reduce((acc, m) => acc + m.amountCents, 0);
  if (sum !== 0) throw new Error("unbalanced");
}
export function canDebit(balanceCents: number, debitCents: number): boolean {
  return balanceCents - debitCents >= 0;
}

/** DB HELPERS **/

export async function getAccountBalanceCents(bankAccountId: string): Promise<number> {
  // Balance = sum(posted lines). We consider postedAt on JournalEntry as "posted"
  const posted = await prisma.ledgerLine.aggregate({
    _sum: { amountCents: true },
    where: { bankAccountId, journalEntry: { postedAt: { not: null } } },
  });
  return posted._sum.amountCents ?? 0;
}

export async function getTodayOutgoingCents(bankAccountId: string, date: Date): Promise<number> {
  // Sum of negative (debit/outgoing) amounts for "today" by createdAt
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  const rows = await prisma.ledgerLine.findMany({
    where: {
      bankAccountId,
      amountCents: { lt: 0 },
      journalEntry: { createdAt: { gte: start, lte: end } },
    },
    select: { amountCents: true },
  });
  return Math.abs(rows.reduce((acc, r) => acc + r.amountCents, 0)); // positive number
}

export async function createPostedJE(params: {
  description?: string;
  idempotencyKey: string;
  lines: { bankAccountId: string; amountCents: number; currency?: "USD"; memo?: string }[];
  initiatedByUserId?: string;
}) {
  // Ensure balanced
  const totals = params.lines.reduce((acc, l) => acc + l.amountCents, 0);
  if (totals !== 0) throw new Error("unbalanced");

  return prisma.$transaction(async (tx) => {
    // Idempotency: if JE with same key exists, return it
    const existing = await tx.journalEntry.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
    });
    if (existing) return existing;

    const je = await tx.journalEntry.create({
      data: {
        description: params.description,
        idempotencyKey: params.idempotencyKey,
        initiatedByUserId: params.initiatedByUserId,
        postedAt: new Date(), // post immediately for now
        lines: {
          create: params.lines.map((l) => ({
            bankAccountId: l.bankAccountId,
            amountCents: l.amountCents,
            currency: l.currency ?? "USD",
            memo: l.memo,
          })),
        },
      },
    });
    return je;
  });
}

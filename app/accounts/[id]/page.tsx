import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export default async function AccountPage({ params }: { params: { id: string } }) {
  const acct = await prisma.bankAccount.findUnique({ where: { id: params.id } });
  if (!acct) return notFound();

  const lines = await prisma.ledgerLine.findMany({
    where: { bankAccountId: acct.id },
    include: { journalEntry: true },
    orderBy: [{ journalEntry: { createdAt: "desc" } }, { id: "desc" }],
    take: 50,
  });

  const balance = await prisma.ledgerLine.aggregate({
    _sum: { amountCents: true },
    where: { bankAccountId: acct.id, journalEntry: { postedAt: { not: null } } },
  });

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="text-sm text-gray-500">account</div>
        <div className="text-lg font-medium">
          {acct.displayName} · {acct.type.toLowerCase()}
        </div>
        <div className="text-sm text-gray-500">
          balance ${((balance._sum.amountCents ?? 0) / 100).toFixed(2)}
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-3 text-sm text-gray-500">recent transactions</div>
        <ul className="divide-y">
          {lines.map((l) => (
            <li key={l.id} className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{l.journalEntry?.description ?? "entry"}</div>
                <div className="text-xs text-gray-500">
                  {l.journalEntry?.createdAt.toISOString()}
                </div>
              </div>
              <div className={`font-mono ${l.amountCents < 0 ? "text-red-600" : "text-green-700"}`}>
                {(l.amountCents / 100).toFixed(2)}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

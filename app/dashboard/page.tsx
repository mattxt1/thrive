import type { Session } from "next-auth";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type AppSession = Session & {
  user?: Session["user"] & { id?: string | null; role?: "USER" | "ADMIN" };
};

export default async function Dashboard() {
  const session = (await getServerSession(authOptions)) as AppSession | null;
  const email = session?.user?.email ?? null;
  if (!email) redirect("/auth/signin");

  const user = await prisma.user.findUnique({
    where: { email },
    include: { accounts: true },
  });

  const first = (user?.fullName ?? "").split(" ")[0] || "friend";
  const acct = user?.accounts?.[0];

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">welcome, {first}</h1>
      {acct && (
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">default account</div>
          <div className="text-lg font-medium">{acct.displayName}</div>
          <div className="text-sm text-gray-500">•••• {acct.accountNumber.slice(-4)}</div>
        </div>
      )}
    </section>
  );
}

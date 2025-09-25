import { FreezeToggle } from "./FreezeToggle";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/auth/signin");
  }

  const me = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (me?.role !== "ADMIN") {
    redirect("/");
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { accounts: true },
    take: 200,
  });

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">admin</h1>
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-3 text-sm text-gray-500">users</div>
        <ul className="divide-y">
          {users.map((user) => (
            <li key={user.id} className="py-4">
              <div className="font-medium">
                {user.fullName} <span className="text-gray-500">(@{user.username})</span>
              </div>
              <div className="text-xs text-gray-500">
                {user.email} · role {user.role.toLowerCase()}
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {user.accounts.map((account) => (
                  <div key={account.id} className="flex flex-col gap-2 rounded border p-3">
                    <div>
                      <div className="font-medium">{account.displayName}</div>
                      <div className="text-xs text-gray-500">type {account.type.toLowerCase()}</div>
                    </div>
                    <FreezeToggle accountId={account.id} initialFrozen={account.isFrozen} />
                  </div>
                ))}
                {user.accounts.length === 0 ? (
                  <div className="rounded border p-3 text-sm text-gray-500">no accounts</div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

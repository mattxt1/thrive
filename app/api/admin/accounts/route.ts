import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const me = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (me?.role !== "ADMIN") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: { accounts: true },
      take: 200,
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("/api/admin/accounts error", error);
    return NextResponse.json({ error: "unable to process" }, { status: 500 });
  }
}

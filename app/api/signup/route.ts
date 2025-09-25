import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

const SignupSchema = z.object({
  email: z.string().email(),
  username: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-z0-9_]+$/),
  fullName: z.string().min(1).max(100),
  password: z.string().min(8).max(100),
});

function genAccountNumber(): string {
  let s = "";
  for (let i = 0; i < 16; i++) s += Math.floor(Math.random() * 10);
  return s;
}
function genRouting(): string {
  let s = "";
  for (let i = 0; i < 9; i++) s += Math.floor(Math.random() * 10);
  return s;
}

export async function POST(req: Request) {
  try {
    const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0]?.trim() ?? "unknown";
    try {
      rateLimit({ key: `signup:${ip}`, limit: 10, windowMs: 60_000 });
    } catch {
      return NextResponse.json({ error: "ratelimited" }, { status: 429 });
    }

    const idem = req.headers.get("idempotency-key")?.trim();
    if (!idem || idem.length < 8 || idem.length > 200) {
      return NextResponse.json({ error: "invalid request" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = SignupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid request" }, { status: 400 });
    }
    const { email, username, fullName, password } = parsed.data;

    const existingIdem = await prisma.auditLog.findUnique({ where: { idempotencyKey: idem } });
    if (existingIdem) return NextResponse.json({ ok: true });

    const [emailExists, userExists] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.user.findUnique({ where: { username } }),
    ]);
    if (emailExists || userExists) {
      return NextResponse.json({ error: "conflict" }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        fullName,
        hashedPassword,
        accounts: {
          create: {
            type: "CHECKING",
            displayName: "primary checking",
            accountNumber: genAccountNumber(),
            routingNumber: genRouting(),
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: { userId: user.id, action: "SIGNUP", idempotencyKey: idem },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "unable to process" }, { status: 500 });
  }
}

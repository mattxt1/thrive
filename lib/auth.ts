import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { Adapter } from "next-auth/adapters";

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function isRole(role: unknown): role is "USER" | "ADMIN" {
  return role === "USER" || role === "ADMIN";
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  adapter: PrismaAdapter(prisma) as Adapter,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "email", type: "email" },
        password: { label: "password", type: "password" },
      },
      async authorize(raw) {
        const parsed = CredentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;
        const ok = await bcrypt.compare(password, user.hashedPassword);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.fullName, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user && isRole((user as { role?: unknown }).role)) {
        token.role = (user as { role?: "USER" | "ADMIN" }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? undefined;
        if (isRole(token.role)) {
          session.user.role = token.role;
        }
      }
      return session;
    },
  },
  events: {
    async signIn({ user, account, isNewUser }) {
      try {
        await prisma.auditLog.create({
          data: {
            userId: typeof user.id === "string" ? user.id : undefined,
            action: "SIGNIN",
            metadata: {
              provider: account?.provider ?? "credentials",
              isNewUser: Boolean(isNewUser),
            },
          },
        });
      } catch (error) {
        console.error("failed to record sign-in audit log", error);
      }
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

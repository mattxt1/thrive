import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role?: "USER" | "ADMIN";
  }

  interface Session extends DefaultSession {
    user?: DefaultSession["user"] & {
      id?: string;
      role?: "USER" | "ADMIN";
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "USER" | "ADMIN";
  }
}

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Deterministic fixtures
const PASSWORD = "passw0rd!"; // demo only
const HASH = bcrypt.hashSync(PASSWORD, 12);

// Expected balances (USD cents) after seed
const EXPECT = {
  alice: { checking: 150_000, savings: 250_000 }, // $1,500.00, $2,500.00
  bob: { checking: 80_000 }, // $800.00
};

// One global reserve account to balance seed deposits (will be negative)
const RESERVE_USERNAME = "veritas_reserve";

async function ensureUsersAndAccounts() {
  // Optionally wipe data if RESET=true
  if (process.env.RESET === "true") {
    console.log("RESET=true -> purging tables…");
    await prisma.$transaction([
      prisma.ledgerLine.deleteMany({}),
      prisma.journalEntry.deleteMany({}),
      prisma.bankAccount.deleteMany({}),
      prisma.user.deleteMany({}),
    ]);
  }

  // Upsert users (admin gets ADMIN role)
  const [, reserve, alice, bob] = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@veritas.bank" },
      update: {},
      create: {
        email: "admin@veritas.bank",
        username: "admin",
        fullName: "veritas admin",
        hashedPassword: HASH,
        role: "ADMIN",
      },
    }),
    prisma.user.upsert({
      where: { email: "reserve@veritas.bank" },
      update: {},
      create: {
        email: "reserve@veritas.bank",
        username: RESERVE_USERNAME,
        fullName: "veritas reserve",
        hashedPassword: HASH,
        role: "ADMIN",
      },
    }),
    prisma.user.upsert({
      where: { email: "alice@veritas.bank" },
      update: {},
      create: {
        email: "alice@veritas.bank",
        username: "alice",
        fullName: "alice carter",
        hashedPassword: HASH,
        role: "USER",
      },
    }),
    prisma.user.upsert({
      where: { email: "bob@veritas.bank" },
      update: {},
      create: {
        email: "bob@veritas.bank",
        username: "bob",
        fullName: "bob nguyen",
        hashedPassword: HASH,
        role: "USER",
      },
    }),
  ]);

  // Create accounts if not present
  const [reserveAcct] = await Promise.all([
    prisma.bankAccount.upsert({
      where: { accountNumber: "9999999999999999" },
      update: {},
      create: {
        userId: reserve.id,
        type: "CHECKING",
        displayName: "veritas reserve",
        accountNumber: "9999999999999999",
        routingNumber: "000000001",
      },
    }),
  ]);

  const aliceChecking =
    (await prisma.bankAccount.findFirst({ where: { userId: alice.id, type: "CHECKING" } })) ??
    (await prisma.bankAccount.create({
      data: {
        userId: alice.id,
        type: "CHECKING",
        displayName: "primary checking",
        accountNumber: "1111222233334444",
        routingNumber: "021000021",
      },
    }));

  const aliceSavings =
    (await prisma.bankAccount.findFirst({ where: { userId: alice.id, type: "SAVINGS" } })) ??
    (await prisma.bankAccount.create({
      data: {
        userId: alice.id,
        type: "SAVINGS",
        displayName: "high-yield savings",
        accountNumber: "5555666677778888",
        routingNumber: "021000021",
      },
    }));

  const bobChecking =
    (await prisma.bankAccount.findFirst({ where: { userId: bob.id, type: "CHECKING" } })) ??
    (await prisma.bankAccount.create({
      data: {
        userId: bob.id,
        type: "CHECKING",
        displayName: "everyday checking",
        accountNumber: "4444333322221111",
        routingNumber: "021000021",
      },
    }));

  return { reserveAcct, aliceChecking, aliceSavings, bobChecking };
}

async function seedBalances() {
  const { reserveAcct, aliceChecking, aliceSavings, bobChecking } = await ensureUsersAndAccounts();

  // Helper to create a posted journal entry if not already created
  async function postOnce(
    idem: string,
    description: string,
    lines: { bankAccountId: string; amountCents: number; memo?: string }[],
  ) {
    const found = await prisma.journalEntry.findUnique({ where: { idempotencyKey: idem } });
    if (found) return found;
    const sum = lines.reduce((a, l) => a + l.amountCents, 0);
    if (sum !== 0) throw new Error(`unbalanced seed JE ${idem}: sum=${sum}`);
    return prisma.journalEntry.create({
      data: {
        description,
        idempotencyKey: idem,
        postedAt: new Date(),
        createdAt: new Date("2025-01-01T12:00:00Z"),
        initiatedByUserId: null,
        lines: { create: lines.map((l) => ({ ...l, currency: "USD" })) },
      },
    });
  }

  // Seed deposits (balanced against reserve)
  await postOnce("seed:alice:checking:init", "initial funding (alice checking)", [
    { bankAccountId: reserveAcct.id, amountCents: -EXPECT.alice.checking, memo: "seed out" },
    { bankAccountId: aliceChecking.id, amountCents: EXPECT.alice.checking, memo: "seed in" },
  ]);

  await postOnce("seed:alice:savings:init", "initial funding (alice savings)", [
    { bankAccountId: reserveAcct.id, amountCents: -EXPECT.alice.savings, memo: "seed out" },
    { bankAccountId: aliceSavings.id, amountCents: EXPECT.alice.savings, memo: "seed in" },
  ]);

  await postOnce("seed:bob:checking:init", "initial funding (bob checking)", [
    { bankAccountId: reserveAcct.id, amountCents: -EXPECT.bob.checking, memo: "seed out" },
    { bankAccountId: bobChecking.id, amountCents: EXPECT.bob.checking, memo: "seed in" },
  ]);

  // Example internal transfer for alice ($125 from checking -> savings)
  await postOnce("seed:alice:xfer:1", "internal transfer", [
    { bankAccountId: aliceChecking.id, amountCents: -12_500, memo: "to savings" },
    { bankAccountId: aliceSavings.id, amountCents: 12_500, memo: "from checking" },
  ]);

  // Assertions: compute balances and compare to expected after transfer
  async function balanceFor(accountId: string): Promise<number> {
    const agg = await prisma.ledgerLine.aggregate({
      _sum: { amountCents: true },
      where: { bankAccountId: accountId, journalEntry: { postedAt: { not: null } } },
    });
    return agg._sum.amountCents ?? 0;
  }

  const [aliceChk, aliceSav, bobChk, reserveBal] = await Promise.all([
    balanceFor(aliceChecking.id),
    balanceFor(aliceSavings.id),
    balanceFor(bobChecking.id),
    balanceFor(reserveAcct.id),
  ]);

  const expectedAliceChk = EXPECT.alice.checking - 12_500;
  const expectedAliceSav = EXPECT.alice.savings + 12_500;
  const expectedBobChk = EXPECT.bob.checking;
  const expectedReserve = -(expectedAliceChk + expectedAliceSav + expectedBobChk);

  function assertEq(name: string, got: number, want: number) {
    if (got !== want) throw new Error(`assertion failed: ${name} got=${got} want=${want}`);
  }

  assertEq("alice.checking", aliceChk, expectedAliceChk);
  assertEq("alice.savings", aliceSav, expectedAliceSav);
  assertEq("bob.checking", bobChk, expectedBobChk);
  assertEq("reserve", reserveBal, expectedReserve);

  console.log("✅ seed OK");
  console.table([
    { account: "alice.checking", cents: aliceChk, dollars: (aliceChk / 100).toFixed(2) },
    { account: "alice.savings", cents: aliceSav, dollars: (aliceSav / 100).toFixed(2) },
    { account: "bob.checking", cents: bobChk, dollars: (bobChk / 100).toFixed(2) },
    { account: "reserve", cents: reserveBal, dollars: (reserveBal / 100).toFixed(2) },
  ]);

  // Create minimal AuditLog entries (optional)
  await prisma.auditLog.upsert({
    where: { idempotencyKey: "seed:audit:complete" },
    update: {},
    create: { action: "SEED_COMPLETE", idempotencyKey: "seed:audit:complete" },
  });
}

seedBalances()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ seed failed", e?.message ?? e);
    await prisma.$disconnect();
    process.exit(1);
  });

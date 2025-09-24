import { assertBalanced, canDebit } from "@/lib/services/ledger";
import { describe, it, expect } from "vitest";

describe("ledger pure helpers", () => {
  it("assertBalanced passes when lines sum to zero", () => {
    expect(() =>
      assertBalanced([
        { amountCents: 100, currency: "USD" },
        { amountCents: -100, currency: "USD" },
      ]),
    ).not.toThrow();
  });
  it("assertBalanced throws when unbalanced", () => {
    expect(() => assertBalanced([{ amountCents: 100, currency: "USD" }])).toThrow();
  });
  it("canDebit checks overdraft", () => {
    expect(canDebit(5000, 3000)).toBe(true);
    expect(canDebit(5000, 6000)).toBe(false);
  });
});

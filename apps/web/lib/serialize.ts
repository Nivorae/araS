import type { Prisma } from "@prisma/client";

/** Convert a Prisma Decimal to a plain JS number */
export function d(v: Prisma.Decimal): number {
  return v.toNumber();
}

/** Convert a nullable Prisma Decimal to a plain JS number or null */
export function dn(v: Prisma.Decimal | null | undefined): number | null {
  if (v == null) return null;
  return v.toNumber();
}

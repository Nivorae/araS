-- signedDate of the last applied App Store notification, so out-of-order
-- deliveries can't overwrite newer state. Nullable: existing rows accept the
-- next notification whatever its date.
ALTER TABLE "Subscription" ADD COLUMN "lastSignedAt" TIMESTAMP(3);

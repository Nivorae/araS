-- Backfill pricePerShare for existing EntryHistory rows from delta/units.
-- Only rows with a known positive share count can be derived; rows with no
-- units (non-investment entries) or units = 0 are left NULL.
UPDATE "EntryHistory"
SET "pricePerShare" = "delta" / "units"
WHERE "units" IS NOT NULL AND "units" > 0 AND "pricePerShare" IS NULL;

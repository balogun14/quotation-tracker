-- Older clients submitted an omitted expiry date as JSON null. Zod coerced that
-- to the Unix epoch, which made affected quotes and their public links expire
-- immediately. Restore the configured workspace default from the send time.
UPDATE `quotes`
SET `expiry_date` = COALESCE(`sent_at`, `created_at`) + (
  SELECT `default_quote_expiry_days` * 86400000
  FROM `workspaces`
  WHERE `workspaces`.`id` = `quotes`.`workspace_id`
)
WHERE `expiry_date` IS NOT NULL
  AND `expiry_date` < 946684800000;--> statement-breakpoint

UPDATE `public_links`
SET `expires_at` = (
  SELECT `quotes`.`expiry_date`
  FROM `quote_versions`
  INNER JOIN `quotes` ON `quotes`.`id` = `quote_versions`.`quote_id`
  WHERE `quote_versions`.`id` = `public_links`.`quote_version_id`
)
WHERE `expires_at` < 946684800000;

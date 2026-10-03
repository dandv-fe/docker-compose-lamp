-- Apply manually after 007. Counts WhatsApp OPENINGS, never deliveries.
-- Shared by company/person/normalized phone; independent of the primary phone.
ALTER TABLE mobile_customer_phone
  ADD COLUMN IF NOT EXISTS whatsapp_open_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS whatsapp_last_opened_at DATETIME NULL;

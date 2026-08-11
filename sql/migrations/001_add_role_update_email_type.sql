-- Fix: allow role_update emails in email_log
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
ALTER TABLE email_log DROP CONSTRAINT IF EXISTS email_log_email_type_check;
ALTER TABLE email_log ADD CONSTRAINT email_log_email_type_check
  CHECK (email_type IN ('welcome', 'order_confirmation', 'shipping_update', 'delivery_confirmation', 'cancellation', 'password_reset', 'role_update'));

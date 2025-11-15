-- =====================================================
-- FIX: Insurance Admin Notification Trigger
-- =====================================================
-- Creates a trigger to automatically notify admins
-- when insurance lead status changes to ocr_ok
-- =====================================================

BEGIN;

-- Create function to send admin notifications via WhatsApp
CREATE OR REPLACE FUNCTION notify_insurance_admins_on_ocr_complete()
RETURNS TRIGGER AS $$
DECLARE
  admin RECORD;
  message_text text;
  extraction jsonb;
BEGIN
  -- Only process when status changes to ocr_ok
  IF (TG_OP = 'UPDATE' AND NEW.status = 'ocr_ok' AND (OLD.status IS NULL OR OLD.status != 'ocr_ok')) THEN
    
    -- Get extraction data
    extraction := NEW.extracted_json;
    
    -- Build notification message
    message_text := format('🔔 *New Insurance Certificate Submitted*

📋 *Certificate Details:*
• Insurer: %s
• Policy Number: %s  
• Certificate Number: %s
• Registration Plate: %s

📅 *Policy Dates:*
• Inception: %s
• Expiry: %s

🚗 *Vehicle Information:*
• Make: %s
• Model: %s
• VIN: %s

👤 *Customer Contact:*
• WhatsApp: https://wa.me/%s

💬 Click the link above to contact the customer directly',
      COALESCE(extraction->>'insurer_name', '—'),
      COALESCE(extraction->>'policy_number', '—'),
      COALESCE(extraction->>'certificate_number', '—'),
      COALESCE(extraction->>'registration_plate', '—'),
      COALESCE(extraction->>'policy_inception', '—'),
      COALESCE(extraction->>'policy_expiry', '—'),
      COALESCE(extraction->>'make', '—'),
      COALESCE(extraction->>'model', '—'),
      COALESCE(extraction->>'vin_chassis', '—'),
      NEW.whatsapp
    );
    
    -- Insert notifications for all active admins
    FOR admin IN 
      SELECT wa_id, name
      FROM insurance_admins
      WHERE is_active = true
        AND receives_all_alerts = true
      ORDER BY created_at
    LOOP
      -- Insert into notifications table for wa-webhook to process
      INSERT INTO notifications (
        to_wa_id,
        notification_type,
        status,
        payload,
        retry_count
      ) VALUES (
        admin.wa_id,
        'insurance_admin_alert',
        'queued',
        jsonb_build_object(
          'text', message_text,
          'lead_id', NEW.id,
          'user_wa_id', NEW.whatsapp,
          'extracted', extraction
        ),
        0
      );
      
      -- Track in insurance_admin_notifications
      INSERT INTO insurance_admin_notifications (
        lead_id,
        admin_wa_id,
        user_wa_id,
        notification_payload,
        status
      ) VALUES (
        NEW.id,
        admin.wa_id,
        NEW.whatsapp,
        jsonb_build_object(
          'message', message_text,
          'extracted', extraction
        ),
        'queued'
      );
      
      RAISE NOTICE 'Insurance admin notification queued for % (lead: %)', admin.wa_id, NEW.id;
    END LOOP;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS insurance_admin_notification_trigger ON insurance_leads;

-- Create trigger
CREATE TRIGGER insurance_admin_notification_trigger
  AFTER INSERT OR UPDATE OF status ON insurance_leads
  FOR EACH ROW
  WHEN (NEW.status = 'ocr_ok')
  EXECUTE FUNCTION notify_insurance_admins_on_ocr_complete();

COMMIT;

-- Verify trigger is created
SELECT tgname, tgenabled, tgtype 
FROM pg_trigger 
WHERE tgrelid = 'insurance_leads'::regclass
AND tgname LIKE '%admin%';

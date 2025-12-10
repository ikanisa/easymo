-- Update the handle_new_user trigger to auto-promote specific email to admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Check if this is the admin email and set role accordingly
  INSERT INTO public.users (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    CASE 
      WHEN NEW.email = 'info@ikanisa.com' THEN 'SYSTEM_ADMIN'::app_role
      ELSE 'SACCO_STAFF'::app_role
    END
  );
  RETURN NEW;
END;
$function$;

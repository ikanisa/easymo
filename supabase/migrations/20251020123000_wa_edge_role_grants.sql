-- Ensure the scoped WhatsApp service role can execute mobility matching RPCs.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wa_edge_role') THEN
    GRANT EXECUTE ON FUNCTION public.match_drivers_for_trip_v2(
      uuid,
      integer,
      boolean,
      integer,
      integer
    ) TO wa_edge_role;

    GRANT EXECUTE ON FUNCTION public.match_passengers_for_trip_v2(
      uuid,
      integer,
      boolean,
      integer,
      integer
    ) TO wa_edge_role;

    -- Nearby lookups are also used by the mobility flows.
    IF EXISTS (
      SELECT 1 FROM pg_proc
      WHERE proname = 'match_drivers_nearby'
        AND pronamespace = 'public'::regnamespace
    ) THEN
      GRANT EXECUTE ON FUNCTION public.match_drivers_nearby(
        uuid,
        double precision,
        double precision,
        integer,
        double precision,
        integer
      ) TO wa_edge_role;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_proc
      WHERE proname = 'match_passengers_nearby'
        AND pronamespace = 'public'::regnamespace
    ) THEN
      GRANT EXECUTE ON FUNCTION public.match_passengers_nearby(
        uuid,
        double precision,
        double precision,
        integer,
        double precision,
        integer
      ) TO wa_edge_role;
    END IF;
  ELSE
    RAISE NOTICE 'Role wa_edge_role does not exist; skipping mobility grants.';
  END IF;
END
$$;

BEGIN;

ALTER TABLE public.agent_sessions
  DROP CONSTRAINT IF EXISTS agent_sessions_flow_type_check;

ALTER TABLE public.agent_sessions
  ADD CONSTRAINT agent_sessions_flow_type_check
    CHECK (
      flow_type = ANY (
        ARRAY[
          'nearby_drivers',
          'nearby_pharmacies',
          'nearby_quincailleries',
          'nearby_shops',
          'scheduled_trip',
          'recurring_trip',
          'ai_waiter',
          'property_search',
          'property_listing'
        ]
      )
    );

COMMIT;

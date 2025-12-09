/**
 * Reference Token Decoder Edge Function
 *
 * Decodes country-aware reference tokens (COUNTRY3.DISTRICT3.SACCO3.GROUP4.MEMBER3)
 * and resolves them to actual member/group records.
 *
 * Supports both new format (with country) and legacy format (without country).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders } from "../_shared/http.ts";
import { serveWithObservability } from "../_shared/observability.ts";

interface ReferenceToken {
  country?: string;
  district: string;
  sacco: string;
  group: string;
  member: string;
}

interface DecodeResult {
  success: boolean;
  token?: ReferenceToken;
  member?: {
    id: string;
    full_name: string;
    member_code: string;
    ikimina_id: string;
    sacco_id: string;
    country_id?: string;
  };
  group?: {
    id: string;
    name: string;
    code: string;
    sacco_id: string;
  };
  sacco?: {
    id: string;
    name: string;
    district: string;
  };
  error?: string;
}

/**
 * Parse reference token string
 */
function parseToken(token: string): ReferenceToken | null {
  const parts = token.toUpperCase().split(".");

  // New format: COUNTRY3.DISTRICT3.SACCO3.GROUP4.MEMBER3 (5 parts)
  if (parts.length === 5) {
    return {
      country: parts[0],
      district: parts[1],
      sacco: parts[2],
      group: parts[3],
      member: parts[4],
    };
  }

  // Legacy format: DISTRICT3.SACCO3.GROUP4.MEMBER3 (4 parts)
  if (parts.length === 4) {
    return {
      district: parts[0],
      sacco: parts[1],
      group: parts[2],
      member: parts[3],
    };
  }

  return null;
}

/**
 * Main handler
 */
serveWithObservability("reference-decode", async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    // Get token from query params or body
    const url = new URL(req.url);
    let tokenStr = url.searchParams.get("token");

    if (!tokenStr && req.method === "POST") {
      const body = await req.json();
      tokenStr = body.token;
    }

    if (!tokenStr) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Token parameter required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        }
      );
    }

    // Parse token
    const token = parseToken(tokenStr);
    if (!token) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Invalid token format. Expected COUNTRY.DISTRICT.SACCO.GROUP.MEMBER or DISTRICT.SACCO.GROUP.MEMBER",
        }),
        {
          status: 400,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const memberSelect = `
        id,
        full_name,
        member_code,
        ikimina_id,
        sacco_id,
        country_id,
        ikimina:ikimina_id (
          id,
          name,
          code,
          sacco_id
        ),
        saccos:sacco_id (
          id,
          name,
          district
        )
      `;

    const buildMemberQuery = () => supabase.from("members").select(memberSelect);

    let countryId: string | null = null;

    // Filter by country if provided
    if (token.country) {
      const { data: countries } = await supabase
        .from("countries")
        .select("id")
        .eq("iso3", token.country)
        .single();

      if (countries) {
        countryId = countries.id;
      }
    }

    // Try to match member by parsing member code from token
    // Member code might be just the number or include group prefix
    const memberSeq = parseInt(token.member, 10);

    // First try: exact member_code match
    let memberByCodeResponse;

    if (countryId) {
      const memberByCountry = await buildMemberQuery()
        .eq("country_id", countryId)
        .eq("member_code", token.member)
        .maybeSingle();

      if (!memberByCountry.data && !memberByCountry.error) {
        memberByCodeResponse = await buildMemberQuery()
          .is("country_id", null)
          .eq("member_code", token.member)
          .maybeSingle();
      } else {
        memberByCodeResponse = memberByCountry;
      }
    } else {
      memberByCodeResponse = await buildMemberQuery().eq("member_code", token.member).maybeSingle();
    }

    const { data: memberByCode, error: codeError } = memberByCodeResponse;

    if (memberByCode) {
      const result: DecodeResult = {
        success: true,
        token,
        member: {
          id: memberByCode.id,
          full_name: memberByCode.full_name,
          member_code: memberByCode.member_code,
          ikimina_id: memberByCode.ikimina_id,
          sacco_id: memberByCode.sacco_id,
          country_id: memberByCode.country_id,
        },
        group: memberByCode.ikimina
          ? {
              id: memberByCode.ikimina.id,
              name: memberByCode.ikimina.name,
              code: memberByCode.ikimina.code,
              sacco_id: memberByCode.ikimina.sacco_id,
            }
          : undefined,
        sacco: memberByCode.saccos
          ? {
              id: memberByCode.saccos.id,
              name: memberByCode.saccos.name,
              district: memberByCode.saccos.district,
            }
          : undefined,
      };

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    // Second try: find by group code and member sequence
    const buildGroupQuery = () =>
      supabase
        .from("ikimina")
        .select("id, name, code, sacco_id, country_id")
        .ilike("code", `%${token.group}%`)
        .limit(1);

    let groupMatch;

    if (countryId) {
      const { data: groupsByCountry } = await buildGroupQuery().eq("country_id", countryId);

      if (groupsByCountry && groupsByCountry.length > 0) {
        groupMatch = groupsByCountry[0];
      } else {
        const { data: legacyGroups } = await buildGroupQuery().is("country_id", null);

        if (legacyGroups && legacyGroups.length > 0) {
          groupMatch = legacyGroups[0];
        }
      }
    } else {
      const { data: groups } = await buildGroupQuery();

      if (groups && groups.length > 0) {
        groupMatch = groups[0];
      }
    }

    if (groupMatch) {
      const group = groupMatch;

      // Find member in this group
      const buildMembersByGroupQuery = () =>
        supabase
          .from("members")
          .select(
            `
            id,
            full_name,
            member_code,
            ikimina_id,
            sacco_id,
            country_id,
            saccos:sacco_id (
              id,
              name,
              district
            )
          `
          )
          .eq("ikimina_id", group.id)
          .order("created_at", { ascending: true });

      let membersResponse;

      if (group.country_id) {
        membersResponse = await buildMembersByGroupQuery().eq("country_id", group.country_id);

        if (!membersResponse.data || membersResponse.data.length === 0) {
          membersResponse = await buildMembersByGroupQuery().is("country_id", null);
        }
      } else {
        membersResponse = await buildMembersByGroupQuery().is("country_id", null);

        if (!membersResponse.data || membersResponse.data.length === 0) {
          membersResponse = await buildMembersByGroupQuery();
        }
      }

      const members = membersResponse?.data || [];

      if (members && members.length >= memberSeq) {
        const member = members[memberSeq - 1]; // Convert 1-based to 0-based

        const result: DecodeResult = {
          success: true,
          token,
          member: {
            id: member.id,
            full_name: member.full_name,
            member_code: member.member_code || `${token.group}.${token.member}`,
            ikimina_id: member.ikimina_id,
            sacco_id: member.sacco_id,
            country_id: member.country_id,
          },
          group: {
            id: group.id,
            name: group.name,
            code: group.code,
            sacco_id: group.sacco_id,
          },
          sacco: member.saccos
            ? {
                id: member.saccos.id,
                name: member.saccos.name,
                district: member.saccos.district,
              }
            : undefined,
        };

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        });
      }
    }

    // Not found
    return new Response(
      JSON.stringify({
        success: false,
        token,
        error: "Member not found for this reference token",
      }),
      {
        status: 404,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error decoding reference:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      }
    );
  }
});

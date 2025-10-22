import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { leadSchema } from "@/lib/schemas";
import { getAdminApiPath } from "@/lib/routes";

const LEADS_KEY = ["leads"] as const;

const leadListResponseSchema = z.object({
  leads: z.array(leadSchema),
  integration: z
    .object({ status: z.string(), message: z.string().optional() })
    .optional(),
});

const leadUpdateResponseSchema = z.object({
  lead: leadSchema.nullable(),
  integration: z
    .object({ status: z.string(), message: z.string().optional() })
    .optional(),
});

export type LeadListResponse = z.infer<typeof leadListResponseSchema>;

export async function fetchLeads(search?: string) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  const query = params.toString();
  const response = await fetch(`${getAdminApiPath("leads")}${query ? `?${query}` : ""}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Failed to load leads");
  }
  return leadListResponseSchema.parse(await response.json());
}

export function useLeadsQuery(search?: string) {
  return useQuery({
    queryKey: [...LEADS_KEY, search],
    queryFn: () => fetchLeads(search),
  });
}

export type UpdateLeadInput = {
  tenantId: string;
  phone: string;
  name?: string;
  tags?: string[];
  optIn?: boolean;
};

export function useLeadUpdateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateLeadInput) => {
      const response = await fetch(getAdminApiPath("leads"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error("Failed to update lead");
      }
      return leadUpdateResponseSchema.parse(await response.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LEADS_KEY });
    },
  });
}

export const leadsQueryKeys = {
  list: (search?: string) => [...LEADS_KEY, search],
};

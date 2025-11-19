import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const schema = z.object({
  PORT: z.coerce.number().default(4405),
  SUPABASE_URL: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  FARMER_AGENT_PROFILE: z.string().default("farmer_agent"),
  FARMER_SIP_TARGET: z.string().default("sip:farmer-agent@sip.easymo"),
  DEFAULT_SIP_TARGET: z.string().default("sip:agent-core@sip.easymo"),
});

export type VoiceBridgeConfig = z.infer<typeof schema>;

export const config: VoiceBridgeConfig = schema.parse(process.env);

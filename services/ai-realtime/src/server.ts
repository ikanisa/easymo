import "dotenv/config";
import express, { Request, Response } from "express";
import { logger, childLogger } from "@easymo/commons";
import { PERSONAS, PersonaKey } from "./personas.js";
import { RealtimeClient, buildToolsSpec } from "./realtimeClient.js";
import { z } from "zod";

const log = childLogger({ service: "ai-realtime" });

const {
  OPENAI_API_KEY,
  OPENAI_REALTIME_ENDPOINT = "wss://api.openai.com/v1/realtime",
  OPENAI_REALTIME_MODEL = "gpt-4o-realtime-preview",
  PORT = "7070",
  DEFAULT_PERSONA = "waiter"
} = process.env;

if (!OPENAI_API_KEY) {
  log.error("Missing OPENAI_API_KEY");
  process.exit(1);
}

// Validate default persona
const personaKey = (DEFAULT_PERSONA === "cfo" ? "cfo" : "waiter") as PersonaKey;
const persona = PERSONAS[personaKey];

log.info({ persona: personaKey, model: OPENAI_REALTIME_MODEL }, "Initializing AI Realtime service");

// Initialize realtime client
const client = new RealtimeClient({
  url: OPENAI_REALTIME_ENDPOINT,
  apiKey: OPENAI_API_KEY,
  model: OPENAI_REALTIME_MODEL,
  system: persona.system,
  tools: buildToolsSpec(persona.tools),
  logger: log
});

// Connect to OpenAI Realtime
await client.connect();

// Create Express app
const app = express();
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    log.info({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration
    }, "HTTP request");
  });
  next();
});

// Validation schemas
const saySchema = z.object({
  text: z.string().min(1).max(5000)
});

const personaSchema = z.object({
  key: z.enum(["waiter", "cfo"])
});

// POST /ai/say - Send text to the AI
app.post("/ai/say", async (req: Request, res: Response) => {
  try {
    const parsed = saySchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ error: "text required (1-5000 chars)" });
    }

    const { text } = parsed.data;
    
    await client.say(text);
    
    res.json({ ok: true });
  } catch (err) {
    log.error({ err: (err as Error).message }, "Error in /ai/say");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /ai/persona - Switch active persona
app.post("/ai/persona", (req: Request, res: Response) => {
  try {
    const parsed = personaSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ error: "key must be 'waiter' or 'cfo'" });
    }

    const { key } = parsed.data;
    const p = PERSONAS[key];
    
    if (!p) {
      return res.status(400).json({ error: "unknown persona" });
    }

    client.switchPersona(key, p.system, buildToolsSpec(p.tools));
    
    log.info({ persona: key }, "Persona switched");
    
    res.json({ ok: true, active: key });
  } catch (err) {
    log.error({ err: (err as Error).message }, "Error in /ai/persona");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /healthz - Health check
app.get("/healthz", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    persona: client.getActivePersona(),
    service: "ai-realtime"
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  log.info("SIGTERM received, shutting down gracefully");
  client.disconnect();
  process.exit(0);
});

process.on("SIGINT", () => {
  log.info("SIGINT received, shutting down gracefully");
  client.disconnect();
  process.exit(0);
});

// Start server
const port = Number(PORT);
app.listen(port, () => {
  log.info({ port, persona: personaKey }, "AI Realtime service listening");
});

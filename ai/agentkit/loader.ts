/**
 * AgentKit configuration loader
 * Loads and validates graph, connectors, and evals configs
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AgentConfig {
  id: string;
  type: "realtime" | "responses";
  description: string;
  tools: string[];
  entry?: boolean;
  model: string;
}

export interface RouteConfig {
  from: string;
  to: string;
  when: string;
  description: string;
}

export interface GraphConfig {
  agents: AgentConfig[];
  routes: RouteConfig[];
  metadata: Record<string, any>;
}

export interface ConnectorConfig {
  type: string;
  [key: string]: any;
}

export interface ConnectorsConfig {
  connectors: Record<string, ConnectorConfig>;
  metadata: Record<string, any>;
}

export interface EvaluationConfig {
  id: string;
  name: string;
  description: string;
  dataset: string;
  graders: string[];
  thresholds: Record<string, number>;
}

export interface GraderConfig {
  type: "deterministic" | "llm" | "regex";
  description: string;
  weight: number;
  [key: string]: any;
}

export interface EvalsConfig {
  evaluations: EvaluationConfig[];
  graders: Record<string, GraderConfig>;
  metadata: Record<string, any>;
}

/**
 * Load graph configuration
 */
export function loadGraphConfig(): GraphConfig {
  const configPath = path.join(__dirname, "graph.json");
  const content = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(content) as GraphConfig;
}

/**
 * Load connectors configuration
 */
export function loadConnectorsConfig(): ConnectorsConfig {
  const configPath = path.join(__dirname, "connectors.json");
  const content = fs.readFileSync(configPath, "utf-8");
  const config = JSON.parse(content) as ConnectorsConfig;
  
  // Substitute environment variables
  return JSON.parse(
    JSON.stringify(config).replace(/\$\{(\w+)\}/g, (_, envVar) => {
      return process.env[envVar] || "";
    })
  );
}

/**
 * Load evals configuration
 */
export function loadEvalsConfig(): EvalsConfig {
  const configPath = path.join(__dirname, "evals.json");
  const content = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(content) as EvalsConfig;
}

/**
 * Get agent by ID
 */
export function getAgent(agentId: string): AgentConfig | undefined {
  const graph = loadGraphConfig();
  return graph.agents.find((agent) => agent.id === agentId);
}

/**
 * Get connector by name
 */
export function getConnector(name: string): ConnectorConfig | undefined {
  const connectors = loadConnectorsConfig();
  return connectors.connectors[name];
}

/**
 * Get evaluation by ID
 */
export function getEvaluation(evalId: string): EvaluationConfig | undefined {
  const evals = loadEvalsConfig();
  return evals.evaluations.find((evaluation) => evaluation.id === evalId);
}

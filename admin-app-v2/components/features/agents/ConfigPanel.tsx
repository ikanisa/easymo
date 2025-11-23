"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useState } from "react";

interface AgentConfig {
  name: string;
  model: string;
  temperature: number;
  systemPrompt: string;
}

export function ConfigPanel() {
  const [config, setConfig] = useState<AgentConfig>({
    name: "Support Agent",
    model: "gpt-4",
    temperature: 0.7,
    systemPrompt: "You are a helpful support assistant...",
  });

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900">Configuration</h3>
      <div className="mt-6 space-y-4">
        <Input
          label="Agent Name"
          value={config.name}
          onChange={(e) => setConfig({ ...config, name: e.target.value })}
        />
        <Select
          label="Model"
          value={config.model}
          onChange={(e) => setConfig({ ...config, model: e.target.value })}
          options={[
            { label: "GPT-4", value: "gpt-4" },
            { label: "GPT-3.5 Turbo", value: "gpt-3.5-turbo" },
            { label: "Claude 3 Opus", value: "claude-3-opus" },
          ]}
        />
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900">
            Temperature ({config.temperature})
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={config.temperature}
            onChange={(e) =>
              setConfig({ ...config, temperature: parseFloat(e.target.value) })
            }
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900">
            System Prompt
          </label>
          <textarea
            rows={4}
            className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-primary-500"
            value={config.systemPrompt}
            onChange={(e) =>
              setConfig({ ...config, systemPrompt: e.target.value })
            }
          />
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <Button>Save Configuration</Button>
      </div>
    </Card>
  );
}

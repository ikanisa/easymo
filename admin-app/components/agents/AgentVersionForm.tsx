"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { Field } from "@/components/forms/Field";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription,CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import { getAdminApiRoutePath } from "@/lib/routes";

type FieldKey = "instructions" | "tools" | "memory" | "evaluation" | "form";

type Props = {
  personaId: string;
};

export function AgentVersionForm({ personaId }: Props) {
  const router = useRouter();
  const [instructions, setInstructions] = useState("");
  const [toolsJson, setToolsJson] = useState("[]");
  const [memoryJson, setMemoryJson] = useState("{}");
  const [evaluationJson, setEvaluationJson] = useState("[]");
  const [error, setError] = useState<{ field: FieldKey; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!instructions.trim()) {
      setError({ field: "instructions", message: "Instructions are required" });
      return;
    }

    let tools: unknown;
    let memory: unknown;
    let evaluation: unknown;

    try {
      tools = toolsJson.trim() ? JSON.parse(toolsJson) : [];
    } catch (err) {
      setError({ field: "tools", message: `Tools JSON invalid: ${(err as Error).message}` });
      return;
    }

    try {
      memory = memoryJson.trim() ? JSON.parse(memoryJson) : {};
    } catch (err) {
      setError({ field: "memory", message: `Memory config JSON invalid: ${(err as Error).message}` });
      return;
    }

    try {
      evaluation = evaluationJson.trim() ? JSON.parse(evaluationJson) : [];
    } catch (err) {
      setError({ field: "evaluation", message: `Evaluation plan JSON invalid: ${(err as Error).message}` });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(getAdminApiRoutePath("agentVersions", { agentId: personaId }), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instructions,
          tools,
          memory_config: memory,
          evaluation_plan: evaluation,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError({ field: "form", message: payload?.error ?? "Failed to create version" });
        return;
      }

      setInstructions("");
      setToolsJson("[]");
      setMemoryJson("{}");
      setEvaluationJson("[]");
      router.refresh();
    } catch (err) {
      setError({ field: "form", message: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card asChild>
      <form onSubmit={handleSubmit} className="flex flex-col">
        <CardHeader padding="lg">
          <CardTitle>Publish new version</CardTitle>
          <CardDescription>
            Provide updated instructions and optional tool configuration. Versions are automatically numbered.
          </CardDescription>
        </CardHeader>
        <CardContent className="gap-6" padding="lg">
          <Field
            label="Instructions"
            labelFor="version-instructions"
            required
            helperText="Provide detailed system instructions for the agent persona."
            error={error?.field === "instructions" ? error.message : undefined}
          >
            <Textarea
              id="version-instructions"
              value={instructions}
              onChange={(event) => {
                if (error?.field === "instructions") {
                  setError(null);
                }
                setInstructions(event.target.value);
              }}
              required
              rows={6}
              placeholder="Detailed system instructions for the agent persona."
            />
          </Field>
          <Field
            label="Tools JSON"
            labelFor="version-tools"
            helperText="Array of tool definitions. Leave empty to keep defaults."
            error={error?.field === "tools" ? error.message : undefined}
          >
            <Textarea
              id="version-tools"
              value={toolsJson}
              onChange={(event) => {
                if (error?.field === "tools") {
                  setError(null);
                }
                setToolsJson(event.target.value);
              }}
              rows={3}
              className="font-mono"
            />
          </Field>
          <Field
            label="Memory config JSON"
            labelFor="version-memory"
            helperText="Key-value pairs persisted between runs."
            error={error?.field === "memory" ? error.message : undefined}
          >
            <Textarea
              id="version-memory"
              value={memoryJson}
              onChange={(event) => {
                if (error?.field === "memory") {
                  setError(null);
                }
                setMemoryJson(event.target.value);
              }}
              rows={3}
              className="font-mono"
            />
          </Field>
          <Field
            label="Evaluation plan JSON"
            labelFor="version-evaluation"
            helperText="Optional evaluation steps executed after deployment."
            error={error?.field === "evaluation" ? error.message : undefined}
          >
            <Textarea
              id="version-evaluation"
              value={evaluationJson}
              onChange={(event) => {
                if (error?.field === "evaluation") {
                  setError(null);
                }
                setEvaluationJson(event.target.value);
              }}
              rows={3}
              className="font-mono"
            />
          </Field>
          {error?.field === "form" ? (
            <div className="rounded-xl border border-[color:var(--color-danger)]/40 bg-[color:var(--color-danger)]/5 px-4 py-3">
              <p className="text-body-sm text-[color:var(--color-danger)]">{error.message}</p>
            </div>
          ) : null}
        </CardContent>
        <CardFooter padding="lg">
          <Button type="submit" loading={submitting} variant="primary">
            {submitting ? "Publishing" : "Publish version"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

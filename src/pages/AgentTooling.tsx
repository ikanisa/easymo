import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Loader2 } from "lucide-react";

const ORDER: string[] = ["broker", "support", "sales", "marketing", "mobility"];

type ToolkitRow = Tables<"agent_toolkits">;

type ToolkitFormState = {
  model: string;
  reasoning_effort: string;
  text_verbosity: string;
  web_search_enabled: boolean;
  web_search_allowed_domains: string;
  web_search_user_location: string;
  file_search_enabled: boolean;
  file_vector_store_id: string;
  file_search_max_results: string;
  retrieval_enabled: boolean;
  retrieval_vector_store_id: string;
  retrieval_max_results: string;
  retrieval_rewrite: boolean;
  image_generation_enabled: boolean;
  image_preset: string;
  allowed_tools: string;
  suggestions: string;
  streaming_partial_images: string;
  metadata_system_prompt: string;
  metadata_instructions: string;
};

const deriveMetadataFields = (metadata: ToolkitRow["metadata"]) => {
  const meta = (metadata ?? {}) as Record<string, unknown>;
  const systemPrompt = typeof meta.system_prompt === "string" ? meta.system_prompt : "";
  const instructions = Array.isArray(meta.instructions)
    ? meta.instructions
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim())
    : [];
  return {
    systemPrompt,
    instructionsText: instructions.join("\n"),
  };
};

const toFormState = (toolkit: ToolkitRow): ToolkitFormState => ({
  model: toolkit.model ?? "",
  reasoning_effort: toolkit.reasoning_effort ?? "medium",
  text_verbosity: toolkit.text_verbosity ?? "medium",
  web_search_enabled: toolkit.web_search_enabled ?? false,
  web_search_allowed_domains: (toolkit.web_search_allowed_domains ?? []).join("\n"),
  web_search_user_location: toolkit.web_search_user_location
    ? JSON.stringify(toolkit.web_search_user_location, null, 2)
    : "",
  file_search_enabled: toolkit.file_search_enabled ?? false,
  file_vector_store_id: toolkit.file_vector_store_id ?? "",
  file_search_max_results: toolkit.file_search_max_results?.toString() ?? "",
  retrieval_enabled: toolkit.retrieval_enabled ?? false,
  retrieval_vector_store_id: toolkit.retrieval_vector_store_id ?? "",
  retrieval_max_results: toolkit.retrieval_max_results?.toString() ?? "",
  retrieval_rewrite: toolkit.retrieval_rewrite ?? true,
  image_generation_enabled: toolkit.image_generation_enabled ?? false,
  image_preset: toolkit.image_preset ? JSON.stringify(toolkit.image_preset, null, 2) : "",
  allowed_tools: toolkit.allowed_tools ? JSON.stringify(toolkit.allowed_tools, null, 2) : "",
  suggestions: (toolkit.suggestions ?? []).join("\n"),
  streaming_partial_images: toolkit.streaming_partial_images?.toString() ?? "",
  metadata_system_prompt: deriveMetadataFields(toolkit.metadata).systemPrompt,
  metadata_instructions: deriveMetadataFields(toolkit.metadata).instructionsText,
});

type ToolkitCardProps = {
  toolkit: ToolkitRow;
  onSave: (agentKind: string, patch: Partial<ToolkitRow>) => Promise<void>;
  saving: boolean;
};

function ToolkitCard({ toolkit, onSave, saving }: ToolkitCardProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<ToolkitFormState>(() => toFormState(toolkit));

  const handleInputChange = (key: keyof ToolkitFormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleSwitchChange = (key: keyof ToolkitFormState) => (value: boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      const asNumber = (value: string) => {
        if (!value || value.trim().length === 0) return null;
        const parsed = Number(value);
        if (Number.isNaN(parsed)) {
          throw new Error(`"${value}" is not a number`);
        }
        return parsed;
      };

      const metadataBase = (toolkit.metadata ?? {}) as Record<string, unknown>;
      const metadata: Record<string, unknown> = { ...metadataBase };
      const trimmedSystemPrompt = form.metadata_system_prompt.trim();
      if (trimmedSystemPrompt.length > 0) {
        metadata.system_prompt = trimmedSystemPrompt;
      } else {
        delete metadata.system_prompt;
      }

      const instructionLines = form.metadata_instructions
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      if (instructionLines.length > 0) {
        metadata.instructions = instructionLines;
      } else {
        delete metadata.instructions;
      }

      const patch: Partial<ToolkitRow> = {
        model: form.model.trim() || toolkit.model,
        reasoning_effort: form.reasoning_effort as ToolkitRow["reasoning_effort"],
        text_verbosity: form.text_verbosity as ToolkitRow["text_verbosity"],
        web_search_enabled: form.web_search_enabled,
        web_search_allowed_domains: form.web_search_allowed_domains
          ? form.web_search_allowed_domains
              .split(/\n|,/)
              .map((item) => item.trim())
              .filter(Boolean)
          : null,
        web_search_user_location: form.web_search_user_location
          ? JSON.parse(form.web_search_user_location)
          : null,
        file_search_enabled: form.file_search_enabled,
        file_vector_store_id: form.file_vector_store_id.trim() || null,
        file_search_max_results: asNumber(form.file_search_max_results),
        retrieval_enabled: form.retrieval_enabled,
        retrieval_vector_store_id: form.retrieval_vector_store_id.trim() || null,
        retrieval_max_results: asNumber(form.retrieval_max_results),
        retrieval_rewrite: form.retrieval_rewrite,
        image_generation_enabled: form.image_generation_enabled,
        image_preset: form.image_preset ? JSON.parse(form.image_preset) : null,
        allowed_tools: form.allowed_tools ? JSON.parse(form.allowed_tools) : null,
        suggestions: form.suggestions
          ? form.suggestions
              .split("\n")
              .map((item) => item.trim())
              .filter(Boolean)
          : [],
        streaming_partial_images: asNumber(form.streaming_partial_images),
        metadata,
      };

      await onSave(toolkit.agent_kind, patch);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to parse configuration";
      toast({
        title: "Invalid configuration",
        description: message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card key={toolkit.agent_kind}>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            {toolkit.agent_kind.toUpperCase()}
            <Badge variant="secondary">{toolkit.model}</Badge>
          </CardTitle>
          <CardDescription>
            Configure OpenAI Responses tooling for the {toolkit.agent_kind} persona.
          </CardDescription>
        </div>
        <div className="text-xs text-muted-foreground">
          Updated {new Date(toolkit.updated_at).toLocaleString()}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${toolkit.agent_kind}-model`}>Model</Label>
            <Input
              id={`${toolkit.agent_kind}-model`}
              value={form.model}
              onChange={handleInputChange("model")}
              placeholder="gpt-5"
            />
          </div>
          <div className="space-y-2">
            <Label>Reasoning Effort</Label>
            <Input
              value={form.reasoning_effort}
              onChange={handleInputChange("reasoning_effort")}
              placeholder="medium"
            />
          </div>
          <div className="space-y-2">
            <Label>Verbosity</Label>
            <Input
              value={form.text_verbosity}
              onChange={handleInputChange("text_verbosity")}
              placeholder="medium"
            />
          </div>
          <div className="space-y-2">
            <Label>Streaming partial images (1-3)</Label>
            <Input
              value={form.streaming_partial_images}
              onChange={handleInputChange("streaming_partial_images")}
              placeholder="2"
            />
          </div>
        </div>

        <section className="border rounded-md p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Web Search</p>
              <p className="text-xs text-muted-foreground">Allow the agent to fetch the latest information from the internet.</p>
            </div>
            <Switch
              checked={form.web_search_enabled}
              onCheckedChange={handleSwitchChange("web_search_enabled")}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Allowed domains (newline separated)</Label>
              <Textarea
                value={form.web_search_allowed_domains}
                onChange={handleInputChange("web_search_allowed_domains")}
                placeholder="openai.com\nwho.int"
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>User location JSON</Label>
              <Textarea
                value={form.web_search_user_location}
                onChange={handleInputChange("web_search_user_location")}
                placeholder='{"type":"approximate","country":"RW"}'
                rows={4}
              />
            </div>
          </div>
        </section>

        <section className="border rounded-md p-4 space-y-4">
          <div>
            <p className="font-medium">Prompt Metadata</p>
            <p className="text-xs text-muted-foreground">
              Provide additional system instructions that will be prepended to the base persona prompt.
            </p>
          </div>
          <div className="space-y-2">
            <Label>System prompt override</Label>
            <Textarea
              value={form.metadata_system_prompt}
              onChange={handleInputChange("metadata_system_prompt")}
              placeholder="Add extra persona guidance or compliance notes"
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label>Additional instructions (one per line)</Label>
            <Textarea
              value={form.metadata_instructions}
              onChange={handleInputChange("metadata_instructions")}
              placeholder="Always cite mobility policies\nEscalate urgent safety issues to operations lead"
              rows={4}
            />
          </div>
        </section>

        <section className="border rounded-md p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">File Search</p>
              <p className="text-xs text-muted-foreground">Attach knowledge bases stored in OpenAI vector stores.</p>
            </div>
            <Switch
              checked={form.file_search_enabled}
              onCheckedChange={handleSwitchChange("file_search_enabled")}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Vector store ID</Label>
              <Input
                value={form.file_vector_store_id}
                onChange={handleInputChange("file_vector_store_id")}
                placeholder="vs_abc123"
              />
            </div>
            <div className="space-y-2">
              <Label>Max results</Label>
              <Input
                value={form.file_search_max_results}
                onChange={handleInputChange("file_search_max_results")}
                placeholder="4"
              />
            </div>
          </div>
        </section>

        <section className="border rounded-md p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Retrieval</p>
              <p className="text-xs text-muted-foreground">Perform semantic search before invoking the model.</p>
            </div>
            <Switch
              checked={form.retrieval_enabled}
              onCheckedChange={handleSwitchChange("retrieval_enabled")}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Vector store ID</Label>
              <Input
                value={form.retrieval_vector_store_id}
                onChange={handleInputChange("retrieval_vector_store_id")}
                placeholder="vs_search123"
              />
            </div>
            <div className="space-y-2">
              <Label>Max results</Label>
              <Input
                value={form.retrieval_max_results}
                onChange={handleInputChange("retrieval_max_results")}
                placeholder="5"
              />
            </div>
            <div className="space-y-2">
              <Label>Rewrite query</Label>
              <Switch
                checked={form.retrieval_rewrite}
                onCheckedChange={handleSwitchChange("retrieval_rewrite")}
              />
            </div>
          </div>
        </section>

        <section className="border rounded-md p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Image Generation</p>
              <p className="text-xs text-muted-foreground">Allow the agent to produce images when requested.</p>
            </div>
            <Switch
              checked={form.image_generation_enabled}
              onCheckedChange={handleSwitchChange("image_generation_enabled")}
            />
          </div>
          <div className="space-y-2">
            <Label>Image preset JSON</Label>
            <Textarea
              value={form.image_preset}
              onChange={handleInputChange("image_preset")}
              placeholder='{"size":"1024x1024"}'
              rows={4}
            />
          </div>
        </section>

        <section className="border rounded-md p-4 space-y-4">
          <div>
            <Label>Allowed tools JSON (optional)</Label>
            <Textarea
              value={form.allowed_tools}
              onChange={handleInputChange("allowed_tools")}
              placeholder='[{"type":"web_search"}]'
              rows={4}
            />
          </div>
          <div>
            <Label>Suggestions (one per line)</Label>
            <Textarea
              value={form.suggestions}
              onChange={handleInputChange("suggestions")}
              rows={4}
            />
          </div>
        </section>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving
              </>
            ) : (
              "Save toolkit"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AgentTooling() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["agent-toolkits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_toolkits")
        .select("*")
        .order("agent_kind", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const mutation = useMutation({
    mutationFn: async ({ agentKind, patch }: { agentKind: string; patch: Partial<ToolkitRow> }) => {
      const { error } = await supabase
        .from("agent_toolkits")
        .update(patch)
        .eq("agent_kind", agentKind);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Toolkit saved",
        description: `${variables.agentKind} configuration updated`,
      });
      queryClient.invalidateQueries({ queryKey: ["agent-toolkits"] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to update toolkit";
      toast({
        title: "Update failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  const orderedToolkits = useMemo(() => {
    if (!query.data) return [] as ToolkitRow[];
    return [...query.data].sort((a, b) => {
      const indexA = ORDER.indexOf(a.agent_kind);
      const indexB = ORDER.indexOf(b.agent_kind);
      return indexA - indexB;
    });
  }, [query.data]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Agent Tooling</h1>
          <p className="text-sm text-muted-foreground">
            Manage the OpenAI Responses configuration for each agent persona, including web search, retrieval, and image generation capabilities.
          </p>
        </div>

        {query.isLoading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((idx) => (
              <Skeleton key={idx} className="h-40 w-full" />
            ))}
          </div>
        ) : query.error ? (
          <div className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            Failed to load agent toolkits.
          </div>
        ) : (
          <div className="space-y-6">
            {orderedToolkits.map((toolkit) => (
              <ToolkitCard
                key={toolkit.agent_kind}
                toolkit={toolkit}
                saving={mutation.isPending}
                onSave={(agentKind, patch) => mutation.mutateAsync({ agentKind, patch })}
              />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { Field } from "@/components/forms/Field";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription,CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { getAdminApiRoutePath } from "@/lib/routes";

export function AgentCreator() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [provider, setProvider] = useState<'openai' | 'gemini' | 'multi'>('openai');
  const [model, setModel] = useState('gpt-4o');
  const [error, setError] = useState<{ field: "name" | "form"; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError({ field: "name", message: "Name is required" });
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(getAdminApiRoutePath("agents"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name, 
          slug: slug.trim() || undefined, 
          description,
          provider,
          model
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError({ field: "form", message: payload?.error ?? "Failed to create agent" });
        return;
      }
      setName("");
      setSlug("");
      setDescription("");
      router.refresh();
    } catch (err) {
      setError({ field: "form", message: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card asChild interactive>
      <form onSubmit={handleSubmit} className="flex flex-col">
        <CardHeader padding="lg">
          <CardTitle>Create a new agent persona</CardTitle>
          <CardDescription>
            Define a new AI agent persona with an optional slug and description. Additional configuration can be added after
            creation.
          </CardDescription>
        </CardHeader>
        <CardContent className="gap-6" padding="lg">
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="Name"
              labelFor="agent-name"
              required
              helperText="Appears in the persona directory."
              error={error?.field === "name" ? error.message : undefined}
            >
              <Input
                id="agent-name"
                value={name}
                onChange={(event) => {
                  if (error?.field === "name") {
                    setError(null);
                  }
                  setName(event.target.value);
                }}
                placeholder="Broker Assistant"
                autoComplete="off"
              />
            </Field>
            <Field
              label="Slug"
              labelFor="agent-slug"
              helperText="Optional URL-safe identifier used in API calls."
            >
              <Input
                id="agent-slug"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder="broker-assistant"
                autoComplete="off"
              />
            </Field>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="agent-provider">AI Provider</Label>
              <Select value={provider} onValueChange={(v) => setProvider(v as any)}>
                <SelectTrigger id="agent-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="gemini">Google Gemini</SelectItem>
                  <SelectItem value="multi">Multi-Provider (Fallback)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Primary AI model provider</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-model">Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger id="agent-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {provider === 'openai' ? (
                    <>
                      <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                      <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                      <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                    </>
                  ) : provider === 'gemini' ? (
                    <>
                      <SelectItem value="gemini-2.0-flash-exp">Gemini 2.0 Flash</SelectItem>
                      <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                      <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                    </>
                  ) : (
                    <SelectItem value="auto">Auto-Select</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Specific model to use</p>
            </div>
          </div>
          <Field
            label="Description"
            labelFor="agent-description"
            helperText="Summarize what the persona does for internal collaborators."
          >
            <Textarea
              id="agent-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              placeholder="Handles insurance intake over WhatsApp, triages documents, and prepares back-office packages."
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
            {submitting ? "Creating" : "Create agent"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Copy, ExternalLink, Github, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSearchParams } from "react-router-dom";

const REPO_BASE_URL = "https://github.com/openai/openai-agents-js/blob/main/examples/agent-patterns";

type PatternCategory =
  | "Orchestration"
  | "Guardrails"
  | "Human review"
  | "Streaming"
  | "Evaluation"
  | "Control"
  | "Personalization"
  | "Performance"
  | "Routing";

type AgentPattern = {
  slug: string;
  title: string;
  description: string;
  command: string;
  categories: PatternCategory[];
  complexity: "Beginner" | "Intermediate" | "Advanced";
  highlights: string[];
  sourceFile: string;
};

type ComplexityFilter = "all" | AgentPattern["complexity"];

const PATTERNS: AgentPattern[] = [
  {
    slug: "agents-as-tools",
    title: "Agents as Tools",
    description: "Coordinate specialised translator agents by surfacing them as tools that a controller agent can call into.",
    command: "pnpm examples:agents-as-tools",
    categories: ["Orchestration"],
    complexity: "Beginner",
    highlights: [
      "Demonstrates composing multiple agents into a single workflow",
      "Great starting point for decomposing responsibilities across agents",
    ],
    sourceFile: "agents-as-tools.ts",
  },
  {
    slug: "agents-as-tools-conditional",
    title: "Agents as Tools (Conditional)",
    description: "Extends the tools pattern by enabling agents only when a user opts into their language or capability.",
    command: "pnpm examples:agents-as-tools-conditional",
    categories: ["Orchestration", "Personalization"],
    complexity: "Beginner",
    highlights: [
      "Shows how to gate tool availability based on runtime preferences",
      "Useful when user context should prune the set of accessible agents",
    ],
    sourceFile: "agents-as-tools-conditional.ts",
  },
  {
    slug: "deterministic",
    title: "Deterministic Flow",
    description: "Implements a scripted conversation with validation gates before responding to the user.",
    command: "pnpm examples:deterministic",
    categories: ["Control", "Orchestration"],
    complexity: "Intermediate",
    highlights: [
      "Illustrates enforcing must-run steps before final output",
      "Pairs well with production compliance requirements",
    ],
    sourceFile: "deterministic.ts",
  },
  {
    slug: "forcing-tool-use",
    title: "Forcing Tool Use",
    description: "Requires an agent to call specific tools (like fetch or calculator) before it can answer.",
    command: "pnpm -F agent-patterns start:forcing-tool-use",
    categories: ["Control"],
    complexity: "Intermediate",
    highlights: [
      "Great for enforcing side effects such as data lookups",
      "Ensures responses are grounded in tool output",
    ],
    sourceFile: "forcing-tool-use.ts",
  },
  {
    slug: "human-in-the-loop",
    title: "Human in the Loop",
    description: "Routes decisions through a manual approver before committing tool outputs.",
    command: "pnpm examples:human-in-the-loop",
    categories: ["Human review", "Control"],
    complexity: "Intermediate",
    highlights: [
      "Captures how to pause runs and wait for an operator",
      "Ideal for sensitive actions such as financial or compliance steps",
    ],
    sourceFile: "human-in-the-loop.ts",
  },
  {
    slug: "human-in-the-loop-stream",
    title: "Human in the Loop (Streamed)",
    description: "Streams progress updates while awaiting human approval to keep operators in the loop.",
    command: "pnpm examples:streamed:human-in-the-loop",
    categories: ["Human review", "Streaming"],
    complexity: "Advanced",
    highlights: [
      "Combines manual approval with partial streaming results",
      "Helps supervisors monitor long-running interactions",
    ],
    sourceFile: "human-in-the-loop-stream.ts",
  },
  {
    slug: "input-guardrails",
    title: "Input Guardrails",
    description: "Rejects prompts that violate business rules before they reach the agent logic.",
    command: "pnpm examples:input-guardrails",
    categories: ["Guardrails", "Control"],
    complexity: "Beginner",
    highlights: [
      "Adds a deterministic filter for out-of-scope requests",
      "Provides clear feedback to the end user on blocked content",
    ],
    sourceFile: "input-guardrails.ts",
  },
  {
    slug: "llm-as-a-judge",
    title: "LLM as a Judge",
    description: "Lets a reviewer model score story outlines and request revisions before sign-off.",
    command: "pnpm -F agent-patterns start:llm-as-a-judge",
    categories: ["Evaluation", "Control"],
    complexity: "Advanced",
    highlights: [
      "Demonstrates autonomous quality loops with a reviewer agent",
      "Useful when human review is expensive but quality must stay high",
    ],
    sourceFile: "llm-as-a-judge.ts",
  },
  {
    slug: "output-guardrails",
    title: "Output Guardrails",
    description: "Validates responses before they reach the user and blocks unsafe completions.",
    command: "pnpm examples:output-guardrails",
    categories: ["Guardrails"],
    complexity: "Beginner",
    highlights: [
      "Ensures final responses respect policy",
      "Pairs with safety reviewers or automatic incident logging",
    ],
    sourceFile: "output-guardrails.ts",
  },
  {
    slug: "parallelization",
    title: "Parallelization",
    description: "Runs translation jobs across languages concurrently and picks the best candidate.",
    command: "pnpm examples:parallelization",
    categories: ["Performance", "Orchestration"],
    complexity: "Intermediate",
    highlights: [
      "Showcases how to fan out work and aggregate results",
      "Reduces latency on multi-language workloads",
    ],
    sourceFile: "parallelization.ts",
  },
  {
    slug: "routing",
    title: "Routing",
    description: "Directs messages to language-specific agents using a lightweight router.",
    command: "pnpm examples:routing",
    categories: ["Routing", "Personalization"],
    complexity: "Beginner",
    highlights: [
      "Demonstrates prompt-based agent dispatch",
      "Keeps domain experts isolated per locale or capability",
    ],
    sourceFile: "routing.ts",
  },
  {
    slug: "streamed",
    title: "Streaming",
    description: "Streams incremental responses and events from an agent run to the client.",
    command: "pnpm examples:streamed",
    categories: ["Streaming"],
    complexity: "Intermediate",
    highlights: [
      "Useful for building responsive chat surfaces",
      "Illustrates how to handle partial updates in the UI",
    ],
    sourceFile: "streamed.ts",
  },
  {
    slug: "streaming-guardrails",
    title: "Streaming Guardrails",
    description: "Applies policy checks to streamed tokens before showing them to users.",
    command: "pnpm -F agent-patterns start:streaming-guardrails",
    categories: ["Streaming", "Guardrails"],
    complexity: "Advanced",
    highlights: [
      "Demonstrates interrupting a stream when policy is violated",
      "Great for real-time surfaces where latency matters",
    ],
    sourceFile: "streaming-guardrails.ts",
  },
];

const CATEGORY_FILTERS: { value: "all" | PatternCategory; label: string }[] = [
  { value: "all", label: "All patterns" },
  { value: "Orchestration", label: "Orchestration" },
  { value: "Guardrails", label: "Guardrails" },
  { value: "Human review", label: "Human review" },
  { value: "Streaming", label: "Streaming" },
  { value: "Evaluation", label: "Evaluation" },
  { value: "Control", label: "Control" },
  { value: "Personalization", label: "Personalization" },
  { value: "Performance", label: "Performance" },
  { value: "Routing", label: "Routing" },
];

const COMPLEXITY_FILTERS: { value: ComplexityFilter; label: string }[] = [
  { value: "all", label: "All complexity" },
  { value: "Beginner", label: "Beginner" },
  { value: "Intermediate", label: "Intermediate" },
  { value: "Advanced", label: "Advanced" },
];

const isCategoryFilterValue = (
  value: string | null,
): value is (typeof CATEGORY_FILTERS)[number]["value"] =>
  value !== null && CATEGORY_FILTERS.some((category) => category.value === value);

const isComplexityFilterValue = (value: string | null): value is ComplexityFilter =>
  value !== null && COMPLEXITY_FILTERS.some((complexity) => complexity.value === value);

export default function AgentPatternsPage() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeCategory, setActiveCategory] = useState<(typeof CATEGORY_FILTERS)[number]["value"]>(() => {
    const categoryParam = searchParams.get("category");
    if (categoryParam === null || categoryParam === "all") {
      return "all";
    }
    return isCategoryFilterValue(categoryParam) ? categoryParam : "all";
  });
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [activeComplexity, setActiveComplexity] = useState<ComplexityFilter>(() => {
    const complexityParam = searchParams.get("complexity");
    if (complexityParam === null || complexityParam === "all") {
      return "all";
    }
    return isComplexityFilterValue(complexityParam) ? (complexityParam as ComplexityFilter) : "all";
  });
  const [selectedPatternSlug, setSelectedPatternSlug] = useState<string | null>(() => {
    const slugParam = searchParams.get("pattern");
    return slugParam && PATTERNS.some((pattern) => pattern.slug === slugParam) ? slugParam : null;
  });

  const lastSyncedSearchParams = useRef(searchParams.toString());

  const updateSearchParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(searchParams);
      const normalizedValue = value?.length ? value : null;
      const currentValue = searchParams.get(key);

      if (normalizedValue === null) {
        if (currentValue === null) {
          return;
        }
        next.delete(key);
      } else {
        if (currentValue === normalizedValue) {
          return;
        }
        next.set(key, normalizedValue);
      }

      lastSyncedSearchParams.current = next.toString();
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    const serialized = searchParams.toString();
    if (serialized === lastSyncedSearchParams.current) {
      return;
    }

    lastSyncedSearchParams.current = serialized;

    const categoryParam = searchParams.get("category");
    const parsedCategory =
      categoryParam === null || categoryParam === "all"
        ? "all"
        : isCategoryFilterValue(categoryParam)
          ? categoryParam
          : "all";
    if (parsedCategory !== activeCategory) {
      setActiveCategory(parsedCategory);
    }

    const complexityParam = searchParams.get("complexity");
    const parsedComplexity =
      complexityParam === null || complexityParam === "all"
        ? "all"
        : isComplexityFilterValue(complexityParam)
          ? (complexityParam as ComplexityFilter)
          : "all";
    if (parsedComplexity !== activeComplexity) {
      setActiveComplexity(parsedComplexity);
    }

    const qParam = searchParams.get("q") ?? "";
    if (qParam !== search) {
      setSearch(qParam);
    }

    const slugParam = searchParams.get("pattern");
    const normalizedSlug =
      slugParam && PATTERNS.some((pattern) => pattern.slug === slugParam) ? slugParam : null;
    if (normalizedSlug !== selectedPatternSlug) {
      setSelectedPatternSlug(normalizedSlug);
    }
  }, [activeCategory, activeComplexity, search, searchParams, selectedPatternSlug]);

  useEffect(() => {
    updateSearchParam("category", activeCategory === "all" ? null : activeCategory);
  }, [activeCategory, updateSearchParam]);

  useEffect(() => {
    updateSearchParam("complexity", activeComplexity === "all" ? null : activeComplexity);
  }, [activeComplexity, updateSearchParam]);

  useEffect(() => {
    const handler = window.setTimeout(() => {
      updateSearchParam("q", search.trim().length ? search.trim() : null);
    }, 200);

    return () => {
      window.clearTimeout(handler);
    };
  }, [search, updateSearchParam]);

  useEffect(() => {
    updateSearchParam("pattern", selectedPatternSlug);
  }, [selectedPatternSlug, updateSearchParam]);

  const categoryCounts = useMemo(
    () =>
      PATTERNS.reduce((acc, pattern) => {
        pattern.categories.forEach((category) => {
          acc[category] = (acc[category] ?? 0) + 1;
        });
        return acc;
      }, {} as Record<PatternCategory, number>),
    [],
  );

  const complexityCounts = useMemo(
    () =>
      PATTERNS.reduce(
        (acc, pattern) => {
          acc[pattern.complexity] += 1;
          return acc;
        },
        {
          Beginner: 0,
          Intermediate: 0,
          Advanced: 0,
        } as Record<AgentPattern["complexity"], number>,
      ),
    [],
  );

  const searchMatches = useMemo(() => {
    const term = search.trim().toLowerCase();

    return PATTERNS.filter((pattern) => {
      if (term.length === 0) {
        return true;
      }

      const inTitle = pattern.title.toLowerCase().includes(term);
      const inDescription = pattern.description.toLowerCase().includes(term);
      const inCategories = pattern.categories.some((category) => category.toLowerCase().includes(term));
      const inHighlights = pattern.highlights.some((highlight) => highlight.toLowerCase().includes(term));

      return inTitle || inDescription || inCategories || inHighlights;
    });
  }, [search]);

  const filteredPatterns = useMemo(() => {
    if (activeCategory === "all") {
      return searchMatches;
    }

    return searchMatches.filter((pattern) => pattern.categories.includes(activeCategory as PatternCategory));
  }, [activeCategory, searchMatches]);

  const patternsToRender = useMemo(() => {
    if (activeComplexity === "all") {
      return filteredPatterns;
    }

    return filteredPatterns.filter((pattern) => pattern.complexity === activeComplexity);
  }, [activeComplexity, filteredPatterns]);

  const searchAndComplexityMatches = useMemo(() => {
    if (activeComplexity === "all") {
      return searchMatches;
    }

    return searchMatches.filter((pattern) => pattern.complexity === activeComplexity);
  }, [activeComplexity, searchMatches]);

  const availableComplexityCounts = useMemo(
    () =>
      filteredPatterns.reduce(
        (acc, pattern) => {
          acc[pattern.complexity] += 1;
          return acc;
        },
        {
          Beginner: 0,
          Intermediate: 0,
          Advanced: 0,
        } as Record<AgentPattern["complexity"], number>,
      ),
    [filteredPatterns],
  );

  const filteredComplexityCounts = useMemo(
    () =>
      patternsToRender.reduce(
        (acc, pattern) => {
          acc[pattern.complexity] += 1;
          return acc;
        },
        {
          Beginner: 0,
          Intermediate: 0,
          Advanced: 0,
        } as Record<AgentPattern["complexity"], number>,
      ),
    [patternsToRender],
  );

  const filteredCategoryCounts = useMemo(
    () =>
      patternsToRender.reduce((acc, pattern) => {
        pattern.categories.forEach((category) => {
          acc[category] = (acc[category] ?? 0) + 1;
        });
        return acc;
      }, {} as Record<PatternCategory, number>),
    [patternsToRender],
  );

  const categoryMatchingCounts = useMemo(() => {
    const counts: Record<PatternCategory, number> & { all: number } = {
      all: searchAndComplexityMatches.length,
      Orchestration: 0,
      Guardrails: 0,
      "Human review": 0,
      Streaming: 0,
      Evaluation: 0,
      Control: 0,
      Personalization: 0,
      Performance: 0,
      Routing: 0,
    };

    searchAndComplexityMatches.forEach((pattern) => {
      pattern.categories.forEach((category) => {
        counts[category] = (counts[category] ?? 0) + 1;
      });
    });

    return counts;
  }, [searchAndComplexityMatches]);

  const stats = useMemo(() => {
    const guardrailCount = categoryCounts.Guardrails ?? 0;
    const streamingCount = categoryCounts.Streaming ?? 0;
    const humanReviewCount = categoryCounts["Human review"] ?? 0;

    return [
      {
        label: "Total patterns",
        value: PATTERNS.length,
        matching: patternsToRender.length,
      },
      {
        label: "Beginner friendly",
        value: complexityCounts.Beginner,
        matching: filteredComplexityCounts.Beginner,
      },
      {
        label: "Intermediate ready",
        value: complexityCounts.Intermediate,
        matching: filteredComplexityCounts.Intermediate,
      },
      {
        label: "Advanced playbooks",
        value: complexityCounts.Advanced,
        matching: filteredComplexityCounts.Advanced,
      },
      {
        label: "Guardrail recipes",
        value: guardrailCount,
        matching: filteredCategoryCounts.Guardrails ?? 0,
      },
      {
        label: "Streaming ready",
        value: streamingCount,
        matching: filteredCategoryCounts.Streaming ?? 0,
      },
      {
        label: "Human-in-the-loop",
        value: humanReviewCount,
        matching: filteredCategoryCounts["Human review"] ?? 0,
      },
    ];
  }, [categoryCounts, complexityCounts, filteredCategoryCounts, filteredComplexityCounts, patternsToRender.length]);

  const selectedPattern = useMemo(
    () => PATTERNS.find((pattern) => pattern.slug === selectedPatternSlug) ?? null,
    [selectedPatternSlug],
  );

  const handleCopy = (command: string) => {
    navigator.clipboard
      .writeText(command)
      .then(() => {
        toast({ title: "Copied", description: `Command copied: ${command}` });
      })
      .catch(() => {
        toast({
          title: "Clipboard error",
          description: "We couldn't copy that command. Please try manually.",
          variant: "destructive",
        });
      });
  };

  const handleResetFilters = useCallback(() => {
    setActiveCategory("all");
    setActiveComplexity("all");
    setSearch("");
    setSelectedPatternSlug(null);
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader
          title="Agent Pattern Library"
          description="Curated recipes from the openai-agents-js examples showcasing orchestration, guardrails, and review flows."
        />

        <Alert className="border-dashed bg-card/60">
          <Github className="h-5 w-5" />
          <AlertTitle>Explore the upstream examples</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              Each pattern links to the corresponding script in the
              {" "}
              <a
                className="font-medium text-primary hover:underline"
                href="https://github.com/openai/openai-agents-js/tree/main/examples/agent-patterns"
                target="_blank"
                rel="noreferrer"
              >
                openai-agents-js repository
              </a>
              . They are excellent starting points when wiring new AI broker workflows in EasyMO.
            </p>
            <p className="text-muted-foreground text-sm">
              Run them locally with pnpm to better understand when to reach for human approval, guardrails, or streaming tools.
            </p>
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-2xl font-bold">{stat.value}</p>
                {typeof stat.matching === "number" && (
                  <p className="text-xs text-muted-foreground">
                    {stat.matching} match{stat.matching === 1 ? "" : "es"} with current filters
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="space-y-4">
            <CardTitle className="text-base font-medium">Filter patterns</CardTitle>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative w-full max-w-md">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by name, capability, or description"
                    className="pl-10"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_FILTERS.map((category) => {
                    const totalCount =
                      category.value === "all"
                        ? PATTERNS.length
                        : categoryCounts[category.value as PatternCategory] ?? 0;
                    const matchingCount =
                      category.value === "all"
                        ? categoryMatchingCounts.all
                        : categoryMatchingCounts[category.value as PatternCategory] ?? 0;

                    return (
                      <Button
                        key={category.value}
                        type="button"
                        variant={activeCategory === category.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setActiveCategory(category.value)}
                        className="flex items-center gap-2"
                        aria-pressed={activeCategory === category.value}
                      >
                        <span>{category.label}</span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {matchingCount}/{totalCount}
                        </span>
                      </Button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Complexity</span>
                <div className="flex flex-wrap gap-2">
                  {COMPLEXITY_FILTERS.map((complexity) => {
                    const totalCount =
                      complexity.value === "all"
                        ? PATTERNS.length
                        : complexityCounts[complexity.value as Exclude<ComplexityFilter, "all">];
                    const matchingCount =
                      complexity.value === "all"
                        ? filteredPatterns.length
                        : availableComplexityCounts[complexity.value as Exclude<ComplexityFilter, "all">];

                    return (
                      <Button
                        key={complexity.value}
                        type="button"
                        variant={activeComplexity === complexity.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setActiveComplexity(complexity.value)}
                        className="flex items-center gap-2"
                        aria-pressed={activeComplexity === complexity.value}
                      >
                        <span>{complexity.label}</span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {matchingCount}/{totalCount}
                        </span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {patternsToRender.map((pattern) => (
            <Card key={pattern.slug} className="flex h-full flex-col">
              <CardHeader className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg font-semibold">{pattern.title}</CardTitle>
                  <Badge variant="secondary">{pattern.complexity}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{pattern.description}</p>
              </CardHeader>
              <CardContent className="mt-auto space-y-4">
                <div className="flex flex-wrap gap-2">
                  {pattern.categories.map((category) => (
                    <Badge key={category} variant="outline">
                      {category}
                    </Badge>
                  ))}
                </div>

                <ul className="space-y-2 text-sm text-muted-foreground">
                  {pattern.highlights.map((highlight) => (
                    <li key={highlight} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/70" aria-hidden />
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>

                <div className="space-y-2">
                  <span className="text-xs font-medium uppercase text-muted-foreground">Run the example</span>
                  <div className="flex items-center justify-between rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs">
                    <span className="truncate">{pattern.command}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => handleCopy(pattern.command)}
                      aria-label={`Copy ${pattern.title} command`}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setSelectedPatternSlug(pattern.slug)}
                    variant="secondary"
                  >
                    View details
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={`${REPO_BASE_URL}/${pattern.sourceFile}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View source
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {patternsToRender.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center text-sm text-muted-foreground">
              <p>
                No patterns match your filters yet. Try adjusting the filters or clear the search to see the full catalog.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={handleResetFilters}>
                Reset filters
              </Button>
            </CardContent>
          </Card>
        )}
        <Dialog
          open={Boolean(selectedPattern)}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedPatternSlug(null);
            }
          }}
        >
          <DialogContent className="max-w-2xl">
            {selectedPattern && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex flex-wrap items-center gap-3">
                    {selectedPattern.title}
                    <Badge variant="secondary">{selectedPattern.complexity}</Badge>
                  </DialogTitle>
                  <DialogDescription>{selectedPattern.description}</DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] pr-2">
                  <div className="space-y-6 py-2">
                    <div className="flex flex-wrap gap-2">
                      {selectedPattern.categories.map((category) => (
                        <Badge key={category} variant="outline">
                          {category}
                        </Badge>
                      ))}
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Highlights</h3>
                      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                        {selectedPattern.highlights.map((highlight) => (
                          <li key={highlight} className="flex items-start gap-2">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/70" aria-hidden />
                            <span>{highlight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <span className="text-xs font-medium uppercase text-muted-foreground">Run the example</span>
                      <div className="flex items-center justify-between rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs">
                        <span className="truncate">{selectedPattern.command}</span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => handleCopy(selectedPattern.command)}
                          aria-label={`Copy ${selectedPattern.title} command`}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button asChild variant="default" size="sm">
                        <a
                          href={`${REPO_BASE_URL}/${selectedPattern.sourceFile}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open source file
                        </a>
                      </Button>
                    </div>
                  </div>
                </ScrollArea>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

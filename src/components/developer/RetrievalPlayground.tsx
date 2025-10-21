import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Search, Filter, Database, Sparkles, Loader2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { AdminAPI } from '@/lib/api';
import { getOpenAiVectorStoreId } from '@/lib/env';
import type { RetrievalSearchRequest, RetrievalSearchResponse, RetrievalSearchResult } from '@/lib/types';

type RetrievalChunk = NonNullable<RetrievalSearchResult['content']>[number];

const formatScore = (score?: number) =>
  typeof score === 'number' && Number.isFinite(score)
    ? `${(score * 100).toFixed(1)}%`
    : 'n/a';

const defaultFilterTemplate = `{
  "type": "eq",
  "key": "region",
  "value": "us"
}`;

type AttributeMode = 'empty' | 'custom';

const parseFilter = (raw: string): Record<string, unknown> | undefined => {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // handled by caller
  }
  throw new Error('Attribute filter must be valid JSON object');
};

const toRequestPayload = (
  input: {
    query: string;
    vectorStoreId?: string;
    maxResults?: string;
    rewriteQuery: boolean;
    attributeFilter: string;
  },
): RetrievalSearchRequest => {
  if (!input.query.trim()) {
    throw new Error('Enter a query to run retrieval search.');
  }

  let parsedFilter: Record<string, unknown> | undefined;
  if (input.attributeFilter.trim()) {
    parsedFilter = parseFilter(input.attributeFilter);
  }

  const numericMax = input.maxResults && input.maxResults.length
    ? Number.parseInt(input.maxResults, 10)
    : undefined;

  const payload: RetrievalSearchRequest = {
    query: input.query.trim(),
    rewriteQuery: input.rewriteQuery,
  };

  if (input.vectorStoreId?.trim()) {
    payload.vectorStoreId = input.vectorStoreId.trim();
  }

  if (numericMax && Number.isFinite(numericMax)) {
    payload.maxResults = numericMax;
  }

  if (parsedFilter) {
    payload.attributeFilter = parsedFilter;
  }

  return payload;
};

const chunkKey = (chunk: RetrievalChunk, index: number) =>
  typeof chunk.id === 'string' ? chunk.id : `${index}`;

const ResultChunk = ({ chunk, index }: { chunk: RetrievalChunk; index: number }) => {
  const restEntries = Object.entries(chunk).filter(([key]) => key !== 'text' && key !== 'type');
  return (
    <div className="rounded-md border bg-muted/40 p-3 text-sm">
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>{chunk.type ?? 'text'}</span>
        <Badge variant="outline">#{index + 1}</Badge>
      </div>
      {chunk.text && (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{chunk.text}</p>
      )}
      {restEntries.length > 0 && (
        <div className="mt-3 space-y-1 text-xs">
          {restEntries.map(([key, value]) => (
            <div key={key} className="flex justify-between gap-2">
              <span className="font-medium text-muted-foreground">{key}</span>
              <span className="truncate text-right">{typeof value === 'string' ? value : JSON.stringify(value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ResultCard = ({ result }: { result: RetrievalSearchResult }) => (
  <div className="rounded-lg border p-4">
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="secondary" className="flex items-center gap-1">
        <Database className="h-3 w-3" />
        {result.file_id ?? 'unknown-file'}
      </Badge>
      {result.filename && <Badge variant="outline">{result.filename}</Badge>}
      <Badge variant="outline" className="ml-auto">Score: {formatScore(result.score)}</Badge>
    </div>
    {result.attributes && Object.keys(result.attributes).length > 0 && (
      <div className="mt-3 text-xs">
        <div className="font-semibold text-muted-foreground">Attributes</div>
        <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted/50 p-3 text-xs">{JSON.stringify(result.attributes, null, 2)}</pre>
      </div>
    )}
    {Array.isArray(result.content) && result.content.length > 0 && (
      <div className="mt-4 space-y-3">
        {result.content
          .filter((chunk): chunk is RetrievalChunk => Boolean(chunk) && typeof chunk === 'object')
          .map((chunk, index) => (
            <ResultChunk key={chunkKey(chunk, index)} chunk={chunk} index={index} />
          ))}
      </div>
    )}
  </div>
);

export function RetrievalPlayground() {
  const { toast } = useToast();
  const defaultVectorStoreId = useMemo(() => getOpenAiVectorStoreId() ?? '', []);
  const [vectorStoreId, setVectorStoreId] = useState(defaultVectorStoreId);
  const [query, setQuery] = useState('How many woodchucks are allowed per passenger?');
  const [maxResults, setMaxResults] = useState('5');
  const [rewriteQuery, setRewriteQuery] = useState(true);
  const [attributeMode, setAttributeMode] = useState<AttributeMode>('empty');
  const [attributeFilter, setAttributeFilter] = useState('');

  const searchMutation = useMutation({
    mutationFn: (request: RetrievalSearchRequest) => AdminAPI.searchRetrieval(request),
  });

  const hasDefaultStore = Boolean(defaultVectorStoreId);

  const onRunSearch = async () => {
    try {
      const payload = toRequestPayload({
        query,
        vectorStoreId,
        maxResults,
        rewriteQuery,
        attributeFilter,
      });
      const result = await searchMutation.mutateAsync(payload);
      if (result.status === 'error') {
        toast({
          title: 'Search returned an error',
          description: result.message ?? result.error ?? 'Unknown error',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Retrieval search complete',
          description: `${result.results.length} chunk(s) returned in ${result.meta?.took_ms ?? '??'}ms`,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to run retrieval search';
      toast({
        title: 'Unable to run search',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const response = searchMutation.data as RetrievalSearchResponse | undefined;
  const isLoading = searchMutation.isPending;
  const error = searchMutation.error as Error | undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Search className="h-5 w-5" /> Retrieval Playground
        </CardTitle>
        <CardDescription>
          Send semantic queries to the configured vector store and inspect the ranked chunks coming back from OpenAI Retrieval.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="vector-store">Vector Store ID</Label>
              <Input
                id="vector-store"
                placeholder="vs_123"
                value={vectorStoreId}
                onChange={(event) => setVectorStoreId(event.target.value)}
              />
              {!hasDefaultStore && (
                <p className="text-xs text-muted-foreground">Set VITE_OPENAI_VECTOR_STORE_ID to skip typing this every time.</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="query">Query</Label>
              <Textarea
                id="query"
                rows={4}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="What is the return policy?"
              />
            </div>
            <div className="flex flex-col gap-4 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="rewrite-query" className="flex items-center gap-2 text-sm">
                  <Sparkles className="h-4 w-4 text-muted-foreground" /> Enable query rewriting
                </Label>
                <Switch id="rewrite-query" checked={rewriteQuery} onCheckedChange={setRewriteQuery} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="max-results">Max results</Label>
                  <Input
                    id="max-results"
                    type="number"
                    min={1}
                    max={50}
                    value={maxResults}
                    onChange={(event) => setMaxResults(event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="flex items-center gap-2 text-sm">
                    <Filter className="h-4 w-4 text-muted-foreground" /> Attribute filter
                  </Label>
                  <Switch
                    id="attribute-toggle"
                    checked={attributeMode === 'custom'}
                    onCheckedChange={(checked) => {
                      setAttributeMode(checked ? 'custom' : 'empty');
                      if (!checked) {
                        setAttributeFilter('');
                      } else if (!attributeFilter) {
                        setAttributeFilter(defaultFilterTemplate);
                      }
                    }}
                  />
                </div>
              </div>
              {attributeMode === 'custom' && (
                <Textarea
                  rows={4}
                  value={attributeFilter}
                  onChange={(event) => setAttributeFilter(event.target.value)}
                  placeholder={defaultFilterTemplate}
                />
              )}
            </div>
            <Button onClick={onRunSearch} disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Searching…
                </>
              ) : (
                'Run semantic search'
              )}
            </Button>
          </div>
          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Request failed</AlertTitle>
                <AlertDescription>{error.message}</AlertDescription>
              </Alert>
            )}
            {response && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">Status: {response.status}</Badge>
                  {response.query?.rewritten && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> {response.query.rewritten}
                    </Badge>
                  )}
                  {typeof response.meta?.took_ms === 'number' && (
                    <Badge variant="outline">{response.meta.took_ms} ms</Badge>
                  )}
                  {typeof response.usage?.total_tokens === 'number' && (
                    <Badge variant="outline">{response.usage.total_tokens} tokens</Badge>
                  )}
                </div>
                {response.query?.original && response.query.original !== response.query.rewritten && (
                  <p className="text-sm text-muted-foreground">
                    Original query: <span className="font-medium text-foreground">{response.query.original}</span>
                  </p>
                )}
                {response.results.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No chunks returned for this query.</p>
                ) : (
                  <ScrollArea className="h-[420px] rounded-md border p-4">
                    <div className="space-y-4">
                      {response.results.map((result, index) => (
                        <ResultCard key={result.file_id ?? `result-${index}`} result={result} />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}
            {!response && !error && (
              <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                Run a query to see retrieval results here. We will render the ranked chunks, their scores, and any metadata that OpenAI returns.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

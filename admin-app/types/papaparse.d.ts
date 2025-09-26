declare module 'papaparse' {
  interface UnparseConfig {
    quotes?: boolean | boolean[] | ((value: unknown, index: number) => boolean);
    delimiter?: string;
    newline?: string;
    header?: boolean;
    quoteChar?: string;
    escapeChar?: string;
    columns?: boolean;
    skipEmptyLines?: boolean | 'greedy';
  }

  interface ParseError {
    type: string;
    code: string;
    message: string;
    row?: number;
  }

  interface ParseResult<T> {
    data: T[];
    errors: ParseError[];
    meta: Record<string, unknown>;
  }

  interface ParseConfig<T> {
    header?: boolean;
    skipEmptyLines?: boolean | 'greedy';
    complete?: (results: ParseResult<T>) => void;
    error?: (error: ParseError) => void;
  }

  type UnparseInput =
    | readonly unknown[]
    | readonly Record<string, unknown>[]
    | {
        data: readonly unknown[];
        fields?: readonly string[];
      };

  interface PapaStatic {
    unparse(data: UnparseInput, config?: UnparseConfig): string;
    parse<T>(input: File | string, config?: ParseConfig<T>): void;
  }

  const Papa: PapaStatic;
  export default Papa;
}

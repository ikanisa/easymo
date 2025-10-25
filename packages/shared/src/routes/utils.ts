const PATH_PARAM_PATTERN = /:([A-Za-z0-9_]+)/g;

export const compileRoutePath = (template: string, params: Record<string, string>) =>
  template.replace(PATH_PARAM_PATTERN, (_: string, paramName: string) => {
    const value = params[paramName];
    if (value == null) {
      throw new Error(
        `Missing value for parameter "${paramName}" when generating path from template "${template}".`,
      );
    }
    return encodeURIComponent(String(value));
  });

export type ExtractPathParamNames<Path extends string> = Path extends `${string}:${infer Param}/${infer Rest}`
  ? Param | ExtractPathParamNames<`/${Rest}`>
  : Path extends `${string}:${infer Param}`
    ? Param
    : never;

export type PathParams<Path extends string> = [ExtractPathParamNames<Path>] extends [never]
  ? Record<string, never>
  : { [Key in ExtractPathParamNames<Path>]: string };

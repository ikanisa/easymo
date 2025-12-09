import dynamic from "next/dynamic";
export function noSSR<T extends object>(loader: () => Promise<any>) {
  return dynamic(loader as any, { ssr: false, loading: () => null }) as React.ComponentType<T>;
}

declare module '@tanstack/react-query' {
  // Minimal compatibility shim to satisfy TS JSX checks during rebase gating.
  // The real types are provided by @tanstack/react-query; this augments only the JSX element typing.
  export const HydrationBoundary: (props: any) => import('react').ReactElement | null;
}

export function createClient(_url: string, _key: string) {
  return {
    from() {
      throw new Error("supabase client stub should not be used in tests");
    },
    storage: {
      from() {
        throw new Error("supabase storage stub should not be used in tests");
      },
    },
  };
}

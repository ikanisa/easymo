# Supabase migrations

Use the Supabase CLI to apply every migration when working with a linked
project.

1. Link to the target project if you have not already:
   `supabase link --project-ref <project-ref>`.
2. Apply all migrations to the linked database in order:
   `supabase migration up --linked --include-all`.

Including the `--include-all` flag ensures the CLI runs every migration
directory so that the linked environment matches the repository state.

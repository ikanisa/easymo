const migrationDir =
  new URL("../../supabase/migrations", import.meta.url).pathname;
const errors: Array<string> = [];

async function* walkDir(path: string): AsyncGenerator<string> {
  for await (const entry of Deno.readDir(path)) {
    const entryPath = `${path}/${entry.name}`;
    if (entry.isDirectory) {
      yield* walkDir(entryPath);
    } else if (entry.isFile && entry.name.toLowerCase().endsWith(".sql")) {
      yield entryPath;
    }
  }
}

for await (const filePath of walkDir(migrationDir)) {
  const text = await Deno.readTextFile(filePath);
  const lines = text.split(/\r?\n/);
  const meaningful = lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("--"));

  if (meaningful.length === 0) {
    errors.push(`${filePath.split("/").pop()}: empty migration`);
    continue;
  }

  const first = meaningful[0].toUpperCase();
  const last = meaningful[meaningful.length - 1].toUpperCase();

  if (first !== "BEGIN;") {
    errors.push(
      `${filePath.split("/").pop()}: first statement must be BEGIN; found "${
        meaningful[0]
      }"`,
    );
  }
  if (last !== "COMMIT;") {
    errors.push(
      `${filePath.split("/").pop()}: last statement must be COMMIT; found "${
        meaningful[meaningful.length - 1]
      }"`,
    );
  }
}

if (errors.length) {
  console.error("\nMigration formatting check failed:");
  for (const err of errors) {
    console.error(` - ${err}`);
  }
  Deno.exit(1);
}

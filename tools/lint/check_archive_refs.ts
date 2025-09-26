const ROOT = new URL("../../", import.meta.url).pathname;
const roots = [
  "admin-app",
  "station-app",
  "supabase/functions",
  "apps",
];

const forbidden = [/\b_archive\./i, /\bserved_drivers\b/i, /\bserved_passengers\b/i, /\bbasket_joins\b/i, /\bcontributions\b/i];
const offenders: Array<string> = [];

async function* walkDir(path: string): AsyncGenerator<string> {
  for await (const entry of Deno.readDir(path)) {
    const entryPath = `${path}/${entry.name}`;
    if (entry.isDirectory) {
      yield* walkDir(entryPath);
    } else if (entry.isFile) {
      yield entryPath;
    }
  }
}

for (const root of roots) {
  try {
    const rootPath = `${ROOT}${root}`;
    for await (const filePath of walkDir(rootPath)) {
      if (!/[.](ts|tsx|sql|md)$/i.test(filePath)) continue;
      const content = await Deno.readTextFile(filePath);
      if (forbidden.some((pattern) => pattern.test(content))) {
        offenders.push(filePath.replace(`${ROOT}`, ""));
      }
    }
  } catch (_) {
    // ignore missing directories (e.g., station-app might not exist locally)
  }
}

if (offenders.length) {
  console.error("Found legacy archive references in runtime code/docs:");
  for (const file of offenders) {
    console.error(` - ${file}`);
  }
  Deno.exit(1);
}

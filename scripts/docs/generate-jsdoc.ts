#!/usr/bin/env -S deno run --allow-read --allow-write
/**
 * JSDoc Documentation Generator
 * Extracts and compiles JSDoc comments into documentation
 */

import { walk } from "https://deno.land/std@0.203.0/fs/walk.ts";

type DocEntry = {
  name: string;
  type: "function" | "class" | "type" | "constant";
  description: string;
  file: string;
  line: number;
};

async function extractJsDoc(filePath: string): Promise<DocEntry[]> {
  const content = await Deno.readTextFile(filePath);
  const entries: DocEntry[] = [];
  
  const jsdocRegex = /\/\*\*\s*([\s\S]*?)\s*\*\/\s*(?:export\s+)?(?:async\s+)?(?:(function|class|const|type|interface)\s+(\w+))?/g;
  
  let match;
  while ((match = jsdocRegex.exec(content)) !== null) {
    const comment = match[1];
    const type = match[2] as DocEntry["type"] || "function";
    const name = match[3] || "unnamed";
    
    if (!comment) continue;
    
    entries.push({
      name,
      type,
      description: extractDescription(comment),
      file: filePath,
      line: content.substring(0, match.index).split("\n").length,
    });
  }
  
  return entries;
}

function extractDescription(comment: string): string {
  const lines = comment.split("\n").map(l => l.replace(/^\s*\*\s?/, "").trim());
  const descLines: string[] = [];
  
  for (const line of lines) {
    if (line.startsWith("@")) break;
    if (line) descLines.push(line);
  }
  
  return descLines.join(" ");
}

async function generateDocumentation() {
  console.log("📚 Generating JSDoc Documentation...");
  
  const allEntries: DocEntry[] = [];
  
  for await (const entry of walk("supabase/functions", {
    exts: [".ts"],
    skip: [/node_modules/, /\.test\.ts$/, /__tests__/],
  })) {
    if (entry.isFile) {
      const entries = await extractJsDoc(entry.path);
      allEntries.push(...entries);
    }
  }
  
  const markdown = generateMarkdown(allEntries);
  
  await Deno.mkdir("docs/api", { recursive: true });
  await Deno.writeTextFile("docs/api/code-reference.md", markdown);
  
  console.log(`✅ Generated documentation for ${allEntries.length} entries`);
  console.log("   Output: docs/api/code-reference.md");
}

function generateMarkdown(entries: DocEntry[]): string {
  let md = "# Code Reference\n\n";
  md += `Generated on: ${new Date().toISOString()}\n\n`;
  md += "---\n\n";
  
  const grouped: Record<string, DocEntry[]> = {};
  for (const entry of entries) {
    if (!grouped[entry.type]) grouped[entry.type] = [];
    grouped[entry.type].push(entry);
  }
  
  if (grouped.function?.length) {
    md += "## Functions\n\n";
    for (const entry of grouped.function) {
      md += `### \`${entry.name}\`\n\n`;
      md += `${entry.description}\n\n`;
      md += `*Source: ${entry.file}:${entry.line}*\n\n---\n\n`;
    }
  }
  
  return md;
}

if (import.meta.main) {
  await generateDocumentation();
}

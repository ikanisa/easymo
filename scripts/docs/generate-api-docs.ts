#!/usr/bin/env -S deno run --allow-read --allow-write
/**
 * API Documentation Generator
 * Generates HTML documentation from OpenAPI spec
 */

import { parse as parseYaml } from "https://deno.land/std@0.203.0/yaml/mod.ts";

async function generateApiDocs() {
  console.log("📚 Generating API Documentation...");

  const specContent = await Deno.readTextFile("docs/api/openapi.yaml");
  const spec = parseYaml(specContent) as any;

  const html = generateHtml(spec);

  await Deno.mkdir("docs/api/html", { recursive: true });
  await Deno.writeTextFile("docs/api/html/index.html", html);

  console.log("✅ API documentation generated: docs/api/html/index.html");
}

function generateHtml(spec: any): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${spec.info.title} - API Documentation</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    h1 { color: #2563eb; }
    .endpoint { background: white; border: 1px solid #e5e7eb; margin: 1rem 0; padding: 1rem; }
    .method { font-weight: bold; padding: 0.25rem 0.75rem; border-radius: 0.25rem; }
    .method-get { background: #16a34a; color: white; }
    .method-post { background: #2563eb; color: white; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${spec.info.title} <span style="font-size: 0.875rem;">v${spec.info.version}</span></h1>
    <p>${spec.info.description?.split('\n')[0] || ''}</p>
    
    <h2>Endpoints</h2>
    ${generateEndpointsHtml(spec)}
  </div>
</body>
</html>`;
}

function generateEndpointsHtml(spec: any): string {
  let html = '';
  const paths = spec.paths || {};
  
  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, details] of Object.entries(methods as any)) {
      html += `
        <div class="endpoint">
          <span class="method method-${method}">${method.toUpperCase()}</span>
          <span>${path}</span>
          <p>${(details as any).summary || ''}</p>
        </div>
      `;
    }
  }
  
  return html;
}

if (import.meta.main) {
  await generateApiDocs();
}

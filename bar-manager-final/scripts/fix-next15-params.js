const fs = require('fs');
const path = require('path');

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walk(filePath, fileList);
    } else {
      if (file === 'route.ts') {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

const routes = walk(path.join(process.cwd(), 'app/api'));

for (const route of routes) {
  let content = fs.readFileSync(route, 'utf8');
  let originalContent = content;

  // Regex to match:
  // export async function METHOD(
  //   request: NextRequest,
  //   { params }: { params: { id: string } }
  // ) {
  
  // We capture:
  // 1. The function declaration up to the second argument
  // 2. The content inside the params type definition (e.g. "id: string")
  
  // Debug logging
  // console.log(`Checking ${route}`);
  
  // Regex to match old pattern: { params }: { params: { ... } }
  // We want to avoid matching Promise<{ ... }>
  
  const regex = /(export\s+async\s+function\s+\w+\s*\(\s*[^,]+,\s*)\{\s*params\s*\}\s*:\s*\{\s*params\s*:\s*\{\s*([^}]+)\s*\}\s*\}\s*\)\s*\{/g;
  
  // Check if it's already using Promise
  if (content.includes('Promise<{')) {
    // console.log(`Skipping ${route} (already using Promise)`);
    continue;
  }

  content = content.replace(regex, (match, p1, p2) => {
    console.log(`Fixing ${route}`);
    return `${p1}props: { params: Promise<{ ${p2.trim()} }> }) {\n  const params = await props.params;`;
  });

  if (content !== originalContent) {
    console.log(`Fixing ${route}`);
    fs.writeFileSync(route, content);
  }
}

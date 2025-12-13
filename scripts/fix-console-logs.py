#!/usr/bin/env python3
"""
Replace console.log with structured logging
No external dependencies required
"""

import os
import re
import sys
from pathlib import Path

def find_typescript_files(root_path):
    """Find all TypeScript files excluding tests"""
    files = []
    for root, dirs, filenames in os.walk(root_path):
        # Skip node_modules
        if 'node_modules' in root:
            continue
        for filename in filenames:
            if filename.endswith('.ts') and not filename.endswith('.test.ts') and not filename.endswith('.spec.ts'):
                files.append(os.path.join(root, filename))
    return files

def replace_console_statements(content):
    """Replace console.* with logStructuredEvent"""
    changes = 0
    
    # Pattern for console.log
    content, count = re.subn(
        r'console\.log\((.*?)\);?',
        r'logStructuredEvent("DEBUG", { data: \1 });',
        content
    )
    changes += count
    
    # Pattern for console.error
    content, count = re.subn(
        r'console\.error\((.*?)\);?',
        r'logStructuredEvent("ERROR", { error: \1 }, "error");',
        content
    )
    changes += count
    
    # Pattern for console.warn
    content, count = re.subn(
        r'console\.warn\((.*?)\);?',
        r'logStructuredEvent("WARNING", { message: \1 }, "warn");',
        content
    )
    changes += count
    
    return content, changes

def add_import_if_needed(content):
    """Add logStructuredEvent import if not present"""
    if 'logStructuredEvent' in content:
        return content
    
    # Find the last import statement
    import_pattern = r'(import.*from.*[\'"];?\n)'
    matches = list(re.finditer(import_pattern, content))
    
    if matches:
        last_import = matches[-1]
        insert_pos = last_import.end()
        import_statement = 'import { logStructuredEvent } from "../_shared/observability.ts";\n'
        content = content[:insert_pos] + import_statement + content[insert_pos:]
    else:
        # No imports, add at top
        import_statement = 'import { logStructuredEvent } from "../_shared/observability.ts";\n\n'
        content = import_statement + content
    
    return content

def process_file(filepath, dry_run=False):
    """Process a single file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            original_content = f.read()
        
        # Replace console statements
        new_content, changes = replace_console_statements(original_content)
        
        if changes > 0:
            # Add import if needed
            new_content = add_import_if_needed(new_content)
            
            if not dry_run:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
            
            return filepath, changes
        
        return None, 0
    except Exception as e:
        print(f"  ❌ Error processing {filepath}: {e}", file=sys.stderr)
        return None, 0

def main():
    dry_run = '--dry-run' in sys.argv
    path_arg = next((arg for arg in sys.argv if arg.startswith('--path=')), None)
    search_path = path_arg.split('=')[1] if path_arg else 'supabase/functions/wa-webhook-mobility'
    
    print(f"🔍 Scanning {search_path} for console.log statements...")
    print(f"   Mode: {'DRY RUN' if dry_run else 'LIVE FIX'}\n")
    
    # Find all TypeScript files
    files = find_typescript_files(search_path)
    print(f"   Found {len(files)} TypeScript files\n")
    
    # Process files
    total_replacements = 0
    modified_files = []
    
    for filepath in files:
        result, changes = process_file(filepath, dry_run)
        if result:
            total_replacements += changes
            modified_files.append((result, changes))
    
    # Report results
    print(f"\n{'=' * 70}")
    print(f"📊 SUMMARY")
    print(f"{'=' * 70}")
    print(f"Files scanned:      {len(files)}")
    print(f"Files modified:     {len(modified_files)}")
    print(f"Total replacements: {total_replacements}")
    print(f"{'=' * 70}\n")
    
    if modified_files:
        print(f"📝 Changes:\n")
        for filepath, changes in modified_files:
            rel_path = os.path.relpath(filepath)
            print(f"  ✓ {rel_path} ({changes} replacement{'s' if changes > 1 else ''})")
        print()
    
    if dry_run:
        print(f"⚠️  DRY RUN MODE - No files were modified")
        print(f"   Run without --dry-run to apply changes\n")
    else:
        print(f"✅ Changes applied successfully!\n")
    
    return 0 if not dry_run or total_replacements == 0 else 1

if __name__ == '__main__':
    sys.exit(main())

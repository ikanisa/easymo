#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

function getChangedMigrations() {
  try {
    const diffOutput = execSync(
      'git diff --name-only --diff-filter=AM --relative HEAD -- supabase/migrations',
      { encoding: 'utf8' },
    )
    const untracked = execSync(
      'git ls-files --others --exclude-standard supabase/migrations',
      { encoding: 'utf8' },
    )

    const files = [...diffOutput.split('\n'), ...untracked.split('\n')]
      .map((line) => line.trim())
      .filter(Boolean)

    return Array.from(new Set(files))
  } catch (error) {
    console.error('Failed to discover changed migrations', error)
    process.exit(1)
  }
}

function extractTables(sql) {
  const matches = sql.matchAll(/create\s+table\s+(if\s+not\s+exists\s+)?(?:public\.)?([a-zA-Z0-9_"\.]+)/gi)
  const tables = []
  for (const match of matches) {
    const raw = match[2]
    const table = raw.replace(/"/g, '').split('.').pop()
    if (table) tables.push(table)
  }
  return tables
}

function hasRls(sql, table) {
  const pattern = new RegExp(
    `ALTER\\s+TABLE\\s+(?:public\\.)?${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`,
    'i',
  )
  return pattern.test(sql)
}

function main() {
  const files = getChangedMigrations()
  if (!files.length) {
    console.log('No new migrations to check for RLS')
    return
  }

  const errors = []
  for (const relative of files) {
    const absolute = path.resolve(process.cwd(), relative)
    const sql = readFileSync(absolute, 'utf8')
    const tables = extractTables(sql)
    for (const table of tables) {
      if (!hasRls(sql, table)) {
        errors.push({ file: relative, table })
      }
    }
  }

  if (errors.length) {
    console.error('❌ RLS check failed for the following tables:')
    for (const err of errors) {
      console.error(`- ${err.table} (missing ENABLE ROW LEVEL SECURITY) in ${err.file}`)
    }
    process.exit(1)
  }

  console.log('✅ Migration RLS check passed')
}

main()

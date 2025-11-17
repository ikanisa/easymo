#!/usr/bin/env node
import process from 'node:process';
import { Client } from 'pg';

async function main() {
  const { DATABASE_URL } = process.env;
  if (!DATABASE_URL) {
    console.error('Missing DATABASE_URL');
    process.exit(2);
  }

  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query('BEGIN');
    // 1) Find duplicate names per bar using normalized key
    const dupRes = await client.query(`
      with norm as (
        select id, bar_id, lower(btrim(name)) as key, created_at
        from public.restaurant_menu_items
      ), d as (
        select bar_id, key, array_agg(id order by created_at asc) as ids, count(*) as c
        from norm
        group by bar_id, key
        having count(*) > 1
      )
      select bar_id, key, ids
      from d
    `);

    let toDelete = [];
    for (const row of dupRes.rows) {
      const ids = row.ids;
      if (Array.isArray(ids) && ids.length > 1) {
        toDelete.push(...ids.slice(1)); // keep first (oldest), delete rest
      }
    }

    let deleted = 0;
    if (toDelete.length) {
      const delRes = await client.query('DELETE FROM public.restaurant_menu_items WHERE id = ANY($1::uuid[])', [toDelete]);
      deleted = delRes.rowCount || 0;
    }

    // 2) Create unique index to enforce per-bar uniqueness going forward
    await client.query(`
      do $$
      begin
        if not exists (
          select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where c.relname = 'uniq_restaurant_menu_items_bar_name' and n.nspname = 'public'
        ) then
          execute 'create unique index uniq_restaurant_menu_items_bar_name on public.restaurant_menu_items (bar_id, lower(btrim(name)))';
        end if;
      end $$;
    `);

    await client.query('COMMIT');
    console.log(`Dedup complete. Removed ${deleted} duplicate rows. Unique index ensured.`);
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('Dedup failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();


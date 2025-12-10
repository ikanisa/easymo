import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

const csv = readFileSync('data/rwanda_bars.csv', 'utf-8');
const lines = csv.trim().split('\n').slice(1); // Skip header

const slugify = (text) => {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .replace(/^-+|-+$/g, '');
};

const inserts = lines.map(line => {
  const [name, country] = line.split(',');
  const id = randomUUID();
  const slug = slugify(name);
  
  return `('${id}', '${name.replace(/'/g, "''")}', '${slug}', '${country}', 'RWF', true)`;
});

console.log(`BEGIN;

-- Insert Rwanda bars data
-- Total: ${inserts.length} bars

INSERT INTO public.bars (id, name, slug, country, currency, is_active)
VALUES 
${inserts.join(',\n')}
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  country = EXCLUDED.country,
  currency = EXCLUDED.currency,
  is_active = EXCLUDED.is_active;

COMMIT;`);

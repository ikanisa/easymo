#!/usr/bin/env node
import process from 'node:process';
import { Client } from 'pg';

// Bar IDs gleaned from provided menu paste
const BARS = [
  '4d514423-222a-4b51-83ed-5202d3bf005b', // Zion Reggae Bar
  '46105fa8-efc7-422a-afa8-a5188eb2f5ed', // Victoria Gastro Pub
  '96bb748e-e827-4b04-9d18-e7b1df0c0f82', // The Long Hall Irish Pub
  'd215a76f-458e-4d4c-8c58-1cbf60a2d715', // The Londoner Pub Sliema
  '6d3df420-08b9-4b9b-8524-a6d85e99fd43', // The Brew Grill & Brewery
  'b6011a39-9481-4e14-a787-49125f95d2da', // The Brew Bar Grill
  'e07d81ca-ce03-4c99-8688-d1bd631cdd53', // Tex Mex American Bar Grill Paceville
  '0e2c98ed-4bd0-494e-802d-b944e6946e2a', // Surfside
  '31a4dd99-a5d7-4f24-9cd0-5a10501988f4', // Spinola Cafe Lounge St Julians
  '0cae3ec2-67d3-43f1-85f1-c63adfd81078', // Sakura Japanese Cuisine Lounge
  '486f4cc0-1a5d-447d-b85c-d081122b9420', // Peperino Pizza Cucina Verace
  '071e8d00-34ff-4fff-8b90-9dc591842ea5', // Paparazzi 29
  '05c4fd66-1eee-4771-ae21-b54bfee97c71', // Okurama Asian Fusion
  'edad3cca-55e4-4f7b-83d5-9ae07bbe9893', // Mamma Mia Restaurant
  '57161611-ec5e-4106-8cee-3714a7baed8c', // Mamma Mia
  'bc3af07b-8bbd-4cb7-993a-a5199ee4a636', // Fortizza
  '0beab620-baf8-4640-bbf7-967512370a95', // Felice Brasserie
  '6722810f-20dc-43e3-9d94-ee1ab05dce6f', // Exiles
  '088fb339-92a4-4f3b-8dec-6357e44dc508', // Doma Marsascala
  '7725799e-fc20-4ca9-8398-08c79a20a7ec', // Cuba Shoreline
  '15c918bd-31b8-44e1-9548-cb5531055de5', // Cuba Campus Hub
  '376414cd-4fae-4bc6-b305-850467d2be40', // Cafe Cuba St Julians
  '8a7c4d99-0195-42c9-919e-c5bc3f00b76a', // Bus Stop Lounge
  '2ce69916-6f01-4834-b6f2-5d7c64fec538', // Black Bull
  '35af8adb-3ca6-4903-84e6-6b892317ee2c', // Bistro 516
  '25a29714-6db7-4772-ad62-cb7e0d431e3f', // Aqualuna Lido
];

async function main() {
  const { DATABASE_URL } = process.env;
  if (!DATABASE_URL) {
    console.error('Missing DATABASE_URL');
    process.exit(2);
  }
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const barsRes = await client.query(
      'SELECT id, name, country FROM public.bars WHERE id = ANY($1::uuid[]) ORDER BY name',
      [BARS]
    );
    const countsRes = await client.query(
      'SELECT bar_id, COUNT(*)::int AS count FROM public.restaurant_menu_items WHERE bar_id = ANY($1::uuid[]) GROUP BY bar_id',
      [BARS]
    );
    const counts = new Map(countsRes.rows.map((r) => [r.bar_id, r.count]));
    console.log('Bar, Country, Existing Items');
    for (const b of barsRes.rows) {
      console.log(`${b.name}, ${b.country || ''}, ${counts.get(b.id) || 0}`);
    }
  } finally {
    await client.end();
  }
}

main();


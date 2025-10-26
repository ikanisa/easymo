import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, '../fixtures/generated');
const summaryPath = path.join(fixturesDir, 'perf_seed_summary.json');

function deterministicUUID(seed) {
  const hash = createHash('sha1').update(seed).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function assertEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function buildSupabaseClient() {
  const url = assertEnv('SUPABASE_URL');
  const serviceKey = assertEnv('SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

const userFixtures = [
  {
    key: 'perf-admin',
    displayName: 'Perf Admin',
    email: 'perf.admin@example.com',
    msisdn: '+250780900001',
    roles: ['admin', 'station_operator'],
    status: 'active',
    locale: 'en',
    refCode: 'PERFADMIN',
    creditsBalance: 5000,
  },
  {
    key: 'perf-customer-01',
    displayName: 'Perf Customer 01',
    email: 'perf.customer01@example.com',
    msisdn: '+250780900101',
    roles: ['customer'],
    status: 'active',
    locale: 'rw',
    refCode: 'PERF001',
    creditsBalance: 1200,
  },
  {
    key: 'perf-customer-02',
    displayName: 'Perf Customer 02',
    email: 'perf.customer02@example.com',
    msisdn: '+250780900102',
    roles: ['customer'],
    status: 'active',
    locale: 'en',
    refCode: 'PERF002',
    creditsBalance: 900,
  },
  {
    key: 'perf-customer-03',
    displayName: 'Perf Customer 03',
    email: 'perf.customer03@example.com',
    msisdn: '+250780900103',
    roles: ['customer'],
    status: 'active',
    locale: 'en',
    refCode: 'PERF003',
    creditsBalance: 400,
  },
  {
    key: 'perf-customer-04',
    displayName: 'Perf Customer 04',
    email: 'perf.customer04@example.com',
    msisdn: '+250780900104',
    roles: ['customer'],
    status: 'blocked',
    locale: 'en',
    refCode: 'PERF004',
    creditsBalance: 0,
  },
  {
    key: 'perf-customer-05',
    displayName: 'Perf Customer 05',
    email: 'perf.customer05@example.com',
    msisdn: '+250780900105',
    roles: ['customer'],
    status: 'active',
    locale: 'en',
    refCode: 'PERF005',
    creditsBalance: 300,
  },
  {
    key: 'perf-customer-06',
    displayName: 'Perf Customer 06',
    email: 'perf.customer06@example.com',
    msisdn: '+250780900106',
    roles: ['customer'],
    status: 'active',
    locale: 'en',
    refCode: 'PERF006',
    creditsBalance: 150,
  },
  {
    key: 'perf-operator-01',
    displayName: 'Perf Operator 01',
    email: 'perf.operator01@example.com',
    msisdn: '+250780901001',
    roles: ['station_operator'],
    status: 'active',
    locale: 'rw',
    refCode: 'PERFOPS1',
    creditsBalance: 0,
  },
  {
    key: 'perf-operator-02',
    displayName: 'Perf Operator 02',
    email: 'perf.operator02@example.com',
    msisdn: '+250780901002',
    roles: ['station_operator'],
    status: 'active',
    locale: 'en',
    refCode: 'PERFOPS2',
    creditsBalance: 0,
  },
  {
    key: 'perf-support',
    displayName: 'Perf Support',
    email: 'perf.support@example.com',
    msisdn: '+250780902000',
    roles: ['support', 'station_operator'],
    status: 'active',
    locale: 'en',
    refCode: 'PERFSUP',
    creditsBalance: 0,
  },
];

function buildUserId(key) {
  return deterministicUUID(`user:${key}`);
}

async function ensureUsers(client) {
  const created = new Map();
  for (const user of userFixtures) {
    const id = buildUserId(user.key);
    const metadata = {
      display_name: user.displayName,
      roles: user.roles,
      status: user.status,
      msisdn: user.msisdn,
    };
    try {
      const existing = await client.auth.admin.getUserById(id);
      if (!existing?.data?.user) {
        await client.auth.admin.createUser({
          user: {
            id,
            email: user.email,
            email_confirmed: true,
          },
          password: 'PerfSeedPassw0rd!',
          app_metadata: { roles: user.roles },
          user_metadata: metadata,
        });
        console.log(`Created auth user ${user.email}`);
      } else {
        await client.auth.admin.updateUserById(id, {
          email: user.email,
          email_confirm: true,
          user_metadata: metadata,
          app_metadata: { roles: user.roles },
        });
        console.log(`Updated auth user ${user.email}`);
      }
    } catch (error) {
      console.error(`Failed to upsert auth user ${user.email}`, error);
      throw error;
    }
    created.set(user.key, { id, ...user });
  }
  return created;
}

async function upsertProfiles(client, users) {
  const rows = Array.from(users.values()).map((user) => ({
    user_id: user.id,
    whatsapp_e164: user.msisdn,
    locale: user.locale,
    ref_code: user.refCode,
    credits_balance: user.creditsBalance,
    metadata: {
      displayName: user.displayName,
      roles: user.roles,
      status: user.status,
    },
  }));
  const { error } = await client.from('profiles').upsert(rows, { onConflict: 'user_id' });
  if (error) {
    console.error('Failed to upsert profiles', error);
    throw error;
  }
  console.log(`Upserted ${rows.length} profiles`);
}

function buildStationSeeds(users) {
  const operators = Array.from(users.values()).filter((user) => user.roles.includes('station_operator'));
  if (operators.length === 0) {
    throw new Error('No station operators available for station ownership.');
  }
  const seeds = [];
  for (let index = 0; index < 50; index += 1) {
    const operator = operators[index % operators.length];
    const id = deterministicUUID(`station:${index}`);
    const lat = -1.95 + index * 0.0025;
    const lon = 30.05 + index * 0.0025;
    seeds.push({
      id,
      name: `Perf Engen Station ${String(index + 1).padStart(2, '0')}`,
      engencode: `ENG-PERF-${String(index + 1).padStart(3, '0')}`,
      owner_contact: operator.msisdn,
      location_point: `SRID=4326;POINT(${lon.toFixed(6)} ${lat.toFixed(6)})`,
      status: 'active',
      operator,
    });
  }
  return seeds;
}

async function upsertStations(client, stationSeeds) {
  const stationRows = stationSeeds.map(({ operator, ...rest }) => rest);
  const { error } = await client.from('stations').upsert(stationRows, { onConflict: 'engencode' });
  if (error) {
    console.error('Failed to upsert stations', error);
    throw error;
  }
  const engencodes = stationRows.map((station) => station.engencode);
  const { data, error: selectError } = await client
    .from('stations')
    .select('id, name, engencode, owner_contact')
    .in('engencode', engencodes);
  if (selectError) {
    throw selectError;
  }
  console.log(`Upserted ${stationRows.length} stations`);

  // Map station IDs back to operators
  const stationsByEngencode = new Map(data.map((station) => [station.engencode, station]));
  return stationSeeds.map((seed) => ({ ...stationsByEngencode.get(seed.engencode), operator: seed.operator }));
}

async function upsertStationNumbers(client, stations) {
  const rows = stations.map((station) => ({
    station_id: station.id,
    wa_e164: station.owner_contact,
    role: 'manager',
    active: true,
  }));
  const { error } = await client.from('station_numbers').upsert(rows, { onConflict: 'station_id,wa_e164' });
  if (error) {
    console.error('Failed to upsert station numbers', error);
    throw error;
  }
}

function buildCampaignSeeds(users) {
  const admin = users.get('perf-admin');
  const now = new Date();
  const runningId = deterministicUUID('campaign:running');
  const draftId = deterministicUUID('campaign:draft');
  return [
    {
      id: runningId,
      legacy_id: 9001,
      name: 'Perf Running Voucher Campaign',
      type: 'voucher',
      status: 'running',
      template_id: 'promo_generic',
      created_by: admin.id,
      started_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: { segment: 'loyal-customers', throttle: { perMinute: 600 } },
      payload: { template: 'promo_generic', locale: 'rw' },
      target_audience: { tags: ['pilot', 'kw'] },
    },
    {
      id: draftId,
      legacy_id: 9002,
      name: 'Perf Draft Promo Campaign',
      type: 'promo',
      status: 'draft',
      template_id: 'promo_generic',
      created_by: admin.id,
      started_at: null,
      metadata: { segment: 'trial-users' },
      payload: { template: 'promo_generic', locale: 'en' },
      target_audience: { tags: ['reactivation'] },
    },
  ];
}

async function upsertCampaigns(client, campaignSeeds) {
  const { error } = await client.from('campaigns').upsert(campaignSeeds, { onConflict: 'id' });
  if (error) {
    console.error('Failed to upsert campaigns', error);
    throw error;
  }
  console.log(`Upserted ${campaignSeeds.length} campaigns`);
  return campaignSeeds;
}

function buildVoucherSeeds(users, stations) {
  const admin = users.get('perf-admin');
  const customerKeys = ['perf-customer-01', 'perf-customer-02', 'perf-customer-03', 'perf-customer-04', 'perf-customer-05', 'perf-customer-06'];
  const customers = customerKeys.map((key) => users.get(key));
  const statuses = [
    ...Array(8).fill('issued'),
    ...Array(7).fill('sent'),
    'redeemed',
    'redeemed',
    'redeemed',
    'expired',
    'void',
  ];
  const vouchers = statuses.map((status, index) => {
    const customer = customers[index % customers.length];
    const station = stations[index % 5];
    const issuedAt = new Date(Date.now() - (index + 1) * 24 * 60 * 60 * 1000);
    const expiresAt = new Date(Date.now() + (30 - index) * 24 * 60 * 60 * 1000);
    const redeemedAt = status === 'redeemed' ? new Date(issuedAt.getTime() + 2 * 24 * 60 * 60 * 1000) : null;
    const voucherId = deterministicUUID(`voucher:fixture:${index}`);
    const code = `PERF${String(index + 1).padStart(5, '0')}`;
    return {
      id: voucherId,
      user_id: customer.id,
      amount: 2000,
      currency: 'RWF',
      station_scope: station.id,
      code5: code,
      qr_url: `https://cdn.example.com/qr/${code}.svg`,
      png_url: `https://cdn.example.com/vouchers/${code}.png`,
      status,
      issued_at: issuedAt.toISOString(),
      redeemed_at: redeemedAt ? redeemedAt.toISOString() : null,
      expires_at: expiresAt.toISOString(),
      created_by: admin.id,
      campaign_id: index < 10 ? deterministicUUID('campaign:running') : null,
      metadata: { channel: 'whatsapp', seed: 'perf' },
      whatsapp_e164: customer.msisdn,
      policy_number: `PERF-POL-${String(index + 1).padStart(4, '0')}`,
      qr_payload: `QR:${code}`,
      amount_minor: 200000,
      issued_by_admin: admin.id,
      redeemed_by_station_id: redeemedAt ? station.id : null,
      updated_at: new Date().toISOString(),
    };
  });
  return vouchers;
}

function buildRedeemVoucherSeeds(users, stations) {
  const admin = users.get('perf-admin');
  const customers = ['perf-customer-01', 'perf-customer-02', 'perf-customer-03', 'perf-customer-05'].map((key) => users.get(key));
  const vouchers = [];
  let voucherCounter = 1;
  stations.slice(0, 50).forEach((station, stationIndex) => {
    const customer = customers[stationIndex % customers.length];
    for (let i = 0; i < 3; i += 1) {
      const code = `PERFR${String(stationIndex + 1).padStart(3, '0')}${String(i + 1).padStart(2, '0')}`;
      const voucherId = deterministicUUID(`voucher:redeem:${stationIndex}:${i}`);
      vouchers.push({
        id: voucherId,
        user_id: customer.id,
        amount: 2000,
        currency: 'RWF',
        station_scope: station.id,
        code5: code,
        qr_url: `https://cdn.example.com/qr/${code}.svg`,
        png_url: `https://cdn.example.com/vouchers/${code}.png`,
        status: 'issued',
        issued_at: new Date().toISOString(),
        redeemed_at: null,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_by: admin.id,
        campaign_id: null,
        metadata: { channel: 'station', seed: 'perf-redeem' },
        whatsapp_e164: customer.msisdn,
        policy_number: `PERF-R-${String(voucherCounter).padStart(5, '0')}`,
        qr_payload: `QR:${code}`,
        amount_minor: 200000,
        issued_by_admin: admin.id,
        redeemed_by_station_id: null,
        updated_at: new Date().toISOString(),
      });
      voucherCounter += 1;
    }
  });
  return vouchers;
}

async function upsertVouchers(client, vouchers) {
  const chunks = chunk(vouchers, 500);
  for (const [index, batch] of chunks.entries()) {
    const { error } = await client.from('vouchers').upsert(batch, { onConflict: 'id' });
    if (error) {
      console.error(`Failed to upsert vouchers batch ${index + 1}`, error);
      throw error;
    }
  }
  const codes = vouchers.map((voucher) => voucher.code5);
  const { data, error } = await client.from('vouchers').select('id, code5, station_scope, whatsapp_e164, status').in('code5', codes);
  if (error) {
    throw error;
  }
  return data;
}

function buildVoucherEvents(vouchers, adminId) {
  const events = [];
  vouchers.forEach((voucher) => {
    const issuedAt = voucher.issued_at ?? new Date().toISOString();
    events.push({
      voucher_id: voucher.id,
      event_type: 'issued',
      actor_id: adminId,
      station_id: voucher.station_scope,
      context: { channel: 'staging' },
      created_at: issuedAt,
    });
    if (voucher.status === 'sent' || voucher.status === 'redeemed') {
      events.push({
        voucher_id: voucher.id,
        event_type: 'sent',
        actor_id: adminId,
        station_id: voucher.station_scope,
        context: { channel: 'whatsapp' },
        created_at: new Date(new Date(issuedAt).getTime() + 60 * 60 * 1000).toISOString(),
      });
    }
    if (voucher.status === 'redeemed') {
      events.push({
        voucher_id: voucher.id,
        event_type: 'redeemed',
        actor_id: adminId,
        station_id: voucher.station_scope,
        context: { staff: voucher.whatsapp_e164 },
        created_at: voucher.redeemed_at ?? new Date().toISOString(),
      });
    }
  });
  return events;
}

async function upsertVoucherEvents(client, events) {
  const chunks = chunk(events, 500);
  for (const [index, batch] of chunks.entries()) {
    const { error } = await client.from('voucher_events').upsert(batch, { onConflict: 'voucher_id, event_type, created_at' });
    if (error) {
      console.error(`Failed to upsert voucher events batch ${index + 1}`, error);
      throw error;
    }
  }
}

function buildCuratedCampaignTargets(users, campaigns) {
  const runningCampaign = campaigns.find((campaign) => campaign.status === 'running');
  const draftCampaign = campaigns.find((campaign) => campaign.status === 'draft');
  const statuses = ['queued', 'sent', 'delivered', 'failed'];
  const curatedTargets = [];
  const customerKeys = ['perf-customer-01', 'perf-customer-02', 'perf-customer-03', 'perf-customer-04'];
  customerKeys.forEach((key, index) => {
    const customer = users.get(key);
    statuses.forEach((status, statusIndex) => {
      curatedTargets.push({
        id: deterministicUUID(`campaign-target:curated:${index}:${status}`),
        campaign_id: status === 'queued' && index > 1 ? draftCampaign.id : runningCampaign.id,
        msisdn: customer.msisdn,
        user_id: customer.id,
        personalized_vars: { firstName: customer.displayName.split(' ')[2] ?? customer.displayName },
        status,
        error_code: status === 'failed' ? 'wa_63008' : null,
        message_id: status === 'sent' || status === 'delivered' ? `wa-msg-${index}-${statusIndex}` : null,
        last_update_at: new Date(Date.now() - (statusIndex + 1) * 60 * 1000).toISOString(),
      });
    });
  });
  return curatedTargets;
}

function buildBulkCampaignTargets(campaigns) {
  const runningCampaign = campaigns.find((campaign) => campaign.status === 'running');
  const targets = [];
  const baseNumber = 780950000;
  for (let i = 0; i < 10000; i += 1) {
    const msisdn = `+250${baseNumber + i}`;
    targets.push({
      id: deterministicUUID(`campaign-target:bulk:${i}`),
      campaign_id: runningCampaign.id,
      msisdn,
      user_id: null,
      personalized_vars: { locale: i % 2 === 0 ? 'en' : 'rw' },
      status: 'queued',
      error_code: null,
      message_id: null,
      last_update_at: new Date().toISOString(),
    });
  }
  return targets;
}

async function upsertCampaignTargets(client, curated, bulk) {
  const all = [...curated, ...bulk];
  const chunks = chunk(all, 500);
  for (const [index, batch] of chunks.entries()) {
    const { error } = await client.from('campaign_targets').upsert(batch, { onConflict: 'id' });
    if (error) {
      console.error(`Failed to upsert campaign targets batch ${index + 1}`, error);
      throw error;
    }
  }
  console.log(`Upserted ${all.length} campaign targets`);
}

function buildSummary({
  voucherFixtures,
  redeemVouchers,
  stations,
  campaigns,
  curatedTargets,
  bulkTargets,
}) {
  const runningCampaign = campaigns.find((campaign) => campaign.status === 'running');
  const voucherPreviewPayloads = voucherFixtures.map((voucher) => ({
    voucherId: voucher.id,
    code: voucher.code5,
    amount: voucher.amount,
    currency: voucher.currency,
    expiresAt: voucher.expires_at,
    stationScope: voucher.station_scope,
  }));

  const stationRedeemPayloads = stations.map((station) => {
    const assigned = redeemVouchers.filter((voucher) => voucher.station_scope === station.id);
    return {
      stationId: station.id,
      stationCode: station.engencode,
      operator: {
        msisdn: station.owner_contact,
        displayName: station.operator.displayName,
        userId: station.operator.id,
      },
      voucherIds: assigned.map((voucher) => voucher.id),
      voucherCodes: assigned.map((voucher) => voucher.code5),
      token: null,
    };
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    seedVersion: 'perf-load-2025-01',
    voucherPreviewPayloads,
    stationRedeemPayloads,
    campaignDispatch: {
      campaignId: runningCampaign.id,
      batchReference: 'perf-bulk',
      bulkTargetMsisdns: bulkTargets.map((target) => target.msisdn),
    },
    curatedCampaignTargets: curatedTargets.map((target) => ({
      id: target.id,
      status: target.status,
      msisdn: target.msisdn,
    })),
  };

  return summary;
}

async function main() {
  const supabase = buildSupabaseClient();
  console.log('Seeding performance fixtures...');
  const users = await ensureUsers(supabase);
  await upsertProfiles(supabase, users);
  const stationSeeds = buildStationSeeds(users);
  const stations = await upsertStations(supabase, stationSeeds);
  await upsertStationNumbers(supabase, stations);
  const campaigns = await upsertCampaigns(supabase, buildCampaignSeeds(users));

  const voucherFixtures = buildVoucherSeeds(users, stations);
  const redeemVoucherSeeds = buildRedeemVoucherSeeds(users, stations);
  await upsertVouchers(supabase, [...voucherFixtures, ...redeemVoucherSeeds]);
  await upsertVoucherEvents(supabase, buildVoucherEvents(voucherFixtures, users.get('perf-admin').id));

  const curatedTargets = buildCuratedCampaignTargets(users, campaigns);
  const bulkTargets = buildBulkCampaignTargets(campaigns);
  await upsertCampaignTargets(supabase, curatedTargets, bulkTargets);

  const summary = buildSummary({
    voucherFixtures,
    redeemVouchers: redeemVoucherSeeds,
    stations,
    campaigns,
    curatedTargets,
    bulkTargets,
  });

  fs.mkdirSync(fixturesDir, { recursive: true });
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');
  console.log(`Wrote summary to ${summaryPath}`);
  console.log('Performance fixtures seeded successfully.');
}

main().catch((error) => {
  console.error('Performance fixture seeding failed', error);
  process.exitCode = 1;
});

import { Suspense } from 'react';

import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';

import { QrAnalyticsDashboard } from './QrAnalyticsDashboard';

export const dynamic = 'force-dynamic';

async function getQrAnalytics() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return {
      topScanned: [],
      recentScans: [],
      totalTokens: 0,
      totalScans: 0,
      unusedTokens: [],
    };
  }

  const { data: topScanned } = await supabase
    .from('qr_tokens')
    .select('id, table_label, scan_count, last_scan_at, created_at, stations!inner(id, name)')
    .gt('scan_count', 0)
    .order('scan_count', { ascending: false })
    .limit(20);

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentScans } = await supabase
    .from('qr_tokens')
    .select('id, table_label, scan_count, last_scan_at, stations!inner(name)')
    .gte('last_scan_at', oneDayAgo)
    .order('last_scan_at', { ascending: false })
    .limit(50);

  const { count: totalTokens } = await supabase
    .from('qr_tokens')
    .select('*', { count: 'exact', head: true });

  const { data: scanStats } = await supabase
    .from('qr_tokens')
    .select('scan_count');
  
  const totalScans = scanStats?.reduce((sum, row) => sum + (row.scan_count || 0), 0) || 0;

  const { data: unusedTokens } = await supabase
    .from('qr_tokens')
    .select('id, table_label, created_at, stations!inner(name)')
    .eq('scan_count', 0)
    .order('created_at', { ascending: false })
    .limit(50);

  return {
    topScanned: topScanned || [],
    recentScans: recentScans || [],
    totalTokens: totalTokens || 0,
    totalScans,
    unusedTokens: unusedTokens || [],
  };
}

export default async function QrAnalyticsPage() {
  const analytics = await getQrAnalytics();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">QR Code Analytics</h1>
        <p className="mt-2 text-sm text-gray-600">
          Track QR code usage, scan patterns, and table performance
        </p>
      </div>

      <Suspense fallback={<div>Loading analytics...</div>}>
        <QrAnalyticsDashboard analytics={analytics} />
      </Suspense>
    </div>
  );
}

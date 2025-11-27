import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { JobsClient } from './JobsClient';

export const dynamic = 'force-dynamic';

export default async function JobsPage() {
  const supabase = getSupabaseAdminClient();
  
  if (!supabase) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-red-600">Configuration Error</h2>
        <p className="mt-2 text-gray-600">Supabase client could not be initialized. Please check server logs.</p>
      </div>
    );
  }

  const [jobsResult, seekersResult, matchesResult] = await Promise.all([
    supabase.from('job_listings').select('status', { count: 'exact', head: true }),
    supabase.from('job_seekers').select('*', { count: 'exact', head: true }),
    supabase.from('job_matches').select('status', { count: 'exact', head: true }),
  ]);

  const openJobsResult = await supabase
    .from('job_listings')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'open');

  const filledJobsResult = await supabase
    .from('job_listings')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'filled');

  const activeSeekersResult = await supabase
    .from('job_seekers')
    .select('*', { count: 'exact', head: true })
    .gte('last_active', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  const hiredMatchesResult = await supabase
    .from('job_matches')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'hired');

  const { data: recentJobs } = await supabase
    .from('job_listings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  const stats = {
    total_jobs: jobsResult.count || 0,
    open_jobs: openJobsResult.count || 0,
    filled_jobs: filledJobsResult.count || 0,
    total_seekers: seekersResult.count || 0,
    active_seekers: activeSeekersResult.count || 0,
    total_matches: matchesResult.count || 0,
    successful_hires: hiredMatchesResult.count || 0,
  };

  return <JobsClient initialStats={stats} initialJobs={recentJobs || []} />;
}

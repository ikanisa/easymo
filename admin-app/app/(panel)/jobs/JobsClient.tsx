'use client';

import { useState } from 'react';
import { SectionCard } from "@/components/ui/SectionCard";

export interface JobListing {
  id: string;
  title: string;
  description: string;
  category: string;
  job_type: string;
  location: string;
  pay_min: number;
  pay_max: number;
  pay_type: string;
  status: string;
  posted_by: string;
  created_at: string;
  expires_at: string;
}

export interface JobsStats {
  total_jobs: number;
  open_jobs: number;
  filled_jobs: number;
  total_seekers: number;
  active_seekers: number;
  total_matches: number;
  successful_hires: number;
}

interface JobsClientProps {
  initialStats: JobsStats;
  initialJobs: JobListing[];
}

export function JobsClient({ initialStats, initialJobs }: JobsClientProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'jobs' | 'seekers' | 'matches'>('overview');

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Job Board Dashboard</h1>
        <p className="text-gray-600 mt-2">WhatsApp AI-powered job marketplace</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Jobs"
          value={initialStats.total_jobs}
          subtitle={`${initialStats.open_jobs} open`}
          icon="📋"
          color="blue"
        />
        <StatCard
          title="Job Seekers"
          value={initialStats.total_seekers}
          subtitle={`${initialStats.active_seekers} active this week`}
          icon="👥"
          color="green"
        />
        <StatCard
          title="Matches Created"
          value={initialStats.total_matches}
          subtitle={`${initialStats.successful_hires} hired`}
          icon="✨"
          color="purple"
        />
        <StatCard
          title="Fill Rate"
          value={
            initialStats.total_jobs > 0
              ? `${Math.round((initialStats.filled_jobs / initialStats.total_jobs) * 100)}%`
              : '0%'
          }
          subtitle={`${initialStats.filled_jobs} jobs filled`}
          icon="🎯"
          color="orange"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          {(['overview', 'jobs', 'seekers', 'matches'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Recent Jobs</h2>
            <div className="space-y-4">
              {initialJobs.length === 0 ? (
                <p className="text-gray-500">No jobs posted yet</p>
              ) : (
                initialJobs.map((job) => (
                  <div key={job.id} className="border-b border-gray-200 pb-4 last:border-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{job.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {job.description?.substring(0, 100)}
                          {job.description?.length > 100 ? '...' : ''}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                          <span>📍 {job.location}</span>
                          <span>🏷️ {job.category}</span>
                          <span>
                            💰 {job.pay_min && job.pay_max 
                              ? `${job.pay_min}-${job.pay_max} RWF` 
                              : 'Negotiable'}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            job.status === 'open'
                              ? 'bg-green-100 text-green-800'
                              : job.status === 'filled'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {job.status}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-400">
                      Posted by {job.posted_by} • {new Date(job.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Category Distribution</h2>
              <p className="text-gray-500 text-sm">Coming soon: Job category analytics</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Matching Performance</h2>
              <p className="text-gray-500 text-sm">Coming soon: Match quality metrics</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'jobs' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">All Jobs</h2>
          <p className="text-gray-500">Full job listings management coming soon</p>
        </div>
      )}

      {activeTab === 'seekers' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Job Seekers</h2>
          <p className="text-gray-500">Job seeker profiles management coming soon</p>
        </div>
      )}

      {activeTab === 'matches' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Matches & Applications</h2>
          <p className="text-gray-500">Match tracking coming soon</p>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

function StatCard({ title, value, subtitle, icon, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        </div>
        <div className={`text-4xl ${colorClasses[color]} rounded-full w-16 h-16 flex items-center justify-center`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

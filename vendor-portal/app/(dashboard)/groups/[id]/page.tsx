import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Edit, Users, Wallet, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Group, GroupMemberStats } from "@/types/group";
import type { MemberWithRelations } from "@/types/member";

interface GroupDetailPageProps {
  params: { id: string };
}

async function getGroup(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ikimina")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  if (!data) return null;

  return data as Group;
}

async function getGroupStats(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc("get_group_member_stats", { p_ikimina_id: id })
    .single();

  if (error) throw error;
  return data as GroupMemberStats;
}

async function getGroupMembers(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("members")
    .select(
      `
      id,
      member_code,
      full_name,
      msisdn_masked,
      status,
      joined_at,
      accounts:accounts!accounts_member_id_fkey (
        id,
        account_type,
        balance,
        status
      )
    `
    )
    .eq("ikimina_id", id)
    .eq("status", "ACTIVE")
    .order("full_name");

  if (error) throw error;
  return (data || []) as MemberWithRelations[];
}

function formatCurrency(amount: number, currency = "RWF") {
  return new Intl.NumberFormat("en-RW", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: string | null) {
  if (!date) return "N/A";
  return new Intl.DateTimeFormat("en-RW", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

function getStatusBadge(status: string) {
  const variants: Record<string, "default" | "success" | "warning" | "destructive"> = {
    ACTIVE: "success",
    INACTIVE: "warning",
    DISSOLVED: "destructive",
  };
  return <Badge variant={variants[status] || "default"}>{status}</Badge>;
}

export default async function GroupDetailPage({ params }: GroupDetailPageProps) {
  const [group, stats, members] = await Promise.all([
    getGroup(params.id),
    getGroupStats(params.id),
    getGroupMembers(params.id),
  ]);

  if (!group) {
    notFound();
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/groups">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{group.name}</h1>
            <p className="text-muted-foreground">
              {group.code} • {group.type}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/groups/${params.id}/edit`}>
            <Button>
              <Edit className="h-4 w-4 mr-2" />
              Edit Group
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_members}</div>
            <p className="text-xs text-muted-foreground">
              {stats.active_members} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Savings</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.total_savings)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Savings</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.average_savings)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mt-2">{getStatusBadge(group.status)}</div>
            <p className="text-xs text-muted-foreground">
              Started {formatDate(group.start_date)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Group Details */}
      <Card>
        <CardHeader>
          <CardTitle>Group Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Type</p>
              <p className="text-base">{group.type}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Meeting Frequency</p>
              <p className="text-base">{group.meeting_frequency}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Contribution Amount</p>
              <p className="text-base">
                {group.contribution_amount
                  ? formatCurrency(group.contribution_amount, group.currency)
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Payments (Last 30 Days)</p>
              <p className="text-base">{formatCurrency(stats.total_payments_30d)}</p>
            </div>
          </div>
          {group.description && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Description</p>
              <p className="text-base">{group.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Savers */}
      {stats.top_savers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Savers</CardTitle>
            <CardDescription>Members with highest savings balance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.top_savers.map((saver, index) => (
                <div key={saver.member_id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      <span className="text-sm font-medium">{index + 1}</span>
                    </div>
                    <div>
                      <Link
                        href={`/members/${saver.member_id}`}
                        className="font-medium hover:underline"
                      >
                        {saver.full_name}
                      </Link>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(saver.balance)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Members List */}
      <Card>
        <CardHeader>
          <CardTitle>Members ({members.length})</CardTitle>
          <CardDescription>All active members in this group</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {members.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No members yet</p>
            ) : (
              <div className="divide-y">
                {members.map((member) => {
                  const totalBalance = (member.accounts || [])
                    .filter((acc) => acc.status === "ACTIVE")
                    .reduce((sum, acc) => sum + (acc.balance || 0), 0);

                  return (
                    <div key={member.id} className="flex items-center justify-between py-4">
                      <div>
                        <Link
                          href={`/members/${member.id}`}
                          className="font-medium hover:underline"
                        >
                          {member.full_name}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          {member.member_code} • {member.msisdn_masked}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(totalBalance)}</p>
                        <p className="text-xs text-muted-foreground">
                          Joined {formatDate(member.joined_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Edit, UserCircle, Wallet, History, Activity } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MemberSummary, MemberPaymentHistory, MemberActivity } from "@/types/member";

interface MemberDetailPageProps {
  params: { id: string };
}

async function getMemberDetails(id: string) {
  const supabase = await createClient();

  const { data: summary, error } = await supabase
    .rpc("get_member_summary", { p_member_id: id })
    .single();

  if (error) throw error;
  if (!summary) return null;

  return summary as MemberSummary;
}

async function getMemberPayments(id: string, limit = 10) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_member_payment_history", {
    p_member_id: id,
    p_limit: limit,
    p_offset: 0,
  });

  if (error) throw error;
  return (data || []) as MemberPaymentHistory[];
}

async function getMemberActivity(id: string, limit = 10) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_member_activity", {
    p_member_id: id,
    p_limit: limit,
  });

  if (error) throw error;
  return (data || []) as MemberActivity[];
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
    SUSPENDED: "destructive",
  };
  return <Badge variant={variants[status] || "default"}>{status}</Badge>;
}

export default async function MemberDetailPage({ params }: MemberDetailPageProps) {
  const [member, payments, activity] = await Promise.all([
    getMemberDetails(params.id),
    getMemberPayments(params.id),
    getMemberActivity(params.id),
  ]);

  if (!member) {
    notFound();
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/members">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{member.full_name}</h1>
            <p className="text-muted-foreground">
              {member.member_code} • {member.ikimina_name || "No Group"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/members/${params.id}/edit`}>
            <Button>
              <Edit className="h-4 w-4 mr-2" />
              Edit Member
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(member.total_balance)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(member.total_paid)}</div>
            <p className="text-xs text-muted-foreground">{member.total_payments} payments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Payment</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDate(member.last_payment_date)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <UserCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="mt-2">{getStatusBadge(member.status)}</div>
            <p className="text-xs text-muted-foreground">Joined {formatDate(member.joined_at)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Details Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Member Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Phone Number</p>
                  <p className="text-base">{member.msisdn_masked || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  <p className="text-base">{member.email || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Member Code</p>
                  <p className="text-base font-mono">{member.member_code}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Group</p>
                  <p className="text-base">{member.ikimina_name || "No Group"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment Statistics (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Payments Count</p>
                  <p className="text-2xl font-bold">{member.payment_count_30d}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Average Payment</p>
                  <p className="text-2xl font-bold">{formatCurrency(member.average_payment)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Payments</CardTitle>
              <CardDescription>Last {payments.length} payment transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {payments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No payments yet</p>
                ) : (
                  payments.map((payment) => (
                    <div
                      key={payment.payment_id}
                      className="flex items-center justify-between border-b pb-4 last:border-0"
                    >
                      <div>
                        <p className="font-medium">{formatCurrency(payment.amount, payment.currency)}</p>
                        <p className="text-sm text-muted-foreground">
                          {payment.payment_method || "Unknown"} • {formatDate(payment.created_at)}
                        </p>
                        {payment.reference && (
                          <p className="text-xs text-muted-foreground font-mono">{payment.reference}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <Badge variant="outline">{payment.account_type || "N/A"}</Badge>
                        <p className="text-sm text-muted-foreground mt-1">
                          Balance: {formatCurrency(payment.running_balance)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
              <CardDescription>Recent account activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activity.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No recent activity</p>
                ) : (
                  activity.map((item) => (
                    <div key={item.activity_id} className="flex gap-4 border-b pb-4 last:border-0">
                      <div className="flex-shrink-0">
                        <Activity className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{item.description}</p>
                        <p className="text-sm text-muted-foreground">{formatDate(item.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(item.amount)}</p>
                        <Badge variant="outline" className="mt-1">
                          {item.activity_type}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

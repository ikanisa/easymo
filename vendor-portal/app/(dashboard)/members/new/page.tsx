"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { MemberForm } from "../components";

const SACCO_ID = "550e8400-e29b-41d4-a716-446655440000";

export default function NewMemberPage() {
  const router = useRouter();
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const response = await fetch(`/api/groups?sacco_id=${SACCO_ID}`);
      if (!response.ok) throw new Error("Failed to fetch groups");
      const data = await response.json();
      setGroups(data.data || []);
    } catch (error) {
      console.error("Error fetching groups:", error);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/members">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Members
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Add New Member</h1>
        <p className="text-muted-foreground">Create a new SACCO member and account</p>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Member Information</CardTitle>
          <CardDescription>Enter the member's details below</CardDescription>
        </CardHeader>
        <CardContent>
          <MemberForm saccoId={SACCO_ID} groups={groups} />
        </CardContent>
      </Card>
    </div>
  );
}

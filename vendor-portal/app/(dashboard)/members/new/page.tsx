"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewMemberPage() {
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const memberData = {
      sacco_id: "550e8400-e29b-41d4-a716-446655440000",
      ikimina_id: formData.get("ikimina_id") as string,
      full_name: formData.get("full_name") as string,
      phone: formData.get("phone") as string,
      national_id: formData.get("national_id") as string || undefined,
      email: formData.get("email") as string || undefined,
    };

    try {
      const response = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(memberData),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || "Failed to create member");
        return;
      }

      const result = await response.json();
      alert(result.message);
      router.push("/members");
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to create member");
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
        <p className="text-muted-foreground">Create a new SACCO member</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <div className="space-y-2">
          <Label htmlFor="full_name">Full Name *</Label>
          <Input id="full_name" name="full_name" required placeholder="John Doe" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number *</Label>
          <Input id="phone" name="phone" type="tel" required placeholder="0781234567" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ikimina_id">Group ID *</Label>
          <Input id="ikimina_id" name="ikimina_id" required placeholder="UUID" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="national_id">National ID</Label>
          <Input id="national_id" name="national_id" placeholder="1199012345678901" maxLength={16} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="john@example.com" />
        </div>

        <div className="flex gap-4">
          <Button type="submit">Create Member</Button>
          <Button type="button" variant="outline" onClick={() => router.push("/members")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

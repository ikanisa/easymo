"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { UserTable } from "@/components/features/users/UserTable";
import { Button } from "@/components/ui/Button";
import { Plus } from "lucide-react";
import { useState } from "react";

// Mock data
const mockUsers = [
  {
    id: "1",
    name: "John Doe",
    email: "john@example.com",
    role: "admin" as const,
    status: "active" as const,
    lastActive: "2 mins ago",
  },
  {
    id: "2",
    name: "Jane Smith",
    email: "jane@example.com",
    role: "agent" as const,
    status: "active" as const,
    lastActive: "1 hour ago",
  },
  {
    id: "3",
    name: "Bob Wilson",
    email: "bob@example.com",
    role: "user" as const,
    status: "inactive" as const,
    lastActive: "2 days ago",
  },
];

export default function UsersPage() {
  const [users, setUsers] = useState(mockUsers);

  const handleEdit = (user: any) => {
    console.log("Edit user:", user);
  };

  const handleDelete = (user: any) => {
    console.log("Delete user:", user);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Users</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage system users and their roles.
            </p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </div>

        <UserTable users={users} onEdit={handleEdit} onDelete={handleDelete} />
      </div>
    </DashboardLayout>
  );
}

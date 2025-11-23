"use client";

import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { useState } from "react";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "inactive";
  avatar?: string;
}

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: User;
  mode: "view" | "edit" | "create";
}

export function UserModal({ isOpen, onClose, user, mode }: UserModalProps) {
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    role: string;
    status: "active" | "inactive";
  }>({
    name: user?.name || "",
    email: user?.email || "",
    role: user?.role || "user",
    status: user?.status || "active",
  });

  const isReadOnly = mode === "view";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission
    console.log("Form submitted:", formData);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === "create" ? "Create User" : mode === "edit" ? "Edit User" : "User Details"}
      description={mode === "view" ? "View user information" : "Manage user account"}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* User Avatar */}
        {user && mode === "view" && (
          <div className="flex items-center gap-4 pb-4 border-b">
            <Avatar src={user.avatar} fallback={user.name} />
            <div>
              <h3 className="font-semibold text-gray-900">{user.name}</h3>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
            <Badge
              variant={user.status === "active" ? "success" : "secondary"}
              className="ml-auto capitalize"
            >
              {user.status}
            </Badge>
          </div>
        )}

        {/* Form Fields */}
        <div className="space-y-4">
          <Input
            label="Full Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            disabled={isReadOnly}
            required
          />
          <Input
            label="Email Address"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            disabled={isReadOnly}
            required
          />
          <Select
            label="Role"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            disabled={isReadOnly}
            options={[
              { label: "User", value: "user" },
              { label: "Admin", value: "admin" },
              { label: "Manager", value: "manager" },
            ]}
          />
          <Select
            label="Status"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as "active" | "inactive" })}
            disabled={isReadOnly}
            options={[
              { label: "Active", value: "active" },
              { label: "Inactive", value: "inactive" },
            ]}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="secondary" onClick={onClose}>
            {isReadOnly ? "Close" : "Cancel"}
          </Button>
          {!isReadOnly && (
            <Button type="submit">
              {mode === "create" ? "Create User" : "Save Changes"}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}

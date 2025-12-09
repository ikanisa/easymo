"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { CreateMemberInput, UpdateMemberInput } from "@/types/member";

interface MemberFormProps {
  saccoId: string;
  initialData?: UpdateMemberInput & { id?: string };
  groups?: Array<{ id: string; name: string; code: string }>;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function MemberForm({ saccoId, initialData, groups = [], onSuccess, onCancel }: MemberFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    full_name: initialData?.full_name || "",
    phone: initialData?.phone || "",
    national_id: initialData?.national_id || "",
    email: initialData?.email || "",
    gender: initialData?.gender || "",
    date_of_birth: initialData?.date_of_birth || "",
    ikimina_id: initialData?.ikimina_id || (groups[0]?.id || ""),
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.full_name || formData.full_name.length < 2) {
      newErrors.full_name = "Name must be at least 2 characters";
    }

    if (!formData.phone) {
      newErrors.phone = "Phone number is required";
    } else if (!/^(\+?250)?0?7[2389]\d{7}$/.test(formData.phone)) {
      newErrors.phone = "Invalid Rwanda phone number";
    }

    if (formData.national_id && !/^[12]\d{15}$/.test(formData.national_id)) {
      newErrors.national_id = "Invalid National ID (must be 16 digits)";
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email address";
    }

    if (!formData.ikimina_id) {
      newErrors.ikimina_id = "Group is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const isUpdate = !!initialData?.id;
      const url = isUpdate ? `/api/members/${initialData.id}` : "/api/members";
      const method = isUpdate ? "PUT" : "POST";

      const payload = isUpdate
        ? formData
        : {
            sacco_id: saccoId,
            ...formData,
          };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.details || "Failed to save member");
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/members");
        router.refresh();
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save member");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {/* Full Name */}
        <div className="space-y-2">
          <Label htmlFor="full_name">
            Full Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="full_name"
            value={formData.full_name}
            onChange={(e) => handleChange("full_name", e.target.value)}
            placeholder="Jean Bosco Niyonsenga"
            className={errors.full_name ? "border-red-500" : ""}
          />
          {errors.full_name && <p className="text-sm text-red-500">{errors.full_name}</p>}
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="phone">
            Phone Number <span className="text-red-500">*</span>
          </Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            placeholder="0788123456"
            className={errors.phone ? "border-red-500" : ""}
          />
          {errors.phone && <p className="text-sm text-red-500">{errors.phone}</p>}
        </div>

        {/* National ID */}
        <div className="space-y-2">
          <Label htmlFor="national_id">National ID (Optional)</Label>
          <Input
            id="national_id"
            value={formData.national_id}
            onChange={(e) => handleChange("national_id", e.target.value)}
            placeholder="1199580012345678"
            maxLength={16}
            className={errors.national_id ? "border-red-500" : ""}
          />
          {errors.national_id && <p className="text-sm text-red-500">{errors.national_id}</p>}
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email">Email (Optional)</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange("email", e.target.value)}
            placeholder="member@example.com"
            className={errors.email ? "border-red-500" : ""}
          />
          {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
        </div>

        {/* Gender */}
        <div className="space-y-2">
          <Label htmlFor="gender">Gender (Optional)</Label>
          <Select value={formData.gender} onValueChange={(value) => handleChange("gender", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Date of Birth */}
        <div className="space-y-2">
          <Label htmlFor="date_of_birth">Date of Birth (Optional)</Label>
          <Input
            id="date_of_birth"
            type="date"
            value={formData.date_of_birth}
            onChange={(e) => handleChange("date_of_birth", e.target.value)}
            max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split("T")[0]}
          />
        </div>

        {/* Group */}
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="ikimina_id">
            Group <span className="text-red-500">*</span>
          </Label>
          <Select value={formData.ikimina_id} onValueChange={(value) => handleChange("ikimina_id", value)}>
            <SelectTrigger className={errors.ikimina_id ? "border-red-500" : ""}>
              <SelectValue placeholder="Select a group" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name} ({group.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.ikimina_id && <p className="text-sm text-red-500">{errors.ikimina_id}</p>}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {initialData?.id ? "Update" : "Create"} Member
        </Button>
      </div>
    </form>
  );
}

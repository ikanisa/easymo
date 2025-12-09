"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

export interface MemberFilters {
  search: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "all";
  ikimina_id: string;
  sort_by: "full_name" | "created_at" | "joined_at" | "member_code";
  sort_order: "asc" | "desc";
}

interface MemberFiltersProps {
  filters: MemberFilters;
  onChange: (filters: MemberFilters) => void;
  groups?: Array<{ id: string; name: string; code: string }>;
}

export function MemberFiltersComponent({ filters, onChange, groups = [] }: MemberFiltersProps) {
  const handleFilterChange = (key: keyof MemberFilters, value: any) => {
    onChange({ ...filters, [key]: value });
  };

  const handleClearFilters = () => {
    onChange({
      search: "",
      status: "ACTIVE",
      ikimina_id: "",
      sort_by: "full_name",
      sort_order: "asc",
    });
  };

  const hasActiveFilters =
    filters.search !== "" || filters.status !== "ACTIVE" || filters.ikimina_id !== "" || filters.sort_by !== "full_name" || filters.sort_order !== "asc";

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Filters</h3>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={handleClearFilters}>
            <X className="mr-1 h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Search */}
        <div className="space-y-2">
          <Label htmlFor="search">Search</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Name, code, phone..."
              value={filters.search}
              onChange={(e) => handleFilterChange("search", e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={filters.status} onValueChange={(value) => handleFilterChange("status", value)}>
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
              <SelectItem value="SUSPENDED">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Group */}
        {groups.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="group">Group</Label>
            <Select value={filters.ikimina_id} onValueChange={(value) => handleFilterChange("ikimina_id", value)}>
              <SelectTrigger id="group">
                <SelectValue placeholder="All Groups" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Groups</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Sort */}
        <div className="space-y-2">
          <Label htmlFor="sort">Sort By</Label>
          <div className="flex gap-2">
            <Select value={filters.sort_by} onValueChange={(value: any) => handleFilterChange("sort_by", value)}>
              <SelectTrigger id="sort" className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full_name">Name</SelectItem>
                <SelectItem value="member_code">Code</SelectItem>
                <SelectItem value="joined_at">Join Date</SelectItem>
                <SelectItem value="created_at">Created</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.sort_order} onValueChange={(value: any) => handleFilterChange("sort_order", value)}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">↑ Asc</SelectItem>
                <SelectItem value="desc">↓ Desc</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}

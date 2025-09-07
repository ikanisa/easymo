import React, { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  id: string;
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  filterType?: "text" | "select" | "multiselect";
  filterOptions?: { value: string; label: string }[];
  searchWeight?: number; // For weighted search scoring
  searchable?: boolean;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  emptyMessage?: string;
  enableGlobalSearch?: boolean;
  enableFilters?: boolean;
  className?: string;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  searchPlaceholder = "Search...",
  emptyMessage = "No data found",
  enableGlobalSearch = true,
  enableFilters = true,
  className,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<{
    column: string;
    direction: "asc" | "desc";
  } | null>(null);
  
  const [globalSearch, setGlobalSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string | string[]>>({});
  const [showFilters, setShowFilters] = useState(false);

  // Smart search function with semantic matching
  const smartSearch = (item: T, searchTerm: string): number => {
    if (!searchTerm.trim()) return 1;
    
    const searchTerms = searchTerm.toLowerCase().split(/\s+/);
    let totalScore = 0;
    let maxPossibleScore = 0;

    columns.forEach((column) => {
      if (column.searchable === false) return;
      
      const weight = column.searchWeight || 1;
      maxPossibleScore += weight;
      
      let value = "";
      if (column.accessorKey) {
        const cellValue = item[column.accessorKey];
        value = String(cellValue || "").toLowerCase();
      } else if (column.cell) {
        // For custom cells, try to extract text content
        const cellNode = column.cell(item);
        if (typeof cellNode === "string") {
          value = cellNode.toLowerCase();
        } else if (React.isValidElement(cellNode)) {
          value = extractTextFromReactNode(cellNode).toLowerCase();
        }
      }

      if (!value) return;

      // Calculate match score for this column
      let columnScore = 0;
      
      searchTerms.forEach((term) => {
        if (value.includes(term)) {
          // Exact substring match
          columnScore += weight * 0.8;
          
          // Bonus for exact word match
          if (value.split(/\s+/).some(word => word === term)) {
            columnScore += weight * 0.2;
          }
          
          // Bonus for starts with
          if (value.startsWith(term)) {
            columnScore += weight * 0.3;
          }
        } else {
          // Fuzzy matching for typos
          const similarity = calculateSimilarity(term, value);
          if (similarity > 0.7) {
            columnScore += weight * similarity * 0.4;
          }
        }
      });

      totalScore += Math.min(columnScore, weight);
    });

    return maxPossibleScore > 0 ? totalScore / maxPossibleScore : 0;
  };

  // Helper function to extract text from React nodes
  const extractTextFromReactNode = (node: React.ReactNode): string => {
    if (typeof node === "string" || typeof node === "number") {
      return String(node);
    }
    if (React.isValidElement(node) && node.props.children) {
      return extractTextFromReactNode(node.props.children);
    }
    if (Array.isArray(node)) {
      return node.map(extractTextFromReactNode).join(" ");
    }
    return "";
  };

  // Simple similarity calculation
  const calculateSimilarity = (str1: string, str2: string): number => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1;
    
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  };

  // Levenshtein distance for fuzzy matching
  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[j][i] = matrix[j - 1][i - 1];
        } else {
          matrix[j][i] = Math.min(
            matrix[j - 1][i - 1] + 1,
            matrix[j][i - 1] + 1,
            matrix[j - 1][i] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  };

  // Filter and sort data
  const processedData = useMemo(() => {
    let filtered = [...data];

    // Apply global search with smart scoring
    if (enableGlobalSearch && globalSearch.trim()) {
      const scored = filtered.map(item => ({
        item,
        score: smartSearch(item, globalSearch)
      }));
      
      // Filter items with score > 0 and sort by score
      filtered = scored
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ item }) => item);
    }

    // Apply column filters
    if (enableFilters) {
      Object.entries(columnFilters).forEach(([columnId, filterValue]) => {
        if (!filterValue || (Array.isArray(filterValue) && filterValue.length === 0)) return;
        
        const column = columns.find(col => col.id === columnId);
        if (!column || !column.accessorKey) return;

        filtered = filtered.filter(item => {
          const cellValue = String(item[column.accessorKey!] || "").toLowerCase();
          
          if (Array.isArray(filterValue)) {
            return filterValue.some(val => cellValue.includes(val.toLowerCase()));
          }
          
          return cellValue.includes(String(filterValue).toLowerCase());
        });
      });
    }

    // Apply sorting
    if (sorting) {
      const column = columns.find(col => col.id === sorting.column);
      if (column && column.accessorKey) {
        filtered.sort((a, b) => {
          const aValue = a[column.accessorKey!];
          const bValue = b[column.accessorKey!];
          
          let comparison = 0;
          if (aValue < bValue) comparison = -1;
          if (aValue > bValue) comparison = 1;
          
          return sorting.direction === "desc" ? -comparison : comparison;
        });
      }
    }

    return filtered;
  }, [data, globalSearch, columnFilters, sorting, columns, enableGlobalSearch, enableFilters]);

  const handleSort = (columnId: string) => {
    const column = columns.find(col => col.id === columnId);
    if (!column || !column.sortable) return;

    setSorting(prev => {
      if (prev?.column === columnId) {
        if (prev.direction === "asc") return { column: columnId, direction: "desc" };
        if (prev.direction === "desc") return null;
      }
      return { column: columnId, direction: "asc" };
    });
  };

  const updateColumnFilter = (columnId: string, value: string | string[]) => {
    setColumnFilters(prev => ({
      ...prev,
      [columnId]: value
    }));
  };

  const clearFilters = () => {
    setColumnFilters({});
    setGlobalSearch("");
  };

  const getSortIcon = (columnId: string) => {
    if (sorting?.column !== columnId) return <ArrowUpDown className="h-4 w-4" />;
    return sorting.direction === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const hasActiveFilters = Object.values(columnFilters).some(value => 
    Array.isArray(value) ? value.length > 0 : Boolean(value)
  ) || Boolean(globalSearch);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search and Filter Controls */}
      <div className="flex items-center justify-between gap-4">
        {enableGlobalSearch && (
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder={searchPlaceholder}
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        )}
        
        <div className="flex items-center gap-2">
          {enableFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(showFilters && "bg-muted")}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 text-xs">
                  !
                </Badge>
              )}
            </Button>
          )}
          
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-2" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Column Filters */}
      {enableFilters && showFilters && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/50">
          {columns
            .filter(column => column.filterable)
            .map(column => (
              <div key={column.id} className="space-y-2">
                <label className="text-sm font-medium">{column.header}</label>
                {column.filterType === "select" && column.filterOptions ? (
                  <Select
                    value={columnFilters[column.id] as string || ""}
                    onValueChange={(value) => updateColumnFilter(column.id, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Filter ${column.header}`} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All</SelectItem>
                      {column.filterOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    placeholder={`Filter ${column.header}`}
                    value={columnFilters[column.id] as string || ""}
                    onChange={(e) => updateColumnFilter(column.id, e.target.value)}
                  />
                )}
              </div>
            ))}
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.id}>
                  {column.sortable ? (
                    <Button
                      variant="ghost"
                      className="h-auto p-0 font-medium hover:bg-transparent"
                      onClick={() => handleSort(column.id)}
                    >
                      {column.header}
                      {getSortIcon(column.id)}
                    </Button>
                  ) : (
                    column.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {processedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              processedData.map((item, index) => (
                <TableRow key={index}>
                  {columns.map((column) => (
                    <TableCell key={column.id}>
                      {column.cell
                        ? column.cell(item)
                        : column.accessorKey
                        ? String(item[column.accessorKey] || "")
                        : ""}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Results info */}
      {processedData.length > 0 && data.length !== processedData.length && (
        <div className="text-sm text-muted-foreground">
          Showing {processedData.length} of {data.length} results
        </div>
      )}
    </div>
  );
}
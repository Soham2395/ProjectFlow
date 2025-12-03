"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SearchFilters } from "@/lib/search-utils";

interface FilterChipsProps {
    filters: SearchFilters;
    onRemoveFilter: (key: keyof SearchFilters) => void;
    onClearAll: () => void;
    members?: Array<{ id: string; name: string | null }>;
    labels?: Array<{ id: string; name: string; color: string }>;
}

export function FilterChips({
    filters,
    onRemoveFilter,
    onClearAll,
    members = [],
    labels = [],
}: FilterChipsProps) {
    const activeFilters: Array<{ key: keyof SearchFilters; label: string; value: string }> = [];

    // Build active filter list
    if (filters.q) {
        activeFilters.push({ key: "q", label: "Search", value: filters.q });
    }

    if (filters.status && filters.status.length > 0) {
        activeFilters.push({
            key: "status",
            label: "Status",
            value: filters.status.map((s) => s.replace("_", " ")).join(", "),
        });
    }

    if (filters.priority && filters.priority.length > 0) {
        activeFilters.push({
            key: "priority",
            label: "Priority",
            value: filters.priority.join(", "),
        });
    }

    if (filters.assigneeId) {
        const assignee = members.find((m) => m.id === filters.assigneeId);
        activeFilters.push({
            key: "assigneeId",
            label: "Assignee",
            value: assignee?.name || "Unknown",
        });
    }

    if (filters.labelId) {
        const label = labels.find((l) => l.id === filters.labelId);
        activeFilters.push({
            key: "labelId",
            label: "Label",
            value: label?.name || "Unknown",
        });
    }

    if (filters.dueBefore) {
        activeFilters.push({
            key: "dueBefore",
            label: "Due before",
            value: new Date(filters.dueBefore).toLocaleDateString(),
        });
    }

    if (filters.dueAfter) {
        activeFilters.push({
            key: "dueAfter",
            label: "Due after",
            value: new Date(filters.dueAfter).toLocaleDateString(),
        });
    }

    if (activeFilters.length === 0) return null;

    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Filters:</span>
            {activeFilters.map((filter) => (
                <Badge key={filter.key} variant="secondary" className="gap-1 pr-1">
                    <span className="font-medium">{filter.label}:</span>
                    <span className="capitalize">{filter.value}</span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 rounded-full hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => onRemoveFilter(filter.key)}
                    >
                        <X className="h-3 w-3" />
                    </Button>
                </Badge>
            ))}
            {activeFilters.length > 1 && (
                <Button variant="ghost" size="sm" onClick={onClearAll} className="h-7 text-xs">
                    Clear all
                </Button>
            )}
        </div>
    );
}

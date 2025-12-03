"use client";

import { useState } from "react";
import { Filter, X, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { SearchFilters } from "@/lib/search-utils";

interface AdvancedFilterPanelProps {
    filters: SearchFilters;
    onFilterChange: (key: keyof SearchFilters, value: any) => void;
    onClearFilters: () => void;
    members: Array<{ id: string; name: string | null; image: string | null }>;
    labels: Array<{ id: string; name: string; color: string }>;
}

const STATUS_OPTIONS = [
    { value: "todo", label: "Todo" },
    { value: "in_progress", label: "In Progress" },
    { value: "done", label: "Done" },
];

const PRIORITY_OPTIONS = [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
    { value: "urgent", label: "Urgent" },
];

const DUE_DATE_PRESETS = [
    { value: "overdue", label: "Overdue" },
    { value: "today", label: "Today" },
    { value: "this_week", label: "This Week" },
    { value: "this_month", label: "This Month" },
];

export function AdvancedFilterPanel({
    filters,
    onFilterChange,
    onClearFilters,
    members,
    labels,
}: AdvancedFilterPanelProps) {
    const [searchText, setSearchText] = useState(filters.q || "");

    const handleStatusToggle = (status: string) => {
        const current = filters.status || [];
        const updated = current.includes(status)
            ? current.filter((s) => s !== status)
            : [...current, status];
        onFilterChange("status", updated.length > 0 ? updated : undefined);
    };

    const handlePriorityToggle = (priority: string) => {
        const current = filters.priority || [];
        const updated = current.includes(priority)
            ? current.filter((p) => p !== priority)
            : [...current, priority];
        onFilterChange("priority", updated.length > 0 ? updated : undefined);
    };

    const handleSearchChange = (value: string) => {
        setSearchText(value);
        onFilterChange("q", value.trim() || undefined);
    };

    const handleDueDatePreset = (preset: string) => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        switch (preset) {
            case "overdue":
                onFilterChange("dueBefore", today.toISOString());
                break;
            case "today":
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                onFilterChange("dueAfter", today.toISOString());
                onFilterChange("dueBefore", tomorrow.toISOString());
                break;
            case "this_week":
                const weekEnd = new Date(today);
                weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));
                onFilterChange("dueAfter", today.toISOString());
                onFilterChange("dueBefore", weekEnd.toISOString());
                break;
            case "this_month":
                const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                onFilterChange("dueAfter", today.toISOString());
                onFilterChange("dueBefore", monthEnd.toISOString());
                break;
        }
    };

    const activeFilterCount = [
        filters.q,
        filters.status?.length,
        filters.priority?.length,
        filters.assigneeId,
        filters.labelId,
        filters.dueBefore,
        filters.dueAfter,
    ].filter(Boolean).length;

    return (
        <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative w-64">
                <Input
                    placeholder="Search tasks..."
                    value={searchText}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="h-9"
                />
                {searchText && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1 h-7 w-7"
                        onClick={() => handleSearchChange("")}
                    >
                        <X className="h-3 w-3" />
                    </Button>
                )}
            </div>

            {/* Status Filter */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9">
                        Status
                        {filters.status && filters.status.length > 0 && (
                            <Badge variant="secondary" className="ml-2 h-5 px-1 text-xs">
                                {filters.status.length}
                            </Badge>
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {STATUS_OPTIONS.map((option) => (
                        <DropdownMenuItem
                            key={option.value}
                            onClick={(e) => {
                                e.preventDefault();
                                handleStatusToggle(option.value);
                            }}
                            className="flex items-center gap-2"
                        >
                            <Checkbox
                                checked={filters.status?.includes(option.value) || false}
                                onCheckedChange={() => handleStatusToggle(option.value)}
                            />
                            <span>{option.label}</span>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Priority Filter */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9">
                        Priority
                        {filters.priority && filters.priority.length > 0 && (
                            <Badge variant="secondary" className="ml-2 h-5 px-1 text-xs">
                                {filters.priority.length}
                            </Badge>
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuLabel>Filter by Priority</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {PRIORITY_OPTIONS.map((option) => (
                        <DropdownMenuItem
                            key={option.value}
                            onClick={(e) => {
                                e.preventDefault();
                                handlePriorityToggle(option.value);
                            }}
                            className="flex items-center gap-2"
                        >
                            <Checkbox
                                checked={filters.priority?.includes(option.value) || false}
                                onCheckedChange={() => handlePriorityToggle(option.value)}
                            />
                            <span>{option.label}</span>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Assignee Filter */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9">
                        Assignee
                        {filters.assigneeId && <Badge variant="secondary" className="ml-2 h-5 px-1 text-xs">1</Badge>}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel>Filter by Assignee</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {members.map((member) => (
                        <DropdownMenuItem
                            key={member.id}
                            onClick={() =>
                                onFilterChange("assigneeId", filters.assigneeId === member.id ? undefined : member.id)
                            }
                            className="flex items-center gap-2"
                        >
                            <Checkbox checked={filters.assigneeId === member.id} />
                            <Avatar className="h-6 w-6">
                                <AvatarImage src={member.image || undefined} />
                                <AvatarFallback className="text-xs">
                                    {member.name?.[0]?.toUpperCase() || "?"}
                                </AvatarFallback>
                            </Avatar>
                            <span>{member.name || "Unknown"}</span>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Labels Filter */}
            {labels.length > 0 && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9">
                            Labels
                            {filters.labelId && <Badge variant="secondary" className="ml-2 h-5 px-1 text-xs">1</Badge>}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                        <DropdownMenuLabel>Filter by Label</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {labels.map((label) => (
                            <DropdownMenuItem
                                key={label.id}
                                onClick={() =>
                                    onFilterChange("labelId", filters.labelId === label.id ? undefined : label.id)
                                }
                                className="flex items-center gap-2"
                            >
                                <Checkbox checked={filters.labelId === label.id} />
                                <div
                                    className="h-3 w-3 rounded-full"
                                    style={{ backgroundColor: label.color }}
                                />
                                <span>{label.name}</span>
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}

            {/* Due Date Filter */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9">
                        <Calendar className="mr-2 h-4 w-4" />
                        Due Date
                        {(filters.dueBefore || filters.dueAfter) && (
                            <Badge variant="secondary" className="ml-2 h-5 px-1 text-xs">1</Badge>
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuLabel>Filter by Due Date</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {DUE_DATE_PRESETS.map((preset) => (
                        <DropdownMenuItem
                            key={preset.value}
                            onClick={() => handleDueDatePreset(preset.value)}
                        >
                            {preset.label}
                        </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={() => {
                            onFilterChange("dueBefore", undefined);
                            onFilterChange("dueAfter", undefined);
                        }}
                    >
                        Clear date filters
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Clear All Filters */}
            {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={onClearFilters} className="h-9">
                    <X className="mr-1 h-4 w-4" />
                    Clear all ({activeFilterCount})
                </Button>
            )}
        </div>
    );
}

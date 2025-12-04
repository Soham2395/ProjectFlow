"use client";

import { useState } from "react";
import { useOrganization, Organization } from "./organization-provider";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Building2, Check, ChevronsUpDown, Plus, Settings } from "lucide-react";
import Link from "next/link";

export function OrgSwitcher() {
    const { organizations, currentOrg, setCurrentOrgId, isLoading } = useOrganization();
    const [open, setOpen] = useState(false);

    if (isLoading) {
        return (
            <div className="flex h-9 w-36 animate-pulse items-center rounded-md bg-muted px-3">
                <div className="h-4 w-full rounded bg-muted-foreground/20" />
            </div>
        );
    }

    if (organizations.length === 0) {
        return (
            <Link href="/org/new">
                <Button variant="outline" size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create Organization
                </Button>
            </Link>
        );
    }

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="w-44 justify-between gap-2 font-normal"
                    aria-label="Select organization"
                >
                    <div className="flex items-center gap-2 truncate">
                        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{currentOrg?.name || "Select org"}</span>
                    </div>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                    Organizations
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {organizations.map((org) => (
                    <DropdownMenuItem
                        key={org.id}
                        className="flex items-center justify-between"
                        onSelect={() => {
                            setCurrentOrgId(org.id);
                            setOpen(false);
                        }}
                    >
                        <div className="flex items-center gap-2 truncate">
                            <Building2 className="h-4 w-4 shrink-0" />
                            <span className="truncate">{org.name}</span>
                            <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                {org.role}
                            </span>
                        </div>
                        {currentOrg?.id === org.id && <Check className="h-4 w-4 text-primary" />}
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link href="/org/new" className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Create organization
                    </Link>
                </DropdownMenuItem>
                {currentOrg && (
                    <DropdownMenuItem asChild>
                        <Link href={`/org/${currentOrg.id}/settings`} className="flex items-center gap-2">
                            <Settings className="h-4 w-4" />
                            Organization settings
                        </Link>
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

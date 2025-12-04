"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { useSession } from "next-auth/react";

export interface Organization {
    id: string;
    name: string;
    slug: string;
    settings: Record<string, unknown>;
    role: "owner" | "admin" | "member" | "viewer";
    _count?: {
        members: number;
        workspaces: number;
        projects: number;
    };
}

interface OrganizationContextType {
    organizations: Organization[];
    currentOrg: Organization | null;
    setCurrentOrgId: (id: string) => void;
    isLoading: boolean;
    refetch: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | null>(null);

const CURRENT_ORG_KEY = "projectflow_current_org";

export function OrganizationProvider({ children }: { children: ReactNode }) {
    const { data: session, status } = useSession();
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [currentOrgId, setCurrentOrgIdState] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchOrganizations = useCallback(async () => {
        if (status !== "authenticated") {
            setOrganizations([]);
            setCurrentOrgIdState(null);
            setIsLoading(false);
            return;
        }

        try {
            const res = await fetch("/api/organizations", { cache: "no-store" });
            if (res.ok) {
                const data = await res.json();
                setOrganizations(data.organizations || []);

                // Restore last selected org from localStorage or pick first
                const stored = localStorage.getItem(CURRENT_ORG_KEY);
                const validStored = data.organizations?.find((o: Organization) => o.id === stored);
                if (validStored) {
                    setCurrentOrgIdState(stored);
                } else if (data.organizations?.length > 0) {
                    setCurrentOrgIdState(data.organizations[0].id);
                }
            }
        } catch (error) {
            console.error("Failed to fetch organizations:", error);
        } finally {
            setIsLoading(false);
        }
    }, [status]);

    useEffect(() => {
        fetchOrganizations();
    }, [fetchOrganizations]);

    const setCurrentOrgId = useCallback((id: string) => {
        setCurrentOrgIdState(id);
        localStorage.setItem(CURRENT_ORG_KEY, id);
    }, []);

    const currentOrg = organizations.find((o) => o.id === currentOrgId) || null;

    return (
        <OrganizationContext.Provider
            value={{
                organizations,
                currentOrg,
                setCurrentOrgId,
                isLoading,
                refetch: fetchOrganizations,
            }}
        >
            {children}
        </OrganizationContext.Provider>
    );
}

export function useOrganization() {
    const context = useContext(OrganizationContext);
    if (!context) {
        throw new Error("useOrganization must be used within an OrganizationProvider");
    }
    return context;
}

// Helper hook to require an organization context
export function useRequireOrganization() {
    const { currentOrg, isLoading } = useOrganization();
    if (!isLoading && !currentOrg) {
        throw new Error("No organization selected");
    }
    return { currentOrg, isLoading };
}

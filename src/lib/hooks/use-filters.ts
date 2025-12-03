"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { parseSearchQuery, buildSearchQuery, type SearchFilters } from "@/lib/search-utils";

export interface UseFiltersReturn {
    filters: SearchFilters;
    setFilter: (key: keyof SearchFilters, value: any) => void;
    clearFilter: (key: keyof SearchFilters) => void;
    clearAllFilters: () => void;
    hasActiveFilters: boolean;
    activeFilterCount: number;
}

export function useFilters(syncWithUrl: boolean = true): UseFiltersReturn {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const isUpdatingFromUrl = useRef(false);

    // Initialize filters from URL if syncing
    const [filters, setFilters] = useState<SearchFilters>(() => {
        if (syncWithUrl && searchParams) {
            return parseSearchQuery(searchParams);
        }
        return {};
    });

    // Sync filters to URL
    const syncToUrl = useCallback(
        (newFilters: SearchFilters) => {
            if (!syncWithUrl || !pathname || isUpdatingFromUrl.current) return;

            const queryString = buildSearchQuery(newFilters);
            const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
            router.replace(newUrl, { scroll: false });
        },
        [syncWithUrl, pathname, router]
    );

    // Set a single filter
    const setFilter = useCallback(
        (key: keyof SearchFilters, value: any) => {
            setFilters((prev) => {
                const newFilters = { ...prev, [key]: value };
                syncToUrl(newFilters);
                return newFilters;
            });
        },
        [syncToUrl]
    );

    // Clear a single filter
    const clearFilter = useCallback(
        (key: keyof SearchFilters) => {
            setFilters((prev) => {
                const newFilters = { ...prev };
                delete newFilters[key];
                syncToUrl(newFilters);
                return newFilters;
            });
        },
        [syncToUrl]
    );

    // Clear all filters
    const clearAllFilters = useCallback(() => {
        setFilters({});
        syncToUrl({});
    }, [syncToUrl]);

    // Calculate active filter count
    const activeFilterCount = Object.keys(filters).filter((key) => {
        const value = filters[key as keyof SearchFilters];
        if (Array.isArray(value)) return value.length > 0;
        return value !== undefined && value !== null && value !== "";
    }).length;

    const hasActiveFilters = activeFilterCount > 0;

    // Sync from URL when search params change
    useEffect(() => {
        if (syncWithUrl && searchParams) {
            isUpdatingFromUrl.current = true;
            const urlFilters = parseSearchQuery(searchParams);
            setFilters(urlFilters);
            // Reset flag after state update
            setTimeout(() => {
                isUpdatingFromUrl.current = false;
            }, 0);
        }
    }, [searchParams, syncWithUrl]);

    return {
        filters,
        setFilter,
        clearFilter,
        clearAllFilters,
        hasActiveFilters,
        activeFilterCount,
    };
}

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { buildSearchQuery, saveRecentSearch, type SearchFilters } from "@/lib/search-utils";

export interface SearchResult {
    tasks: any[];
    projects: any[];
    commits: any[];
}

export interface UseSearchReturn {
    results: SearchResult;
    loading: boolean;
    error: string | null;
    search: (query: string, filters?: Partial<SearchFilters>) => void;
    clear: () => void;
}

/**
 * Custom hook for search functionality with debouncing
 */
export function useSearch(
    initialFilters: Partial<SearchFilters> = {},
    debounceMs: number = 300
): UseSearchReturn {
    const [results, setResults] = useState<SearchResult>({
        tasks: [],
        projects: [],
        commits: [],
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);
    const abortController = useRef<AbortController | null>(null);

    const performSearch = useCallback(
        async (filters: SearchFilters) => {
            // Cancel previous request
            if (abortController.current) {
                abortController.current.abort();
            }

            // Don't search if query is empty
            if (!filters.q || filters.q.trim().length === 0) {
                setResults({ tasks: [], projects: [], commits: [] });
                setLoading(false);
                return;
            }

            abortController.current = new AbortController();
            setLoading(true);
            setError(null);

            try {
                const queryString = buildSearchQuery(filters);
                const response = await fetch(`/api/search?${queryString}`, {
                    signal: abortController.current.signal,
                });

                if (!response.ok) {
                    throw new Error("Search failed");
                }

                const data = await response.json();
                setResults(data.results || { tasks: [], projects: [], commits: [] });

                // Save to recent searches
                if (filters.q) {
                    saveRecentSearch(filters.q, filters.type);
                }
            } catch (err: any) {
                if (err.name !== "AbortError") {
                    setError(err.message || "Search failed");
                    setResults({ tasks: [], projects: [], commits: [] });
                }
            } finally {
                setLoading(false);
            }
        },
        []
    );

    const search = useCallback(
        (query: string, additionalFilters: Partial<SearchFilters> = {}) => {
            // Clear previous debounce timer
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }

            const filters: SearchFilters = {
                ...initialFilters,
                ...additionalFilters,
                q: query,
            };

            // Debounce the search
            debounceTimer.current = setTimeout(() => {
                performSearch(filters);
            }, debounceMs);
        },
        [initialFilters, debounceMs, performSearch]
    );

    const clear = useCallback(() => {
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }
        if (abortController.current) {
            abortController.current.abort();
        }
        setResults({ tasks: [], projects: [], commits: [] });
        setLoading(false);
        setError(null);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
            if (abortController.current) {
                abortController.current.abort();
            }
        };
    }, []);

    return { results, loading, error, search, clear };
}

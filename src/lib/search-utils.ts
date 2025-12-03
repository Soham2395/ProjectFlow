/**
 * Utility functions for search functionality
 */

export interface SearchFilters {
    q?: string;
    type?: "task" | "project" | "all";
    projectId?: string;
    assigneeId?: string;
    status?: string[];
    priority?: string[];
    labelId?: string;
    dueBefore?: string;
    dueAfter?: string;
}

/**
 * Build query string from search filters
 */
export function buildSearchQuery(filters: SearchFilters): string {
    const params = new URLSearchParams();

    if (filters.q) params.set("q", filters.q);
    if (filters.type) params.set("type", filters.type);
    if (filters.projectId) params.set("projectId", filters.projectId);
    if (filters.assigneeId) params.set("assigneeId", filters.assigneeId);
    if (filters.status && filters.status.length > 0) {
        params.set("status", filters.status.join(","));
    }
    if (filters.priority && filters.priority.length > 0) {
        params.set("priority", filters.priority.join(","));
    }
    if (filters.labelId) params.set("labelId", filters.labelId);
    if (filters.dueBefore) params.set("dueBefore", filters.dueBefore);
    if (filters.dueAfter) params.set("dueAfter", filters.dueAfter);

    return params.toString();
}

/**
 * Parse search filters from URL query string
 */
export function parseSearchQuery(searchParams: URLSearchParams): SearchFilters {
    const filters: SearchFilters = {};

    const q = searchParams.get("q");
    if (q) filters.q = q;

    const type = searchParams.get("type");
    if (type === "task" || type === "project" || type === "all") {
        filters.type = type;
    }

    const projectId = searchParams.get("projectId");
    if (projectId) filters.projectId = projectId;

    const assigneeId = searchParams.get("assigneeId");
    if (assigneeId) filters.assigneeId = assigneeId;

    const status = searchParams.get("status");
    if (status) filters.status = status.split(",").map((s) => s.trim());

    const priority = searchParams.get("priority");
    if (priority) filters.priority = priority.split(",").map((p) => p.trim());

    const labelId = searchParams.get("labelId");
    if (labelId) filters.labelId = labelId;

    const dueBefore = searchParams.get("dueBefore");
    if (dueBefore) filters.dueBefore = dueBefore;

    const dueAfter = searchParams.get("dueAfter");
    if (dueAfter) filters.dueAfter = dueAfter;

    return filters;
}

/**
 * Highlight matched text in a string
 */
export function highlightText(text: string, query: string): string {
    if (!query.trim()) return text;

    const regex = new RegExp(`(${escapeRegExp(query)})`, "gi");
    return text.replace(regex, "<mark>$1</mark>");
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Get snippet from text around matched query
 */
export function getTextSnippet(
    text: string,
    query: string,
    maxLength: number = 150
): string {
    if (!text) return "";
    if (!query.trim()) return text.slice(0, maxLength) + (text.length > maxLength ? "..." : "");

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);

    if (index === -1) {
        return text.slice(0, maxLength) + (text.length > maxLength ? "..." : "");
    }

    const start = Math.max(0, index - 50);
    const end = Math.min(text.length, index + query.length + 100);

    let snippet = text.slice(start, end);
    if (start > 0) snippet = "..." + snippet;
    if (end < text.length) snippet = snippet + "...";

    return snippet;
}

/**
 * Format recent searches for storage
 */
export interface RecentSearch {
    query: string;
    timestamp: number;
    type?: string;
}

const RECENT_SEARCHES_KEY = "recent_searches";
const MAX_RECENT_SEARCHES = 10;

/**
 * Save a search to recent searches
 */
export function saveRecentSearch(query: string, type?: string): void {
    if (!query.trim()) return;

    const recent = getRecentSearches();
    const newSearch: RecentSearch = {
        query: query.trim(),
        timestamp: Date.now(),
        type,
    };

    // Remove duplicate if exists
    const filtered = recent.filter((s) => s.query !== newSearch.query);

    // Add to beginning and limit
    const updated = [newSearch, ...filtered].slice(0, MAX_RECENT_SEARCHES);

    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
}

/**
 * Get recent searches from localStorage
 */
export function getRecentSearches(): RecentSearch[] {
    try {
        const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
        if (!stored) return [];
        return JSON.parse(stored);
    } catch {
        return [];
    }
}

/**
 * Clear all recent searches
 */
export function clearRecentSearches(): void {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
}

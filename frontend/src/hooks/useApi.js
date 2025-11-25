/**
 * ============================================================================
 * CUSTOM HOOKS - ECCS Frontend
 * ============================================================================
 * 
 * OVERVIEW:
 * Custom hooks encapsulate reusable logic for React components. This file
 * provides hooks for API communication, state management, and UI feedback.
 * 
 * REACT HOOKS PRINCIPLES:
 * 
 *   1. Hooks must be called at the top level of a component
 *   2. Hooks must be called in the same order on every render
 *   3. Hooks can only be called from React functions (components or other hooks)
 *   4. Custom hooks should start with "use" prefix
 * 
 * STATE MANAGEMENT PATTERN:
 * 
 *   These hooks follow a consistent pattern for async operations:
 * 
 *   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
 *   │   IDLE      │────▶│   LOADING   │────▶│   SUCCESS   │
 *   │             │     │             │     │   or ERROR  │
 *   └─────────────┘     └─────────────┘     └─────────────┘
 *         ▲                                       │
 *         └───────────────────────────────────────┘
 *                      (reset/retry)
 * 
 *   Each hook returns:
 *   - data: The result of the async operation
 *   - loading: Boolean indicating if operation is in progress
 *   - error: Error object if operation failed
 *   - execute: Function to trigger the operation
 *   - reset: Function to clear state
 * 
 * UI FEEDBACK INTEGRATION:
 * 
 *   Components use these hooks to:
 *   1. Show loading spinners during API calls
 *   2. Display success messages on completion
 *   3. Show error messages with retry options
 *   4. Disable buttons while loading
 *   5. Update lists after mutations
 * 
 * ============================================================================
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { emailApi, templateApi } from '../services/api';

/**
 * ============================================================================
 * useAsync - Generic Async Operation Hook
 * ============================================================================
 * 
 * USAGE:
 * const { data, loading, error, execute, reset } = useAsync(asyncFunction);
 * 
 * STATE MANAGEMENT:
 * - Uses React's useState for each piece of state
 * - useCallback ensures execute function is stable across renders
 * - Prevents memory leaks by checking if component is mounted
 * 
 * EXAMPLE:
 * const { data: emails, loading, execute: fetchEmails } = useAsync(emailApi.getEmails);
 * 
 * useEffect(() => {
 *   fetchEmails();
 * }, [fetchEmails]);
 * 
 * @param {Function} asyncFunction - The async function to execute
 * @param {boolean} immediate - Whether to execute immediately on mount
 * @returns {object} { data, loading, error, execute, reset }
 */
export const useAsync = (asyncFunction, immediate = false) => {
  /**
   * STATE BREAKDOWN:
   * - data: Stores the result of successful async operation
   * - loading: Boolean flag for UI loading indicators
   * - error: Stores error object for error display
   */
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  /**
   * MOUNTED REF:
   * Tracks if component is still mounted to prevent state updates
   * after unmount (memory leak prevention)
   */
  const mountedRef = useRef(true);

  /**
   * EXECUTE FUNCTION:
   * 
   * ASYNC FLOW:
   * 1. Set loading = true, clear error
   * 2. Await async function with provided args
   * 3. If mounted, set data and clear loading
   * 4. On error, if mounted, set error and clear loading
   * 5. Return data for chaining if needed
   */
  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await asyncFunction(...args);
      if (mountedRef.current) {
        setData(result);
        setLoading(false);
      }
      return result;
    } catch (err) {
      if (mountedRef.current) {
        setError(err);
        setLoading(false);
      }
      throw err;
    }
  }, [asyncFunction]);

  /**
   * RESET FUNCTION:
   * Clears all state back to initial values
   * Useful after form submission or navigation
   */
  const reset = useCallback(() => {
    setData(null);
    setLoading(false);
    setError(null);
  }, []);

  /**
   * CLEANUP EFFECT:
   * Sets mounted flag to false when component unmounts
   * Prevents "Can't perform state update on unmounted component" warning
   */
  useEffect(() => {
    mountedRef.current = true;
    
    // Execute immediately if configured
    if (immediate) {
      execute();
    }
    
    return () => {
      mountedRef.current = false;
    };
  }, [immediate, execute]);

  return { data, loading, error, execute, reset };
};

/**
 * ============================================================================
 * useEmails - Email List Management Hook
 * ============================================================================
 * 
 * FEATURES:
 * - Fetches email list with pagination and filters
 * - Provides refresh functionality
 * - Handles loading and error states
 * 
 * STATE MANAGEMENT PATTERN:
 * 
 *   Component          useEmails Hook           API Service
 *      │                    │                       │
 *      ├──► fetchEmails() ─►│                       │
 *      │                    ├──► loading: true      │
 *      │                    ├──────────────────────►│
 *      │                    │       API Request     │
 *      │                    │◄──────────────────────┤
 *      │                    │       Response        │
 *      │                    ├──► loading: false     │
 *      │                    ├──► emails: [...]      │
 *      │◄── re-render ◄─────┤                       │
 *      │                    │                       │
 * 
 * ACCESSIBILITY:
 * - Returns loading state for announcing to screen readers
 * - Returns error for displaying accessible error messages
 * 
 * @param {object} initialFilters - Initial filter options
 * @returns {object} { emails, loading, error, fetchEmails, refresh }
 */
export const useEmails = (initialFilters = {}) => {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(initialFilters);

  /**
   * FETCH EMAILS:
   * Retrieves email list with current filters
   * Called on mount and when filters change
   */
  const fetchEmails = useCallback(async (newFilters = filters) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await emailApi.getEmails(newFilters);
      setEmails(data);
      setFilters(newFilters);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  /**
   * REFRESH:
   * Refetches emails with current filters
   * Useful after sending a new email
   */
  const refresh = useCallback(() => {
    return fetchEmails(filters);
  }, [fetchEmails, filters]);

  /**
   * INITIAL FETCH:
   * Loads emails when component mounts
   */
  useEffect(() => {
    fetchEmails(initialFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { emails, loading, error, fetchEmails, refresh, filters };
};

/**
 * ============================================================================
 * useSendEmail - Email Sending Hook
 * ============================================================================
 * 
 * ASYNC FLOW:
 * 
 *   User Input        Component         Hook             API              Backend
 *      │                 │               │                │                  │
 *      ├── click ───────►│               │                │                  │
 *      │                 ├── send() ────►│                │                  │
 *      │                 │               ├── loading ────►│                  │
 *      │                 │               │                ├── POST ─────────►│
 *      │                 │               │                │                  │
 *      │                 │               │                │   (Validation)   │
 *      │                 │               │                │   (DB Insert)    │
 *      │                 │               │                │   (Kafka Msg)    │
 *      │                 │               │                │                  │
 *      │                 │               │                │◄── 201 ──────────┤
 *      │                 │               │◄── success ────┤                  │
 *      │                 │◄── re-render ─┤                │                  │
 *      │◄── feedback ────┤               │                │                  │
 * 
 * UI FEEDBACK:
 * - loading: Disable button, show spinner
 * - success: Show success toast/message
 * - error: Show error message with retry option
 * 
 * @returns {object} { send, loading, error, success, reset }
 */
export const useSendEmail = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  /**
   * SEND EMAIL:
   * 
   * @param {object} emailData - { to, subject, body }
   * @returns {Promise<object>} The created email object
   */
  const send = useCallback(async (emailData) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const result = await emailApi.sendEmail(emailData);
      setSuccess({
        message: 'Email queued for sending!',
        email: result.email,
      });
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * RESET:
   * Clears all state - call after user dismisses feedback
   */
  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setSuccess(null);
  }, []);

  return { send, loading, error, success, reset };
};

/**
 * ============================================================================
 * useTemplates - Template Management Hook
 * ============================================================================
 * 
 * FEATURES:
 * - CRUD operations for email templates
 * - Local storage persistence
 * - Optimistic updates for better UX
 * 
 * STATE MANAGEMENT:
 * Templates are stored in localStorage and synced with component state.
 * This provides offline capability and persistence across sessions.
 * 
 * @returns {object} { templates, loading, saveTemplate, updateTemplate, deleteTemplate }
 */
export const useTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * LOAD TEMPLATES:
   * Fetches templates from storage on mount
   */
  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await templateApi.getTemplates();
      setTemplates(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * SAVE TEMPLATE:
   * Creates a new template
   * 
   * @param {object} template - { name, subject, body }
   */
  const saveTemplate = useCallback(async (template) => {
    try {
      const newTemplate = await templateApi.saveTemplate(template);
      setTemplates(prev => [...prev, newTemplate]);
      return newTemplate;
    } catch (err) {
      setError(err);
      throw err;
    }
  }, []);

  /**
   * UPDATE TEMPLATE:
   * Updates an existing template
   * 
   * @param {string} id - Template ID
   * @param {object} updates - Fields to update
   */
  const updateTemplate = useCallback(async (id, updates) => {
    try {
      const updated = await templateApi.updateTemplate(id, updates);
      setTemplates(prev => prev.map(t => t.id === id ? updated : t));
      return updated;
    } catch (err) {
      setError(err);
      throw err;
    }
  }, []);

  /**
   * DELETE TEMPLATE:
   * Removes a template
   * 
   * @param {string} id - Template ID
   */
  const deleteTemplate = useCallback(async (id) => {
    try {
      await templateApi.deleteTemplate(id);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      setError(err);
      throw err;
    }
  }, []);

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  return { templates, loading, error, saveTemplate, updateTemplate, deleteTemplate, refresh: loadTemplates };
};

/**
 * ============================================================================
 * useEmailStats - Dashboard Statistics Hook
 * ============================================================================
 * 
 * Fetches and manages email statistics for the dashboard.
 * Auto-refreshes every 5 minutes to keep data current.
 * 
 * @param {number} refreshInterval - Refresh interval in ms (default: 5 min)
 * @returns {object} { stats, loading, error, refresh }
 */
export const useEmailStats = (refreshInterval = 300000) => {
  const [stats, setStats] = useState({
    totalEmails: 0,
    sentToday: 0,
    pending: 0,
    failed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await emailApi.getStats();
      setStats(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    
    // Auto-refresh interval
    const intervalId = setInterval(fetchStats, refreshInterval);
    
    return () => clearInterval(intervalId);
  }, [fetchStats, refreshInterval]);

  return { stats, loading, error, refresh: fetchStats };
};

/**
 * ============================================================================
 * useDebounce - Input Debouncing Hook
 * ============================================================================
 * 
 * Delays updating a value until after specified delay since last change.
 * Useful for search inputs to avoid excessive API calls.
 * 
 * EXAMPLE:
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearch = useDebounce(searchTerm, 300);
 * 
 * useEffect(() => {
 *   if (debouncedSearch) {
 *     searchEmails(debouncedSearch);
 *   }
 * }, [debouncedSearch]);
 * 
 * @param {any} value - Value to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {any} Debounced value
 */
export const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

/**
 * ============================================================================
 * usePagination - Pagination State Hook
 * ============================================================================
 * 
 * Manages pagination state for lists.
 * 
 * @param {number} initialPage - Starting page (default: 1)
 * @param {number} initialLimit - Items per page (default: 10)
 * @returns {object} Pagination state and controls
 */
export const usePagination = (initialPage = 1, initialLimit = 10) => {
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [totalItems, setTotalItems] = useState(0);

  const totalPages = Math.ceil(totalItems / limit);

  const goToPage = useCallback((newPage) => {
    setPage(Math.max(1, Math.min(newPage, totalPages || 1)));
  }, [totalPages]);

  const nextPage = useCallback(() => {
    goToPage(page + 1);
  }, [page, goToPage]);

  const prevPage = useCallback(() => {
    goToPage(page - 1);
  }, [page, goToPage]);

  const reset = useCallback(() => {
    setPage(initialPage);
  }, [initialPage]);

  return {
    page,
    limit,
    setLimit,
    totalItems,
    setTotalItems,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    reset,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

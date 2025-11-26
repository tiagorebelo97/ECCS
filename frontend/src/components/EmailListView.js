/**
 * ============================================================================
 * EmailListView Component - ECCS Frontend
 * ============================================================================
 * 
 * COMPONENT OVERVIEW:
 * Displays a list of emails with filtering, sorting, and pagination.
 * This component demonstrates React state management patterns, 
 * asynchronous API calls, and accessibility best practices.
 * 
 * ARCHITECTURE:
 * 
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │                      EmailListView                              │
 *   ├─────────────────────────────────────────────────────────────────┤
 *   │                                                                 │
 *   │  ┌───────────────────────────────────────────────────────────┐  │
 *   │  │  FilterBar (status filter, refresh button)                │  │
 *   │  └───────────────────────────────────────────────────────────┘  │
 *   │                                                                 │
 *   │  ┌───────────────────────────────────────────────────────────┐  │
 *   │  │  EmailList                                                │  │
 *   │  │  ┌─────────────────────────────────────────────────────┐  │  │
 *   │  │  │  EmailItem (subject, recipient, status, date)       │  │  │
 *   │  │  └─────────────────────────────────────────────────────┘  │  │
 *   │  │  ┌─────────────────────────────────────────────────────┐  │  │
 *   │  │  │  EmailItem                                          │  │  │
 *   │  │  └─────────────────────────────────────────────────────┘  │  │
 *   │  │  ┌─────────────────────────────────────────────────────┐  │  │
 *   │  │  │  EmailItem                                          │  │  │
 *   │  │  └─────────────────────────────────────────────────────┘  │  │
 *   │  └───────────────────────────────────────────────────────────┘  │
 *   │                                                                 │
 *   │  ┌───────────────────────────────────────────────────────────┐  │
 *   │  │  Pagination Controls                                      │  │
 *   │  └───────────────────────────────────────────────────────────┘  │
 *   │                                                                 │
 *   └─────────────────────────────────────────────────────────────────┘
 * 
 * STATE MANAGEMENT:
 * 
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │                     Component State                             │
 *   ├─────────────────────────────────────────────────────────────────┤
 *   │  emails: Array<Email>      - List of email objects              │
 *   │  loading: boolean          - API call in progress               │
 *   │  error: Error | null       - Error from last API call           │
 *   │  selectedStatus: string    - Current filter selection           │
 *   │  selectedEmail: Email      - Currently selected email           │
 *   └─────────────────────────────────────────────────────────────────┘
 * 
 * ASYNC API FLOW:
 * 
 *   1. Component mounts → useEmails hook triggers initial fetch
 *   2. Loading state shown → Spinner displayed, items hidden
 *   3. API call to GET /api/emails via Traefik
 *   4. Traefik validates JWT → Forwards to email-service
 *   5. Response received → State updated with emails
 *   6. Component re-renders → Email list displayed
 *   7. On filter change → New API call with filter params
 * 
 * ACCESSIBILITY FEATURES:
 * 
 *   - role="list" and role="listitem" for screen readers
 *   - aria-label on interactive elements
 *   - aria-busy for loading states
 *   - aria-live="polite" for dynamic updates
 *   - Keyboard navigation (Tab, Enter, Space)
 *   - Focus management for selected items
 *   - High contrast status badges
 *   - Reduced motion support
 * 
 * RESPONSIVE DESIGN:
 * 
 *   Desktop (>768px):
 *   - Full layout with all columns visible
 *   - Hover effects on items
 * 
 *   Tablet (481px - 768px):
 *   - Condensed layout
 *   - Status badge moves below subject
 * 
 *   Mobile (<480px):
 *   - Single column layout
 *   - Stacked information
 *   - Touch-friendly tap targets (min 44px)
 * 
 * ============================================================================
 */

import React, { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useEmails } from '../hooks/useApi';
import './EmailListView.css';

/**
 * STATUS CONFIGURATION
 * 
 * Defines display properties for each email status.
 * Used for consistent styling and accessibility labels.
 */
const STATUS_CONFIG = {
  sent: {
    label: 'Sent',
    className: 'status-sent',
    ariaLabel: 'Email has been sent successfully',
  },
  pending: {
    label: 'Pending',
    className: 'status-pending',
    ariaLabel: 'Email is queued for sending',
  },
  failed: {
    label: 'Failed',
    className: 'status-failed',
    ariaLabel: 'Email failed to send',
  },
};

/**
 * EmailItem Component
 * 
 * Renders a single email item in the list.
 * 
 * PROPS:
 * @param {object} email - Email object with id, subject, to, status, createdAt
 * @param {boolean} isSelected - Whether this item is currently selected
 * @param {function} onSelect - Callback when item is clicked/selected
 * 
 * ACCESSIBILITY:
 * - role="listitem" for semantic structure
 * - tabIndex="0" for keyboard navigation
 * - aria-selected for current selection state
 * - onKeyDown for Enter/Space activation
 */
const EmailItem = React.memo(({ email, isSelected, onSelect }) => {
  /**
   * KEYBOARD HANDLER
   * Allows selection via Enter or Space key
   */
  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(email);
    }
  }, [email, onSelect]);

  const statusConfig = STATUS_CONFIG[email.status] || STATUS_CONFIG.pending;
  const formattedDate = new Date(email.createdAt).toLocaleString();

  return (
    <div
      className={`email-list-item ${isSelected ? 'email-list-item--selected' : ''}`}
      role="listitem"
      tabIndex={0}
      aria-current={isSelected ? 'true' : undefined}
      onClick={() => onSelect(email)}
      onKeyDown={handleKeyDown}
    >
      {/* Email Subject - Primary information */}
      <div className="email-list-item__subject" title={email.subject}>
        {email.subject || '(No subject)'}
      </div>
      
      {/* Recipient - Secondary information */}
      <div className="email-list-item__recipient" aria-label={`To: ${email.to || email.recipient}`}>
        To: {email.to || email.recipient}
      </div>
      
      {/* Metadata row: date and status */}
      <div className="email-list-item__meta">
        <time dateTime={email.createdAt} className="email-list-item__date">
          {formattedDate}
        </time>
        <span 
          className={`email-list-item__status ${statusConfig.className}`}
          aria-label={statusConfig.ariaLabel}
          role="status"
        >
          {statusConfig.label}
        </span>
      </div>
    </div>
  );
});

EmailItem.displayName = 'EmailItem';

EmailItem.propTypes = {
  email: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    subject: PropTypes.string,
    to: PropTypes.string,
    recipient: PropTypes.string,
    status: PropTypes.oneOf(['sent', 'pending', 'failed']),
    createdAt: PropTypes.string,
  }).isRequired,
  isSelected: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
};

EmailItem.defaultProps = {
  isSelected: false,
};

/**
 * FilterBar Component
 * 
 * Provides filtering controls for the email list.
 * 
 * ACCESSIBILITY:
 * - Label association with select element
 * - Clear button with aria-label
 * - Refresh button announces action
 */
const FilterBar = React.memo(({ selectedStatus, onStatusChange, onRefresh, loading }) => {
  return (
    <div className="email-filter-bar" role="search" aria-label="Filter emails">
      <div className="email-filter-bar__controls">
        {/* Status Filter */}
        <div className="email-filter-bar__filter">
          <label htmlFor="status-filter" className="email-filter-bar__label">
            Filter by status:
          </label>
          <select
            id="status-filter"
            className="email-filter-bar__select"
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            aria-describedby="filter-help"
          >
            <option value="">All emails</option>
            <option value="sent">Sent</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
          <span id="filter-help" className="visually-hidden">
            Filter emails by their sending status
          </span>
        </div>
        
        {/* Refresh Button */}
        <button
          className="email-filter-bar__refresh btn btn-secondary"
          onClick={onRefresh}
          disabled={loading}
          aria-label={loading ? 'Refreshing email list' : 'Refresh email list'}
          aria-busy={loading}
        >
          {loading ? (
            <span className="spinner spinner--small" aria-hidden="true"></span>
          ) : (
            '↻ Refresh'
          )}
        </button>
      </div>
    </div>
  );
});

FilterBar.displayName = 'FilterBar';

FilterBar.propTypes = {
  selectedStatus: PropTypes.string,
  onStatusChange: PropTypes.func.isRequired,
  onRefresh: PropTypes.func.isRequired,
  loading: PropTypes.bool,
};

FilterBar.defaultProps = {
  selectedStatus: '',
  loading: false,
};

/**
 * EmptyState Component
 * 
 * Displayed when no emails match the current filter.
 */
const EmptyState = React.memo(({ hasFilter }) => (
  <div className="email-list-empty" role="status" aria-live="polite">
    <div className="email-list-empty__icon" aria-hidden="true">📭</div>
    <p className="email-list-empty__text">
      {hasFilter ? 'No emails match the current filter.' : 'No emails found.'}
    </p>
    {hasFilter && (
      <p className="email-list-empty__hint">
        Try adjusting your filter or check back later.
      </p>
    )}
  </div>
));

EmptyState.displayName = 'EmptyState';

EmptyState.propTypes = {
  hasFilter: PropTypes.bool,
};

/**
 * LoadingState Component
 * 
 * Displayed while emails are being fetched.
 * Includes skeleton loading for better perceived performance.
 */
const LoadingState = React.memo(() => (
  <div 
    className="email-list-loading" 
    role="status" 
    aria-label="Loading emails"
    aria-busy="true"
  >
    <div className="email-list-loading__spinner">
      <div className="spinner" aria-hidden="true"></div>
    </div>
    <p className="email-list-loading__text">Loading emails...</p>
    
    {/* Skeleton items for visual feedback */}
    <div className="email-list-skeleton" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <div key={i} className="email-list-skeleton__item">
          <div className="email-list-skeleton__line email-list-skeleton__line--title"></div>
          <div className="email-list-skeleton__line email-list-skeleton__line--short"></div>
          <div className="email-list-skeleton__line email-list-skeleton__line--meta"></div>
        </div>
      ))}
    </div>
  </div>
));

LoadingState.displayName = 'LoadingState';

/**
 * ErrorState Component
 * 
 * Displayed when email fetch fails.
 * Provides retry functionality.
 */
const ErrorState = React.memo(({ error, onRetry }) => (
  <div 
    className="email-list-error" 
    role="alert" 
    aria-live="assertive"
  >
    <div className="email-list-error__icon" aria-hidden="true">⚠️</div>
    <p className="email-list-error__text">
      {error?.message || 'Failed to load emails. Please try again.'}
    </p>
    <button 
      className="email-list-error__retry btn btn-primary"
      onClick={onRetry}
      aria-label="Retry loading emails"
    >
      Retry
    </button>
  </div>
));

ErrorState.displayName = 'ErrorState';

ErrorState.propTypes = {
  error: PropTypes.shape({
    message: PropTypes.string,
  }),
  onRetry: PropTypes.func.isRequired,
};

/**
 * ============================================================================
 * EmailListView - Main Component
 * ============================================================================
 * 
 * USAGE:
 * <EmailListView onEmailSelect={(email) => console.log(email)} />
 * 
 * PROPS:
 * @param {function} onEmailSelect - Callback when an email is selected
 * @param {string} className - Additional CSS classes
 */
const EmailListView = ({ onEmailSelect, className }) => {
  /**
   * STATE MANAGEMENT EXPLANATION:
   * 
   * We use the useEmails custom hook for async data fetching.
   * This separates data fetching logic from UI rendering.
   * 
   * Local state:
   * - selectedEmail: Currently selected email (UI state)
   * - statusFilter: Active status filter (UI state)
   * 
   * Hook state (from useEmails):
   * - emails: Array of email data (server state)
   * - loading: Fetch in progress (async state)
   * - error: Fetch error (async state)
   */
  const { emails, loading, error, fetchEmails, refresh } = useEmails();
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  /**
   * FILTERED EMAILS
   * 
   * useMemo ensures we only recalculate when emails or filter changes.
   * This optimization prevents unnecessary re-renders.
   */
  const filteredEmails = useMemo(() => {
    if (!statusFilter) return emails;
    return emails.filter(email => email.status === statusFilter);
  }, [emails, statusFilter]);

  /**
   * STATUS FILTER CHANGE HANDLER
   * 
   * When filter changes, we could either:
   * 1. Filter locally (current implementation - faster)
   * 2. Send filter to API (better for large datasets)
   */
  const handleStatusChange = useCallback((newStatus) => {
    setStatusFilter(newStatus);
    // Optionally fetch with server-side filtering:
    // fetchEmails({ status: newStatus });
  }, []);

  /**
   * EMAIL SELECT HANDLER
   * 
   * Updates local state and notifies parent component.
   */
  const handleEmailSelect = useCallback((email) => {
    setSelectedEmail(email);
    if (onEmailSelect) {
      onEmailSelect(email);
    }
  }, [onEmailSelect]);

  /**
   * REFRESH HANDLER
   * 
   * Re-fetches emails from the API.
   */
  const handleRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  /**
   * RETRY HANDLER
   * 
   * Retries the failed API call.
   */
  const handleRetry = useCallback(() => {
    fetchEmails();
  }, [fetchEmails]);

  /**
   * RENDER
   * 
   * Conditional rendering based on state:
   * 1. Loading → Show loading state
   * 2. Error → Show error state with retry
   * 3. Empty → Show empty state
   * 4. Data → Show email list
   */
  return (
    <div 
      className={`email-list-view ${className || ''}`}
      aria-label="Email list"
    >
      {/* Filter Bar - Always visible */}
      <FilterBar
        selectedStatus={statusFilter}
        onStatusChange={handleStatusChange}
        onRefresh={handleRefresh}
        loading={loading}
      />

      {/* Live region for screen reader announcements */}
      <div 
        className="visually-hidden" 
        role="status" 
        aria-live="polite"
        aria-atomic="true"
      >
        {loading && 'Loading emails...'}
        {!loading && filteredEmails.length > 0 && 
          `${filteredEmails.length} email${filteredEmails.length !== 1 ? 's' : ''} found`}
        {!loading && filteredEmails.length === 0 && 'No emails found'}
      </div>

      {/* Conditional Content */}
      {loading && <LoadingState />}
      
      {!loading && error && (
        <ErrorState error={error} onRetry={handleRetry} />
      )}
      
      {!loading && !error && filteredEmails.length === 0 && (
        <EmptyState hasFilter={!!statusFilter} />
      )}
      
      {!loading && !error && filteredEmails.length > 0 && (
        <div 
          className="email-list" 
          role="list" 
          aria-label={`Email list with ${filteredEmails.length} items`}
        >
          {filteredEmails.map((email) => (
            <EmailItem
              key={email.id}
              email={email}
              isSelected={selectedEmail?.id === email.id}
              onSelect={handleEmailSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

EmailListView.propTypes = {
  onEmailSelect: PropTypes.func,
  className: PropTypes.string,
};

EmailListView.defaultProps = {
  onEmailSelect: null,
  className: '',
};

export default EmailListView;

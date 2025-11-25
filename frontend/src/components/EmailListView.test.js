/**
 * ============================================================================
 * EmailListView Component Tests
 * ============================================================================
 * 
 * Test suite for the EmailListView component.
 * Tests cover rendering, filtering, accessibility, and user interactions.
 */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import EmailListView from './EmailListView';
import * as useApiModule from '../hooks/useApi';

// Mock the useEmails hook
jest.mock('../hooks/useApi', () => ({
  useEmails: jest.fn(),
}));

// Sample email data for tests
const mockEmails = [
  {
    id: 1,
    subject: 'Test Email 1',
    to: 'user1@example.com',
    recipient: 'user1@example.com',
    status: 'sent',
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 2,
    subject: 'Test Email 2',
    to: 'user2@example.com',
    recipient: 'user2@example.com',
    status: 'pending',
    createdAt: '2024-01-15T11:00:00Z',
  },
  {
    id: 3,
    subject: 'Test Email 3',
    to: 'user3@example.com',
    recipient: 'user3@example.com',
    status: 'failed',
    createdAt: '2024-01-15T12:00:00Z',
  },
];

describe('EmailListView', () => {
  const mockFetchEmails = jest.fn();
  const mockRefresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementation
    useApiModule.useEmails.mockReturnValue({
      emails: mockEmails,
      loading: false,
      error: null,
      fetchEmails: mockFetchEmails,
      refresh: mockRefresh,
      filters: {},
    });
  });

  describe('Rendering', () => {
    it('should render email list with emails', () => {
      render(<EmailListView />);
      
      expect(screen.getByText('Test Email 1')).toBeInTheDocument();
      expect(screen.getByText('Test Email 2')).toBeInTheDocument();
      expect(screen.getByText('Test Email 3')).toBeInTheDocument();
    });

    it('should render loading state', () => {
      useApiModule.useEmails.mockReturnValue({
        emails: [],
        loading: true,
        error: null,
        fetchEmails: mockFetchEmails,
        refresh: mockRefresh,
        filters: {},
      });

      render(<EmailListView />);
      
      expect(screen.getByRole('status', { name: /loading emails/i })).toBeInTheDocument();
    });

    it('should render error state with retry button', () => {
      const error = { message: 'Failed to load emails' };
      
      useApiModule.useEmails.mockReturnValue({
        emails: [],
        loading: false,
        error,
        fetchEmails: mockFetchEmails,
        refresh: mockRefresh,
        filters: {},
      });

      render(<EmailListView />);
      
      expect(screen.getByText('Failed to load emails')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should render empty state when no emails', () => {
      useApiModule.useEmails.mockReturnValue({
        emails: [],
        loading: false,
        error: null,
        fetchEmails: mockFetchEmails,
        refresh: mockRefresh,
        filters: {},
      });

      render(<EmailListView />);
      
      expect(screen.getByText('No emails found.')).toBeInTheDocument();
    });
  });

  describe('Filtering', () => {
    it('should filter emails by status', () => {
      render(<EmailListView />);
      
      // Initially all emails shown
      expect(screen.getByText('Test Email 1')).toBeInTheDocument();
      expect(screen.getByText('Test Email 2')).toBeInTheDocument();
      
      // Filter by sent status
      const select = screen.getByRole('combobox', { name: /filter by status/i });
      fireEvent.change(select, { target: { value: 'sent' } });
      
      // Only sent emails should be visible
      expect(screen.getByText('Test Email 1')).toBeInTheDocument();
      expect(screen.queryByText('Test Email 2')).not.toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should call onEmailSelect when email is clicked', () => {
      const onEmailSelect = jest.fn();
      
      render(<EmailListView onEmailSelect={onEmailSelect} />);
      
      const emailList = screen.getByRole('list', { name: /email list/i });
      const emailItems = within(emailList).getAllByRole('listitem');
      fireEvent.click(emailItems[0]);
      
      expect(onEmailSelect).toHaveBeenCalledWith(mockEmails[0]);
    });

    it('should call refresh when refresh button is clicked', () => {
      render(<EmailListView />);
      
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);
      
      expect(mockRefresh).toHaveBeenCalled();
    });

    it('should call fetchEmails when retry button is clicked', () => {
      const error = { message: 'Failed to load emails' };
      
      useApiModule.useEmails.mockReturnValue({
        emails: [],
        loading: false,
        error,
        fetchEmails: mockFetchEmails,
        refresh: mockRefresh,
        filters: {},
      });

      render(<EmailListView />);
      
      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);
      
      expect(mockFetchEmails).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria labels', () => {
      render(<EmailListView />);
      
      expect(screen.getByRole('list', { name: /email list/i })).toBeInTheDocument();
      expect(screen.getByRole('search', { name: /filter emails/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', () => {
      const onEmailSelect = jest.fn();
      
      render(<EmailListView onEmailSelect={onEmailSelect} />);
      
      // Focus and press Enter on first email
      const emailList = screen.getByRole('list', { name: /email list/i });
      const emailItems = within(emailList).getAllByRole('listitem');
      fireEvent.keyDown(emailItems[0], { key: 'Enter', code: 'Enter' });
      
      expect(onEmailSelect).toHaveBeenCalledWith(mockEmails[0]);
    });

    it('should have status badges with aria-labels', () => {
      render(<EmailListView />);
      
      const sentBadge = screen.getByRole('status', { name: /email has been sent successfully/i });
      expect(sentBadge).toBeInTheDocument();
    });
  });
});

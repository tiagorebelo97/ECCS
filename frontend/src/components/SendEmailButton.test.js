/**
 * ============================================================================
 * SendEmailButton Component Tests
 * ============================================================================
 * 
 * Test suite for the SendEmailButton component.
 * Tests cover sending, loading states, error handling, and accessibility.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SendEmailButton from './SendEmailButton';
import * as useApiModule from '../hooks/useApi';

// Mock the useSendEmail hook
jest.mock('../hooks/useApi', () => ({
  useSendEmail: jest.fn(),
}));

describe('SendEmailButton', () => {
  const mockSend = jest.fn();
  const mockReset = jest.fn();
  const defaultEmailData = {
    to: 'test@example.com',
    subject: 'Test Subject',
    body: 'Test Body',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementation
    useApiModule.useSendEmail.mockReturnValue({
      send: mockSend,
      loading: false,
      error: null,
      success: null,
      reset: mockReset,
    });
  });

  describe('Rendering', () => {
    it('should render send button with default text', () => {
      render(<SendEmailButton emailData={defaultEmailData} />);
      
      expect(screen.getByRole('button', { name: /send email/i })).toBeInTheDocument();
    });

    it('should render send button with custom text', () => {
      render(
        <SendEmailButton emailData={defaultEmailData}>
          Custom Send Text
        </SendEmailButton>
      );
      
      expect(screen.getByText('Custom Send Text')).toBeInTheDocument();
    });

    it('should be disabled when emailData is incomplete', () => {
      render(<SendEmailButton emailData={{ to: '', subject: '', body: '' }} />);
      
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('should be disabled when disabled prop is true', () => {
      render(<SendEmailButton emailData={defaultEmailData} disabled={true} />);
      
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });

  describe('Sending', () => {
    it('should call send when button is clicked', async () => {
      mockSend.mockResolvedValue({ email: defaultEmailData });

      render(<SendEmailButton emailData={defaultEmailData} />);
      
      fireEvent.click(screen.getByRole('button'));
      
      expect(mockSend).toHaveBeenCalledWith(defaultEmailData);
    });

    it('should show loading state while sending', () => {
      useApiModule.useSendEmail.mockReturnValue({
        send: mockSend,
        loading: true,
        error: null,
        success: null,
        reset: mockReset,
      });

      render(<SendEmailButton emailData={defaultEmailData} />);
      
      expect(screen.getByText('Sending...')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('should call onSuccess callback on successful send', async () => {
      const onSuccess = jest.fn();
      const result = { email: defaultEmailData };
      mockSend.mockResolvedValue(result);

      render(<SendEmailButton emailData={defaultEmailData} onSuccess={onSuccess} />);
      
      fireEvent.click(screen.getByRole('button'));
      
      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(result);
      });
    });

    it('should call onError callback on failed send', async () => {
      const onError = jest.fn();
      const error = { message: 'Failed to send' };
      mockSend.mockRejectedValue(error);

      render(<SendEmailButton emailData={defaultEmailData} onError={onError} />);
      
      fireEvent.click(screen.getByRole('button'));
      
      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(error);
      });
    });
  });

  describe('Validation', () => {
    it('should call onValidate before sending', async () => {
      const onValidate = jest.fn(() => true);
      mockSend.mockResolvedValue({});

      render(
        <SendEmailButton 
          emailData={defaultEmailData} 
          onValidate={onValidate}
        />
      );
      
      fireEvent.click(screen.getByRole('button'));
      
      expect(onValidate).toHaveBeenCalled();
      expect(mockSend).toHaveBeenCalled();
    });

    it('should not send if validation fails', () => {
      const onValidate = jest.fn(() => false);

      render(
        <SendEmailButton 
          emailData={defaultEmailData} 
          onValidate={onValidate}
        />
      );
      
      fireEvent.click(screen.getByRole('button'));
      
      expect(onValidate).toHaveBeenCalled();
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('Confirmation Dialog', () => {
    it('should show confirmation dialog when requireConfirmation is true', () => {
      render(
        <SendEmailButton 
          emailData={defaultEmailData} 
          requireConfirmation={true}
        />
      );
      
      fireEvent.click(screen.getByRole('button'));
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Confirm Send Email')).toBeInTheDocument();
    });

    it('should send when confirmation is accepted', async () => {
      mockSend.mockResolvedValue({});

      render(
        <SendEmailButton 
          emailData={defaultEmailData} 
          requireConfirmation={true}
        />
      );
      
      fireEvent.click(screen.getByRole('button'));
      
      // Click confirm in dialog
      fireEvent.click(screen.getByRole('button', { name: /^send$/i }));
      
      expect(mockSend).toHaveBeenCalledWith(defaultEmailData);
    });

    it('should close dialog when cancel is clicked', () => {
      render(
        <SendEmailButton 
          emailData={defaultEmailData} 
          requireConfirmation={true}
        />
      );
      
      fireEvent.click(screen.getByRole('button'));
      
      // Click cancel in dialog
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-label on button', () => {
      render(<SendEmailButton emailData={defaultEmailData} />);
      
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', expect.stringContaining('Send email'));
    });

    it('should have aria-busy when loading', () => {
      useApiModule.useSendEmail.mockReturnValue({
        send: mockSend,
        loading: true,
        error: null,
        success: null,
        reset: mockReset,
      });

      render(<SendEmailButton emailData={defaultEmailData} />);
      
      expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    });

    it('should have screen reader status announcements', () => {
      useApiModule.useSendEmail.mockReturnValue({
        send: mockSend,
        loading: true,
        error: null,
        success: null,
        reset: mockReset,
      });

      render(<SendEmailButton emailData={defaultEmailData} />);
      
      expect(screen.getByRole('status')).toHaveTextContent('Sending email...');
    });

    it('should support keyboard activation', () => {
      mockSend.mockResolvedValue({});

      render(<SendEmailButton emailData={defaultEmailData} />);
      
      const button = screen.getByRole('button');
      fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
      
      expect(mockSend).toHaveBeenCalled();
    });
  });
});

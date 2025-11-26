/**
 * ============================================================================
 * SendEmailButton Component - ECCS Frontend
 * ============================================================================
 * 
 * COMPONENT OVERVIEW:
 * A button component for sending emails with comprehensive loading states,
 * error handling, and user feedback. This component demonstrates the complete
 * async API flow from user action to backend response.
 * 
 * ASYNCHRONOUS API CALL FLOW:
 * 
 *   ┌──────────────────────────────────────────────────────────────────────────┐
 *   │                        Complete Send Email Flow                          │
 *   └──────────────────────────────────────────────────────────────────────────┘
 * 
 *   User                    Component                 Hook                  API
 *    │                         │                        │                     │
 *    ├── clicks button ───────►│                        │                     │
 *    │                         │                        │                     │
 *    │                    ┌────┴────┐                   │                     │
 *    │                    │Validate │                   │                     │
 *    │                    │ Form    │                   │                     │
 *    │                    └────┬────┘                   │                     │
 *    │                         │                        │                     │
 *    │                   ┌─────┴─────┐                  │                     │
 *    │                   ▼           ▼                  │                     │
 *    │               Valid       Invalid                │                     │
 *    │                 │             │                  │                     │
 *    │                 │             └──► Show errors   │                     │
 *    │                 │                   return       │                     │
 *    │                 ▼                                │                     │
 *    │         ┌───────────────┐                        │                     │
 *    │         │ Set state:    │                        │                     │
 *    │         │ loading=true  │                        │                     │
 *    │         │ disabled btn  │                        │                     │
 *    │         │ show spinner  │                        │                     │
 *    │         └───────┬───────┘                        │                     │
 *    │                 │                                │                     │
 *    │                 ├── call send() ────────────────►│                     │
 *    │                 │                                │                     │
 *    │                 │                                ├── POST /api/emails/ │
 *    │                 │                                │   send              │
 *    │                 │                                │        │            │
 *    │                 │                                │        ▼            │
 *    │                 │                                │   ┌──────────┐      │
 *    │                 │                                │   │ Traefik  │      │
 *    │                 │                                │   │ JWT Auth │      │
 *    │                 │                                │   └────┬─────┘      │
 *    │                 │                                │        │            │
 *    │                 │                                │        ▼            │
 *    │                 │                                │   ┌──────────┐      │
 *    │                 │                                │   │ Email    │      │
 *    │                 │                                │   │ Service  │      │
 *    │                 │                                │   └────┬─────┘      │
 *    │                 │                                │        │            │
 *    │                 │                                │        ▼            │
 *    │                 │                                │   ┌──────────┐      │
 *    │                 │                                │   │ Kafka    │      │
 *    │                 │                                │   │ Queue    │      │
 *    │                 │                                │   └────┬─────┘      │
 *    │                 │                                │        │            │
 *    │                 │                                │◄───────┘            │
 *    │                 │                                │   Response          │
 *    │                 │◄── success/error ─────────────┤                     │
 *    │                 │                                │                     │
 *    │         ┌───────┴───────┐                        │                     │
 *    │         ▼               ▼                        │                     │
 *    │      Success         Error                       │                     │
 *    │         │               │                        │                     │
 *    │         │         ┌─────┴─────┐                  │                     │
 *    │         │         ▼           ▼                  │                     │
 *    │         │    Retriable  Non-retriable            │                     │
 *    │         │         │           │                  │                     │
 *    │         │    Show retry   Show error             │                     │
 *    │         │    button       message                │                     │
 *    │         │         │           │                  │                     │
 *    │         ▼         ▼           ▼                  │                     │
 *    │◄── UI Update ─────────────────                   │                     │
 *    │   (success toast, reset form, etc.)              │                     │
 *    │                                                                        │
 * 
 * UI FEEDBACK STATES:
 * 
 *   1. IDLE (default)
 *      - Button enabled with primary styling
 *      - Shows "Send Email" text
 *      - Hover/focus effects active
 * 
 *   2. LOADING (sending)
 *      - Button disabled
 *      - Shows spinner + "Sending..." text
 *      - Cursor shows wait
 *      - aria-busy="true" for screen readers
 * 
 *   3. SUCCESS
 *      - Shows success message/toast
 *      - Button returns to idle
 *      - Optional: Form clears
 *      - Optional: Navigate away
 * 
 *   4. ERROR (retriable)
 *      - Shows error message
 *      - Retry button available
 *      - Original data preserved
 * 
 *   5. ERROR (non-retriable)
 *      - Shows error message
 *      - Suggests contacting support
 *      - May require form correction
 * 
 * ACCESSIBILITY:
 * 
 *   - aria-label describes button action
 *   - aria-busy indicates loading state
 *   - aria-live="polite" for status updates
 *   - Focus management after completion
 *   - Keyboard activation (Enter/Space)
 *   - High contrast color support
 * 
 * RESPONSIVE DESIGN:
 * 
 *   - Touch target min 44x44px
 *   - Full width on mobile
 *   - Inline with form on desktop
 *   - Toast notifications responsive
 * 
 * ============================================================================
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useSendEmail } from '../hooks/useApi';
import './SendEmailButton.css';

/**
 * BUTTON STATES
 * Enum-like constants for button states
 */
const BUTTON_STATES = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
};

/**
 * Toast Notification Component
 * 
 * Displays success/error messages that auto-dismiss.
 */
const Toast = React.memo(({ type, message, onDismiss, duration = 5000 }) => {
  /**
   * AUTO-DISMISS
   * Toast automatically dismisses after duration
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, duration);
    
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);
  
  return (
    <div 
      className={`toast toast--${type}`}
      role="alert"
      aria-live="assertive"
    >
      <span className="toast__icon" aria-hidden="true">
        {type === 'success' ? '✓' : '⚠'}
      </span>
      <span className="toast__message">{message}</span>
      <button
        className="toast__dismiss"
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
});

Toast.displayName = 'Toast';

Toast.propTypes = {
  type: PropTypes.oneOf(['success', 'error']).isRequired,
  message: PropTypes.string.isRequired,
  onDismiss: PropTypes.func.isRequired,
  duration: PropTypes.number,
};

/**
 * Confirmation Dialog Component
 * 
 * Asks user to confirm before sending.
 */
const ConfirmDialog = React.memo(({ 
  isOpen, 
  onConfirm, 
  onCancel, 
  emailData 
}) => {
  const confirmButtonRef = useRef(null);
  
  /**
   * FOCUS MANAGEMENT
   * Focus the confirm button when dialog opens
   */
  useEffect(() => {
    if (isOpen) {
      confirmButtonRef.current?.focus();
    }
  }, [isOpen]);
  
  /**
   * KEYBOARD HANDLER
   * Escape closes dialog
   */
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onCancel]);
  
  if (!isOpen) return null;
  
  return (
    <div 
      className="confirm-dialog-overlay"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div 
        className="confirm-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-dialog-title" className="confirm-dialog__title">
          Confirm Send Email
        </h3>
        <div className="confirm-dialog__content">
          <p>Are you sure you want to send this email?</p>
          <div className="confirm-dialog__details">
            <div><strong>To:</strong> {emailData?.to}</div>
            <div><strong>Subject:</strong> {emailData?.subject || '(No subject)'}</div>
          </div>
        </div>
        <div className="confirm-dialog__actions">
          <button
            className="btn btn-secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            ref={confirmButtonRef}
            className="btn btn-primary"
            onClick={onConfirm}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
});

ConfirmDialog.displayName = 'ConfirmDialog';

ConfirmDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  emailData: PropTypes.shape({
    to: PropTypes.string,
    subject: PropTypes.string,
    body: PropTypes.string,
  }),
};

/**
 * ============================================================================
 * SendEmailButton - Main Component
 * ============================================================================
 * 
 * USAGE:
 * 
 * // Basic usage with email data
 * <SendEmailButton
 *   emailData={{ to: 'user@example.com', subject: 'Hello', body: 'Hi!' }}
 *   onSuccess={(result) => console.log('Email sent:', result)}
 *   onError={(error) => console.log('Error:', error)}
 * />
 * 
 * // With validation callback
 * <SendEmailButton
 *   emailData={formData}
 *   onValidate={() => validateForm()}
 *   onSuccess={handleSuccess}
 * />
 * 
 * PROPS:
 * @param {object} emailData - Email data to send { to, subject, body }
 * @param {function} onValidate - Optional validation callback, return true if valid
 * @param {function} onSuccess - Called on successful send
 * @param {function} onError - Called on send error
 * @param {boolean} requireConfirmation - Show confirmation dialog before sending
 * @param {boolean} disabled - Force disabled state
 * @param {string} className - Additional CSS classes
 * @param {string} children - Custom button text
 */
const SendEmailButton = ({
  emailData,
  onValidate,
  onSuccess,
  onError,
  requireConfirmation,
  disabled,
  className,
  children,
}) => {
  /**
   * STATE MANAGEMENT
   * 
   * Using the useSendEmail hook for API communication.
   * Local state for UI feedback (toast, dialog).
   */
  const { send, loading, error, success, reset } = useSendEmail();
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState(null);
  const buttonRef = useRef(null);
  
  /**
   * DERIVED STATE
   * Calculate button state from hook state
   */
  const buttonState = loading 
    ? BUTTON_STATES.LOADING 
    : error 
      ? BUTTON_STATES.ERROR 
      : success 
        ? BUTTON_STATES.SUCCESS 
        : BUTTON_STATES.IDLE;
  
  /**
   * DETERMINE IF BUTTON SHOULD BE DISABLED
   */
  const isDisabled = disabled || loading || !emailData?.to || !emailData?.body;
  
  /**
   * DISMISS TOAST HANDLER
   */
  const dismissToast = useCallback(() => {
    setToast(null);
    reset();
  }, [reset]);
  
  /**
   * SEND EMAIL HANDLER
   * 
   * ASYNC FLOW:
   * 1. Run validation if provided
   * 2. If confirmation required, show dialog
   * 3. Call API via useSendEmail hook
   * 4. Handle success/error
   * 5. Update UI with feedback
   */
  const handleSend = useCallback(async () => {
    // Step 1: Run validation
    if (onValidate) {
      const isValid = onValidate();
      if (!isValid) {
        return;
      }
    }
    
    // Step 2: Close confirmation dialog if open
    setShowConfirm(false);
    
    try {
      // Step 3: Call API
      const result = await send(emailData);
      
      // Step 4: Handle success
      setToast({
        type: 'success',
        message: 'Email queued for sending successfully!',
      });
      
      if (onSuccess) {
        onSuccess(result);
      }
      
    } catch (err) {
      // Step 5: Handle error
      setToast({
        type: 'error',
        message: err.message || 'Failed to send email. Please try again.',
      });
      
      if (onError) {
        onError(err);
      }
    }
  }, [emailData, onValidate, onSuccess, onError, send]);
  
  /**
   * CLICK HANDLER
   * Shows confirmation dialog if required, otherwise sends directly
   */
  const handleClick = useCallback(() => {
    if (requireConfirmation) {
      setShowConfirm(true);
    } else {
      handleSend();
    }
  }, [requireConfirmation, handleSend]);
  
  /**
   * RETRY HANDLER
   * Retries the last failed send
   */
  const handleRetry = useCallback(() => {
    dismissToast();
    handleSend();
  }, [dismissToast, handleSend]);
  
  /**
   * KEYBOARD HANDLER
   * Enter or Space triggers the button
   */
  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!isDisabled) {
        handleClick();
      }
    }
  }, [isDisabled, handleClick]);
  
  /**
   * FOCUS BUTTON AFTER SUCCESS/ERROR
   * Returns focus to button for keyboard users
   */
  useEffect(() => {
    if (buttonState === BUTTON_STATES.SUCCESS || buttonState === BUTTON_STATES.ERROR) {
      buttonRef.current?.focus();
    }
  }, [buttonState]);
  
  /**
   * RENDER BUTTON CONTENT
   * Different content based on state
   */
  const renderButtonContent = () => {
    switch (buttonState) {
      case BUTTON_STATES.LOADING:
        return (
          <>
            <span className="send-button__spinner" aria-hidden="true"></span>
            <span>Sending...</span>
          </>
        );
      case BUTTON_STATES.SUCCESS:
        return children || 'Send Email';
      case BUTTON_STATES.ERROR:
        return children || 'Send Email';
      default:
        return children || 'Send Email';
    }
  };
  
  return (
    <div className={`send-email-button-wrapper ${className || ''}`}>
      {/* Main Send Button */}
      <button
        ref={buttonRef}
        type="button"
        className={`send-button send-button--${buttonState} btn btn-primary`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        disabled={isDisabled}
        aria-label={
          loading 
            ? 'Sending email, please wait' 
            : `Send email to ${emailData?.to || 'recipient'}`
        }
        aria-busy={loading}
        aria-disabled={isDisabled}
      >
        {renderButtonContent()}
      </button>
      
      {/* Retry Button (shown after error) */}
      {buttonState === BUTTON_STATES.ERROR && (
        <button
          type="button"
          className="send-button__retry btn btn-secondary"
          onClick={handleRetry}
          aria-label="Retry sending email"
        >
          Retry
        </button>
      )}
      
      {/* Screen Reader Status */}
      <div 
        className="visually-hidden" 
        role="status" 
        aria-live="polite"
        aria-atomic="true"
      >
        {loading && 'Sending email...'}
        {success && 'Email sent successfully'}
        {error && `Error: ${error.message}`}
      </div>
      
      {/* Toast Notification */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onDismiss={dismissToast}
        />
      )}
      
      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showConfirm}
        onConfirm={handleSend}
        onCancel={() => setShowConfirm(false)}
        emailData={emailData}
      />
    </div>
  );
};

SendEmailButton.propTypes = {
  emailData: PropTypes.shape({
    to: PropTypes.string,
    subject: PropTypes.string,
    body: PropTypes.string,
  }),
  onValidate: PropTypes.func,
  onSuccess: PropTypes.func,
  onError: PropTypes.func,
  requireConfirmation: PropTypes.bool,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.node,
};

SendEmailButton.defaultProps = {
  emailData: null,
  onValidate: null,
  onSuccess: null,
  onError: null,
  requireConfirmation: false,
  disabled: false,
  className: '',
  children: null,
};

export default SendEmailButton;

/**
 * ============================================================================
 * TemplateEditor Component - ECCS Frontend
 * ============================================================================
 * 
 * COMPONENT OVERVIEW:
 * A form-based editor for creating and editing email templates.
 * Templates are reusable email formats that can be applied when composing.
 * 
 * STATE MANAGEMENT PATTERN:
 * 
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │                     TemplateEditor State                        │
 *   ├─────────────────────────────────────────────────────────────────┤
 *   │                                                                 │
 *   │  Form State (Controlled Components):                            │
 *   │  ┌───────────────────────────────────────────────────────────┐  │
 *   │  │  name: string       - Template display name               │  │
 *   │  │  subject: string    - Email subject line template         │  │
 *   │  │  body: string       - Email body template                 │  │
 *   │  └───────────────────────────────────────────────────────────┘  │
 *   │                                                                 │
 *   │  UI State:                                                      │
 *   │  ┌───────────────────────────────────────────────────────────┐  │
 *   │  │  isDirty: boolean   - Form has unsaved changes            │  │
 *   │  │  errors: object     - Validation error messages           │  │
 *   │  │  isSaving: boolean  - Save operation in progress          │  │
 *   │  │  isPreview: boolean - Preview mode active                 │  │
 *   │  └───────────────────────────────────────────────────────────┘  │
 *   │                                                                 │
 *   └─────────────────────────────────────────────────────────────────┘
 * 
 * REACT STATE MANAGEMENT EXPLANATION:
 * 
 *   1. CONTROLLED COMPONENTS:
 *      - All form inputs are controlled (value comes from state)
 *      - onChange handlers update state on every keystroke
 *      - This provides predictable behavior and easy validation
 * 
 *   2. FORM VALIDATION:
 *      - Validation runs on change and before submit
 *      - Errors are stored in state and displayed inline
 *      - Form is blocked from submission until valid
 * 
 *   3. DIRTY STATE TRACKING:
 *      - Tracks if form has been modified
 *      - Used to warn before navigation with unsaved changes
 *      - Reset when form is saved or explicitly cleared
 * 
 * ASYNC API FLOW FOR SAVING:
 * 
 *   User clicks Save
 *        │
 *        ▼
 *   ┌─────────────────┐
 *   │ Validate Form   │
 *   └────────┬────────┘
 *            │
 *      ┌─────┴─────┐
 *      ▼           ▼
 *   Valid       Invalid
 *      │           │
 *      │           └──► Show error messages
 *      ▼                    │
 *   Set isSaving = true     │
 *      │                    │
 *      ▼                    │
 *   Call API                │
 *      │                    │
 *   ┌──┴──┐                 │
 *   ▼     ▼                 │
 * Success Error             │
 *   │     │                 │
 *   │     └──► Show error ──┤
 *   │              │        │
 *   ▼              ▼        ▼
 * Clear form    Keep form  Keep form
 * Show success  Show retry Enable submit
 * Notify parent            
 * 
 * ACCESSIBILITY FEATURES:
 * 
 *   - All inputs have associated labels (via htmlFor/id)
 *   - Error messages linked to inputs via aria-describedby
 *   - aria-invalid on inputs with validation errors
 *   - aria-required on required fields
 *   - Form uses proper semantic structure
 *   - Focus management after save/error
 *   - Keyboard shortcuts for common actions
 * 
 * RESPONSIVE DESIGN:
 * 
 *   Mobile:
 *   - Full-width form fields
 *   - Stacked layout
 *   - Touch-friendly inputs (min 44px height)
 * 
 *   Desktop:
 *   - Wider form with more padding
 *   - Preview pane beside editor
 *   - Keyboard shortcuts visible
 * 
 * ============================================================================
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTemplates } from '../hooks/useApi';
import './TemplateEditor.css';

/**
 * TEMPLATE VARIABLES
 * 
 * Predefined variables that can be inserted into templates.
 * These are replaced with actual values when the template is used.
 */
const TEMPLATE_VARIABLES = [
  { name: '{{recipient_name}}', description: 'Recipient\'s name' },
  { name: '{{recipient_email}}', description: 'Recipient\'s email' },
  { name: '{{sender_name}}', description: 'Your name' },
  { name: '{{current_date}}', description: 'Today\'s date' },
  { name: '{{company_name}}', description: 'Company name' },
];

/**
 * Variable Picker Component
 * 
 * Dropdown to insert template variables into the editor.
 */
const VariablePicker = React.memo(({ onInsert }) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        menuRef.current && 
        !menuRef.current.contains(event.target) &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = useCallback((variable) => {
    onInsert(variable.name);
    setIsOpen(false);
  }, [onInsert]);

  return (
    <div className="variable-picker">
      <button
        ref={buttonRef}
        type="button"
        className="variable-picker__toggle btn btn-secondary"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Insert template variable"
      >
        + Variable
      </button>
      
      {isOpen && (
        <ul 
          ref={menuRef}
          className="variable-picker__menu"
          role="listbox"
          aria-label="Template variables"
        >
          {TEMPLATE_VARIABLES.map((variable) => (
            <li
              key={variable.name}
              role="option"
              aria-selected="false"
              className="variable-picker__option"
              onClick={() => handleSelect(variable)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelect(variable);
                }
              }}
              tabIndex={0}
            >
              <span className="variable-picker__name">{variable.name}</span>
              <span className="variable-picker__desc">{variable.description}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

VariablePicker.displayName = 'VariablePicker';

VariablePicker.propTypes = {
  onInsert: PropTypes.func.isRequired,
};

/**
 * Preview Component
 * 
 * Shows a preview of the template with sample data.
 */
const TemplatePreview = React.memo(({ subject, body }) => {
  /**
   * SAMPLE DATA FOR PREVIEW
   * Replace template variables with sample values
   */
  const previewData = useMemo(() => {
    const replacements = {
      '{{recipient_name}}': 'John Doe',
      '{{recipient_email}}': 'john.doe@example.com',
      '{{sender_name}}': 'Your Name',
      '{{current_date}}': new Date().toLocaleDateString(),
      '{{company_name}}': 'ECCS Company',
    };

    let previewSubject = subject || '';
    let previewBody = body || '';

    Object.entries(replacements).forEach(([variable, value]) => {
      previewSubject = previewSubject.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), value);
      previewBody = previewBody.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), value);
    });

    return { subject: previewSubject, body: previewBody };
  }, [subject, body]);

  return (
    <div className="template-preview" aria-label="Template preview">
      <h3 className="template-preview__title">Preview</h3>
      <div className="template-preview__email">
        <div className="template-preview__subject">
          <strong>Subject:</strong> {previewData.subject || '(No subject)'}
        </div>
        <div className="template-preview__body">
          {previewData.body || '(No content)'}
        </div>
      </div>
      <p className="template-preview__note">
        Note: Variables are replaced with sample data in this preview.
      </p>
    </div>
  );
});

TemplatePreview.displayName = 'TemplatePreview';

TemplatePreview.propTypes = {
  subject: PropTypes.string,
  body: PropTypes.string,
};

/**
 * ============================================================================
 * TemplateEditor - Main Component
 * ============================================================================
 * 
 * USAGE:
 * 
 * // Create new template
 * <TemplateEditor onSave={(template) => console.log(template)} />
 * 
 * // Edit existing template
 * <TemplateEditor 
 *   template={existingTemplate} 
 *   onSave={(template) => console.log(template)} 
 * />
 * 
 * PROPS:
 * @param {object} template - Existing template to edit (optional)
 * @param {function} onSave - Callback when template is saved
 * @param {function} onCancel - Callback when editing is cancelled
 * @param {function} onDelete - Callback when template is deleted
 */
const TemplateEditor = ({ template, onSave, onCancel, onDelete }) => {
  /**
   * FORM STATE
   * 
   * Using separate state for each field provides:
   * - Fine-grained control over each input
   * - Easy validation per field
   * - Predictable re-renders
   * 
   * Alternative: useReducer for complex forms
   */
  const [name, setName] = useState(template?.name || '');
  const [subject, setSubject] = useState(template?.subject || '');
  const [body, setBody] = useState(template?.body || '');
  
  /**
   * UI STATE
   */
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  /**
   * REFS
   */
  const nameInputRef = useRef(null);
  const bodyTextareaRef = useRef(null);
  
  /**
   * CUSTOM HOOK
   */
  const { saveTemplate, updateTemplate, deleteTemplate } = useTemplates();
  
  /**
   * DIRTY STATE
   * 
   * Computed by comparing current values with original template.
   * Used to warn users about unsaved changes.
   */
  const isDirty = useMemo(() => {
    if (!template) {
      return name || subject || body;
    }
    return (
      name !== template.name ||
      subject !== template.subject ||
      body !== template.body
    );
  }, [name, subject, body, template]);
  
  /**
   * VALIDATION
   * 
   * Runs validation and returns whether form is valid.
   * Sets error messages in state for display.
   */
  const validate = useCallback(() => {
    const newErrors = {};
    
    if (!name.trim()) {
      newErrors.name = 'Template name is required';
    } else if (name.length > 100) {
      newErrors.name = 'Template name must be 100 characters or less';
    }
    
    if (!subject.trim()) {
      newErrors.subject = 'Subject is required';
    } else if (subject.length > 255) {
      newErrors.subject = 'Subject must be 255 characters or less';
    }
    
    if (!body.trim()) {
      newErrors.body = 'Body content is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name, subject, body]);
  
  /**
   * SAVE HANDLER
   * 
   * ASYNC FLOW:
   * 1. Validate form
   * 2. Set saving state (disable button, show spinner)
   * 3. Call API (save or update)
   * 4. On success: notify parent, show success message
   * 5. On error: show error, keep form state
   * 6. Reset saving state
   */
  const handleSave = useCallback(async () => {
    if (!validate()) {
      // Focus first field with error
      if (errors.name) nameInputRef.current?.focus();
      return;
    }
    
    setIsSaving(true);
    setSaveSuccess(false);
    
    try {
      const templateData = { name, subject, body };
      
      let savedTemplate;
      if (template?.id) {
        // Update existing template
        savedTemplate = await updateTemplate(template.id, templateData);
      } else {
        // Create new template
        savedTemplate = await saveTemplate(templateData);
      }
      
      setSaveSuccess(true);
      
      if (onSave) {
        onSave(savedTemplate);
      }
      
      // Clear success message after delay
      setTimeout(() => setSaveSuccess(false), 3000);
      
    } catch (err) {
      setErrors({ submit: err.message || 'Failed to save template' });
    } finally {
      setIsSaving(false);
    }
  }, [name, subject, body, template, validate, saveTemplate, updateTemplate, onSave, errors.name]);
  
  /**
   * DELETE HANDLER
   */
  const handleDelete = useCallback(async () => {
    if (!template?.id) return;
    
    // Confirm deletion
    if (!window.confirm('Are you sure you want to delete this template?')) {
      return;
    }
    
    setIsDeleting(true);
    
    try {
      await deleteTemplate(template.id);
      
      if (onDelete) {
        onDelete(template);
      }
    } catch (err) {
      setErrors({ submit: err.message || 'Failed to delete template' });
    } finally {
      setIsDeleting(false);
    }
  }, [template, deleteTemplate, onDelete]);
  
  /**
   * VARIABLE INSERT HANDLER
   * 
   * Inserts a template variable at cursor position in the body textarea.
   */
  const handleInsertVariable = useCallback((variable) => {
    const textarea = bodyTextareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newBody = body.substring(0, start) + variable + body.substring(end);
    
    setBody(newBody);
    
    // Restore cursor position after variable
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  }, [body]);
  
  /**
   * KEYBOARD SHORTCUTS
   * 
   * Ctrl/Cmd + S: Save template
   * Ctrl/Cmd + P: Toggle preview
   * Escape: Cancel/close
   */
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        setShowPreview(prev => !prev);
      } else if (e.key === 'Escape' && onCancel) {
        if (isDirty && !window.confirm('Discard unsaved changes?')) {
          return;
        }
        onCancel();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, onCancel, isDirty]);
  
  /**
   * FOCUS FIRST INPUT ON MOUNT
   */
  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);
  
  return (
    <div className="template-editor">
      <form 
        className="template-editor__form" 
        onSubmit={(e) => { e.preventDefault(); handleSave(); }}
        aria-label={template ? 'Edit email template' : 'Create email template'}
      >
        <h2 className="template-editor__title">
          {template ? 'Edit Template' : 'New Template'}
        </h2>
        
        {/* Submission Error */}
        {errors.submit && (
          <div className="template-editor__error alert alert-error" role="alert">
            {errors.submit}
          </div>
        )}
        
        {/* Success Message */}
        {saveSuccess && (
          <div className="template-editor__success alert alert-success" role="status">
            Template saved successfully!
          </div>
        )}
        
        {/* Template Name Field */}
        <div className="form-group">
          <label htmlFor="template-name" className="form-label">
            Template Name
            <span className="form-label__required" aria-hidden="true"> *</span>
          </label>
          <input
            ref={nameInputRef}
            id="template-name"
            type="text"
            className={`form-input ${errors.name ? 'form-input--error' : ''}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Welcome Email, Follow-up Template"
            aria-required="true"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'name-error' : undefined}
            disabled={isSaving}
            maxLength={100}
          />
          {errors.name && (
            <span id="name-error" className="form-error" role="alert">
              {errors.name}
            </span>
          )}
        </div>
        
        {/* Subject Field */}
        <div className="form-group">
          <label htmlFor="template-subject" className="form-label">
            Email Subject
            <span className="form-label__required" aria-hidden="true"> *</span>
          </label>
          <input
            id="template-subject"
            type="text"
            className={`form-input ${errors.subject ? 'form-input--error' : ''}`}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g., Welcome to {{company_name}}!"
            aria-required="true"
            aria-invalid={!!errors.subject}
            aria-describedby={errors.subject ? 'subject-error' : 'subject-help'}
            disabled={isSaving}
            maxLength={255}
          />
          <span id="subject-help" className="form-help">
            Use {`{{variable}}`} syntax for dynamic content
          </span>
          {errors.subject && (
            <span id="subject-error" className="form-error" role="alert">
              {errors.subject}
            </span>
          )}
        </div>
        
        {/* Body Field with Variable Picker */}
        <div className="form-group">
          <div className="form-label-row">
            <label htmlFor="template-body" className="form-label">
              Email Body
              <span className="form-label__required" aria-hidden="true"> *</span>
            </label>
            <VariablePicker onInsert={handleInsertVariable} />
          </div>
          <textarea
            ref={bodyTextareaRef}
            id="template-body"
            className={`form-textarea ${errors.body ? 'form-input--error' : ''}`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your email template content here...&#10;&#10;Dear {{recipient_name}},&#10;&#10;Thank you for..."
            aria-required="true"
            aria-invalid={!!errors.body}
            aria-describedby={errors.body ? 'body-error' : undefined}
            disabled={isSaving}
            rows={10}
          />
          {errors.body && (
            <span id="body-error" className="form-error" role="alert">
              {errors.body}
            </span>
          )}
        </div>
        
        {/* Action Buttons */}
        <div className="template-editor__actions">
          <div className="template-editor__actions-left">
            {template?.id && onDelete && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={isSaving || isDeleting}
                aria-busy={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </div>
          
          <div className="template-editor__actions-right">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowPreview(!showPreview)}
              aria-pressed={showPreview}
            >
              {showPreview ? 'Hide Preview' : 'Preview'}
            </button>
            
            {onCancel && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  if (isDirty && !window.confirm('Discard unsaved changes?')) {
                    return;
                  }
                  onCancel();
                }}
                disabled={isSaving}
              >
                Cancel
              </button>
            )}
            
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving || !isDirty}
              aria-busy={isSaving}
            >
              {isSaving ? (
                <>
                  <span className="spinner spinner--small" aria-hidden="true"></span>
                  Saving...
                </>
              ) : (
                'Save Template'
              )}
            </button>
          </div>
        </div>
        
        {/* Keyboard Shortcuts Help */}
        <div className="template-editor__shortcuts" aria-label="Keyboard shortcuts">
          <span>
            <kbd>Ctrl</kbd>+<kbd>S</kbd> Save
          </span>
          <span>
            <kbd>Ctrl</kbd>+<kbd>P</kbd> Preview
          </span>
          {onCancel && (
            <span>
              <kbd>Esc</kbd> Cancel
            </span>
          )}
        </div>
      </form>
      
      {/* Preview Panel */}
      {showPreview && (
        <TemplatePreview subject={subject} body={body} />
      )}
    </div>
  );
};

TemplateEditor.propTypes = {
  template: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    subject: PropTypes.string,
    body: PropTypes.string,
  }),
  onSave: PropTypes.func,
  onCancel: PropTypes.func,
  onDelete: PropTypes.func,
};

TemplateEditor.defaultProps = {
  template: null,
  onSave: null,
  onCancel: null,
  onDelete: null,
};

export default TemplateEditor;

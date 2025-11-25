/**
 * ============================================================================
 * TemplateEditor Component Tests
 * ============================================================================
 * 
 * Test suite for the TemplateEditor component.
 * Tests cover form validation, saving, editing, and accessibility.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TemplateEditor from './TemplateEditor';
import * as useApiModule from '../hooks/useApi';

// Mock the useTemplates hook
jest.mock('../hooks/useApi', () => ({
  useTemplates: jest.fn(),
}));

describe('TemplateEditor', () => {
  const mockSaveTemplate = jest.fn();
  const mockUpdateTemplate = jest.fn();
  const mockDeleteTemplate = jest.fn();
  const mockRefresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementation
    useApiModule.useTemplates.mockReturnValue({
      templates: [],
      loading: false,
      error: null,
      saveTemplate: mockSaveTemplate,
      updateTemplate: mockUpdateTemplate,
      deleteTemplate: mockDeleteTemplate,
      refresh: mockRefresh,
    });

    // Mock window.confirm
    window.confirm = jest.fn(() => true);
  });

  describe('Rendering', () => {
    it('should render new template form', () => {
      render(<TemplateEditor />);
      
      expect(screen.getByText('New Template')).toBeInTheDocument();
      expect(screen.getByLabelText(/template name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email subject/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email body/i)).toBeInTheDocument();
    });

    it('should render edit template form with existing data', () => {
      const template = {
        id: '1',
        name: 'Welcome Email',
        subject: 'Welcome to ECCS',
        body: 'Hello, welcome!',
      };

      render(<TemplateEditor template={template} />);
      
      expect(screen.getByText('Edit Template')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Welcome Email')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Welcome to ECCS')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Hello, welcome!')).toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    it('should show error when name is empty', () => {
      render(<TemplateEditor />);
      
      // Fill only subject and body
      fireEvent.change(screen.getByLabelText(/email subject/i), { target: { value: 'Test Subject' } });
      fireEvent.change(screen.getByLabelText(/email body/i), { target: { value: 'Test Body' } });
      
      // Try to save
      fireEvent.click(screen.getByRole('button', { name: /save template/i }));
      
      expect(screen.getByText(/template name is required/i)).toBeInTheDocument();
    });

    it('should show error when subject is empty', () => {
      render(<TemplateEditor />);
      
      // Fill only name and body
      fireEvent.change(screen.getByLabelText(/template name/i), { target: { value: 'Test Name' } });
      fireEvent.change(screen.getByLabelText(/email body/i), { target: { value: 'Test Body' } });
      
      // Try to save
      fireEvent.click(screen.getByRole('button', { name: /save template/i }));
      
      expect(screen.getByText(/subject is required/i)).toBeInTheDocument();
    });

    it('should show error when body is empty', () => {
      render(<TemplateEditor />);
      
      // Fill only name and subject
      fireEvent.change(screen.getByLabelText(/template name/i), { target: { value: 'Test Name' } });
      fireEvent.change(screen.getByLabelText(/email subject/i), { target: { value: 'Test Subject' } });
      
      // Try to save
      fireEvent.click(screen.getByRole('button', { name: /save template/i }));
      
      expect(screen.getByText(/body content is required/i)).toBeInTheDocument();
    });
  });

  describe('Saving', () => {
    it('should call saveTemplate for new template', async () => {
      const onSave = jest.fn();
      
      mockSaveTemplate.mockResolvedValue({
        id: '1',
        name: 'Test Name',
        subject: 'Test Subject',
        body: 'Test Body',
      });

      render(<TemplateEditor onSave={onSave} />);
      
      fireEvent.change(screen.getByLabelText(/template name/i), { target: { value: 'Test Name' } });
      fireEvent.change(screen.getByLabelText(/email subject/i), { target: { value: 'Test Subject' } });
      fireEvent.change(screen.getByLabelText(/email body/i), { target: { value: 'Test Body' } });
      
      fireEvent.click(screen.getByRole('button', { name: /save template/i }));
      
      await waitFor(() => {
        expect(mockSaveTemplate).toHaveBeenCalledWith({
          name: 'Test Name',
          subject: 'Test Subject',
          body: 'Test Body',
        });
      });
    });

    it('should show success message after save', async () => {
      mockSaveTemplate.mockResolvedValue({
        id: '1',
        name: 'Test Name',
        subject: 'Test Subject',
        body: 'Test Body',
      });

      render(<TemplateEditor />);
      
      fireEvent.change(screen.getByLabelText(/template name/i), { target: { value: 'Test Name' } });
      fireEvent.change(screen.getByLabelText(/email subject/i), { target: { value: 'Test Subject' } });
      fireEvent.change(screen.getByLabelText(/email body/i), { target: { value: 'Test Body' } });
      
      fireEvent.click(screen.getByRole('button', { name: /save template/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/template saved successfully/i)).toBeInTheDocument();
      });
    });
  });

  describe('Cancel', () => {
    it('should call onCancel when cancel button is clicked', () => {
      const onCancel = jest.fn();
      
      render(<TemplateEditor onCancel={onCancel} />);
      
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      
      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper form labels', () => {
      render(<TemplateEditor />);
      
      expect(screen.getByLabelText(/template name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email subject/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email body/i)).toBeInTheDocument();
    });

    it('should mark required fields with aria-required', () => {
      render(<TemplateEditor />);
      
      expect(screen.getByLabelText(/template name/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(/email subject/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(/email body/i)).toHaveAttribute('aria-required', 'true');
    });

    it('should mark invalid fields with aria-invalid when validation fails', async () => {
      render(<TemplateEditor />);
      
      // Type only in subject field (name is still empty, so validation should fail for name)
      const subjectInput = screen.getByLabelText(/email subject/i);
      fireEvent.change(subjectInput, { target: { value: 'Test Subject' } });
      
      // Try to save - name field is empty so validation should fail
      fireEvent.click(screen.getByRole('button', { name: /save template/i }));
      
      // Check that error message appears for name field
      await waitFor(() => {
        expect(screen.getByText(/template name is required/i)).toBeInTheDocument();
      });
      
      // aria-invalid should be true for the name field
      expect(screen.getByLabelText(/template name/i)).toHaveAttribute('aria-invalid', 'true');
    });
  });
});

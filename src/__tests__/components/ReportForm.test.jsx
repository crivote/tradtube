/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@solidjs/testing-library';
import { I18nProvider } from '../../i18n';
import ReportForm from '../../components/ReportForm';

vi.mock('../../lib/supabase', () => ({
  createReport: vi.fn(),
}));

import { createReport } from '../../lib/supabase';

const renderForm = (overrides = {}) => {
  const props = {
    videoId: 'vid-1',
    tuneId: 310,
    onClose: vi.fn(),
    ...overrides,
  };
  return render(() => (
    <I18nProvider>
      <ReportForm {...props} />
    </I18nProvider>
  ));
};

describe('ReportForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createReport.mockResolvedValue();
  });

  it('renders the report form with all fields', async () => {
    renderForm();

    await waitFor(() => {
      expect(screen.getByText('Report issue')).toBeDefined();
    });

    expect(screen.getByText(/Issue type/)).toBeDefined();
    expect(screen.getByText('Description')).toBeDefined();
    expect(screen.getByText('Email (optional)')).toBeDefined();
    expect(screen.getByText('Submit report')).toBeDefined();
  });

  it('calls onClose when clicking the cancel button', async () => {
    const onClose = vi.fn();
    renderForm({ onClose });

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when clicking the backdrop', async () => {
    const onClose = vi.fn();
    const { container } = renderForm({ onClose });

    await waitFor(() => {
      expect(screen.getByText('Report issue')).toBeDefined();
    });

    fireEvent.click(container.firstChild);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not submit when no issue type is selected', async () => {
    renderForm();

    await waitFor(() => {
      expect(screen.getByText('Submit report')).toBeDefined();
    });

    const submitButton = screen.getByText('Submit report').closest('button');
    expect(submitButton.disabled).toBe(true);
    fireEvent.submit(screen.getByText('Report issue').closest('form') || document);
    expect(createReport).not.toHaveBeenCalled();
  });

  it('submits the report with selected type and optional fields', async () => {
    renderForm();

    await waitFor(() => {
      expect(screen.getByText('Submit report')).toBeDefined();
    });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'wrong_tune' } });
    fireEvent.input(screen.getByPlaceholderText('Describe the issue…'), { target: { value: 'Wrong tune mapping' } });
    fireEvent.input(screen.getByPlaceholderText('your@email.com'), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByText('Submit report'));

    await waitFor(() => {
      expect(createReport).toHaveBeenCalledWith(expect.objectContaining({
        media_id: 'vid-1',
        tune_id: 310,
        issue_type: 'wrong_tune',
        description: 'Wrong tune mapping',
        email: 'test@example.com',
      }));
    });

    expect(screen.getByText('Report submitted')).toBeDefined();
  });

  it('requires description when issue type is other', async () => {
    renderForm();

    await waitFor(() => {
      expect(screen.getByText('Submit report')).toBeDefined();
    });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'other' } });

    const submitButton = screen.getByText('Submit report').closest('button');
    expect(submitButton.disabled).toBe(true);
  });

  it('displays an error message when submission fails', async () => {
    createReport.mockRejectedValue(new Error('Network error'));
    renderForm();

    await waitFor(() => {
      expect(screen.getByText('Submit report')).toBeDefined();
    });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'poor_quality' } });
    fireEvent.click(screen.getByText('Submit report'));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeDefined();
    });
  });
});

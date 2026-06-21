/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import Toast from '../../components/Toast';

vi.mock('../../store/appStore', () => ({
  useAppStore: vi.fn(),
}));

import { useAppStore } from '../../store/appStore';

describe('Toast', () => {
  const mockDismiss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.mockReturnValue({ toasts: () => [], dismissToast: mockDismiss });
  });

  it('renders nothing when there are no toasts', () => {
    const { container } = render(() => <Toast />);
    expect(container.firstChild.childNodes.length).toBe(0);
  });

  it('renders a toast message', () => {
    useAppStore.mockReturnValue({
      toasts: () => [{ id: 1, message: 'Hello world', type: 'success' }],
      dismissToast: mockDismiss,
    });

    render(() => <Toast />);

    expect(screen.getByText('Hello world')).toBeDefined();
  });

  it('renders multiple toasts', () => {
    useAppStore.mockReturnValue({
      toasts: () => [
        { id: 1, message: 'First toast', type: 'info' },
        { id: 2, message: 'Second toast', type: 'error' },
      ],
      dismissToast: mockDismiss,
    });

    render(() => <Toast />);

    expect(screen.getByText('First toast')).toBeDefined();
    expect(screen.getByText('Second toast')).toBeDefined();
  });

  it('calls dismissToast when clicking the close button', () => {
    useAppStore.mockReturnValue({
      toasts: () => [{ id: 42, message: 'Dismiss me', type: 'warning' }],
      dismissToast: mockDismiss,
    });

    render(() => <Toast />);
    fireEvent.click(screen.getByText('✕'));

    expect(mockDismiss).toHaveBeenCalledWith(42);
  });

  it('calls action onClick and dismisses the toast', () => {
    const actionOnClick = vi.fn();
    useAppStore.mockReturnValue({
      toasts: () => [
        {
          id: 7,
          message: 'Undo available',
          type: 'info',
          action: { label: 'Undo', onClick: actionOnClick },
        },
      ],
      dismissToast: mockDismiss,
    });

    render(() => <Toast />);
    fireEvent.click(screen.getByText('Undo'));

    expect(actionOnClick).toHaveBeenCalled();
    expect(mockDismiss).toHaveBeenCalledWith(7);
  });
});

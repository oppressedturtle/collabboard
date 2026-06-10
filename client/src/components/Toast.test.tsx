import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider } from './Toast';
import { useToast } from './useToast';

function ToastTrigger({ message, type = 'info' }: { message: string; type?: 'info' | 'success' | 'error' }) {
  const { toast } = useToast();
  return (
    <button type="button" onClick={() => toast(message, type)}>
      Show toast
    </button>
  );
}

describe('Toast system', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders children inside the provider', () => {
    render(
      <ToastProvider>
        <span>hello</span>
      </ToastProvider>,
    );
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('shows a toast when show() is called', async () => {
    render(
      <ToastProvider>
        <ToastTrigger message="Something happened" />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: /show toast/i }));
    expect(screen.getByText('Something happened')).toBeInTheDocument();
  });

  it('removes the toast when the dismiss button is clicked', async () => {
    render(
      <ToastProvider>
        <ToastTrigger message="Dismiss me" />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: /show toast/i }));
    expect(screen.getByText('Dismiss me')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /dismiss notification/i }));
    expect(screen.queryByText('Dismiss me')).not.toBeInTheDocument();
  });

  it('auto-dismisses after 4 seconds', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ToastTrigger message="Auto-gone" />
      </ToastProvider>,
    );

    act(() => { fireEvent.click(screen.getByRole('button', { name: /show toast/i })); });
    expect(screen.getByText('Auto-gone')).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(4100); });
    expect(screen.queryByText('Auto-gone')).not.toBeInTheDocument();
  });
});

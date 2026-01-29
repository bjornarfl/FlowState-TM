import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';
import { ToastProvider } from '../contexts/ToastContext';

// Custom render function with common providers
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(
    <ToastProvider>
      {ui}
    </ToastProvider>,
    { ...options }
  );
}

// Re-export everything from testing library
// eslint-disable-next-line react-refresh/only-export-components
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';

import React from 'react';
import { DevtoolsView } from '../../../src/renderer/components/devtools-view';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/renderer/processor/trace');

describe('DevtoolsView', () => {
  it('shows empty state when no trace PID is selected', () => {
    render(
      <DevtoolsView
        state={{ selectedTracePid: undefined } as any}
        file={
          {
            fileName:
              '1716564127669_d0c88b08-8e83-4b9f-b300-ea1c4b30482e_T6CRBK18E_U06UEEBA42D_1716564062798_1.trace',
            fullPath: 'foo-bar',
          } as any
        }
      />,
    );

    expect(
      screen.getByText('Select a process from the sidebar to view its trace'),
    ).toBeInTheDocument();
  });

  it('renders an iframe when a trace PID is selected', () => {
    render(
      <DevtoolsView
        state={{ selectedTracePid: 91908 } as any}
        file={
          {
            fileName:
              '1716564127669_d0c88b08-8e83-4b9f-b300-ea1c4b30482e_T6CRBK18E_U06UEEBA42D_1716564062798_1.trace',
            fullPath: 'foo-bar',
          } as any
        }
      />,
    );

    const iframe = screen.getByTitle('DevTools embed');
    expect(iframe).toBeInTheDocument();
  });
});

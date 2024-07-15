import React from 'react';
import { DevtoolsView } from '../../../src/renderer/components/devtools-view';
import { fireEvent, render, screen, within } from '@testing-library/react';

jest.mock('../../../src/renderer/processor/trace');

describe('DevtoolsView', () => {
  it('renders a table containing a list of trace threads', () => {
    render(
      <DevtoolsView
        state={
          {
            traceThreads: [
              {
                type: 'browser',
                processId: 91908,
                title: 'Main process',
                pid: 91908,
                tid: 259,
                ts: 9007199254740991,
                isClient: false,
              },
              {
                type: 'renderer',
                processId: 91918,
                data: {
                  frame: '',
                  url: 'https://slack.com/unknown?name=',
                  processId: 91918,
                },
                title: 'Renderer process',
                isClient: false,
              },
            ],
          } as any
        }
        file={
          {
            fileName:
              '1716564127669_d0c88b08-8e83-4b9f-b300-ea1c4b30482e_T6CRBK18E_U06UEEBA42D_1716564062798_1.trace',
            fullPath: 'foo-bar',
          } as any
        }
      />,
    );

    const threadsTable = screen.getByRole('table');
    expect(threadsTable).toBeInTheDocument();
  });

  it('opens an iframe of the devtools frontend', () => {
    render(
      <DevtoolsView
        state={
          {
            traceThreads: [
              {
                type: 'browser',
                processId: 91908,
                title: 'Main process',
                pid: 91908,
                tid: 259,
                ts: 9007199254740991,
                isClient: false,
              },
            ],
          } as any
        }
        file={
          {
            fileName:
              '1716564127669_d0c88b08-8e83-4b9f-b300-ea1c4b30482e_T6CRBK18E_U06UEEBA42D_1716564062798_1.trace',
            fullPath: 'foo-bar',
          } as any
        }
      />,
    );

    const row = screen.getByRole('row', { name: /Main process/ });
    const btn = within(row).getByRole('button');
    fireEvent.click(btn);

    const iframe = screen.getByTitle('DevTools embed');
    expect(iframe).toBeInTheDocument();
  });
});

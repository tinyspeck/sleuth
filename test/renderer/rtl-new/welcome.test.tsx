import React from 'react';
import { Welcome } from '../../../src/renderer/components/welcome';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SleuthState } from '../../../src/renderer/state/sleuth';
import { ipcRenderer, shell } from 'electron';

jest.mock('electron');

describe('Welcome', () => {
  it('renders the Sleuth title', () => {
    const state: Partial<SleuthState> = {
      suggestions: []
    };
    render(<Welcome state={state as SleuthState} />);
    const title = screen.getByRole('heading', { level: 1 });
    expect(title).toHaveTextContent('Sleuth');
  });

  describe('Suggestion List', () => {
    it('renders a list of suggestions', () => {
      const state = {
        suggestions: [
          {
            filePath: '/Users/ezhao/Downloads/logs-21-11-02_12-36-26.zip',
            age: '7 days'
          }
        ]
      };
      render(<Welcome state={state as SleuthState} />);
      const list = screen.getByRole('list');
      const suggestions = within(list).getAllByRole('listitem');
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].textContent).toContain('logs-21-11-02_12-36-26.zip');

      const ageLabel = within(suggestions[0]).getByRole('textbox');
      expect(ageLabel).toHaveValue('7 days old');
    });

    it('triggers a message box when', async () => {
        (ipcRenderer.invoke as jest.Mock).mockResolvedValue({
          response: true
        });
        const state = {
          suggestions: [
            {
              filePath: '/Users/ezhao/Downloads/logs-21-11-02_12-36-26.zip',
              age: '7 days',
            }
          ],
        };
        render(<Welcome state={state as SleuthState} />);
        const list = screen.getByRole('list');
        const suggestions = within(list).getAllByRole('listitem');
        const btn = within(suggestions[0]).getByRole('button', {
          name: 'trash'
        });
        fireEvent.click(btn);
        await waitFor(() => expect(shell.trashItem).toHaveBeenCalledWith('/Users/ezhao/Downloads/logs-21-11-02_12-36-26.zip'));
      });
  });

  describe('Delete All button', () => {
    it('renders the delete button if we have files older than 2 days', () => {
      const state = {
        suggestions: [
          {
            filePath: '/path/to/file/',
            age: 'dummy age string',
            mtimeMs: Date.now() - 1000 * 60 * 60 * 24 * 3 // 3 days old
          }
        ]
      };
      render(<Welcome state={state as SleuthState} />);
      const btn = screen.getByText('Delete files older than 2 days');
      expect(btn).toBeInTheDocument();
    });

    it('does not render the delete all button if all files are newer than 2 days', () => {
      const state = {
        suggestions: [
          {
            filePath: '/path/to/file/',
            age: 'dummy age string',
            mtimeMs: Date.now() - 1000 * 60 * 60 * 24 * 1 // 1 day old
          }
        ]
      };
      render(<Welcome state={state as SleuthState} />);
      const btn = screen.queryByText('Delete files older than 2 days');
      expect(btn).not.toBeInTheDocument();
    });
  });

});

import React from 'react';
import { Welcome } from '../../../src/renderer/components/welcome';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { SleuthState } from '../../../src/renderer/state/sleuth';
import { ipcRenderer, shell } from 'electron';

jest.mock('electron');

describe('Welcome', () => {
  beforeAll(() => {
    window.matchMedia = () =>
      ({
        addListener: () => void 0,
        removeListener: () => void 0,
      }) as any;
  });

  beforeEach(() => {
    // fake getPath("downloads") for the Watcher
    (ipcRenderer.invoke as jest.Mock).mockResolvedValue(process.cwd());
  });

  it('renders the Sleuth title', () => {
    const state: Partial<SleuthState> = {
      suggestions: [],
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
            age: '7 days',
          },
        ],
      };
      render(<Welcome state={state as SleuthState} />);
      const list = screen.getAllByRole('list')[0];
      const suggestions = within(list).getAllByRole('listitem');
      // 1 item, 1 listitem in the "delete" action menu
      expect(suggestions).toHaveLength(2);
      expect(suggestions[0].textContent).toContain(
        'logs-21-11-02_12-36-26.zip',
      );
      expect(suggestions[0].textContent).toContain('7 days old');

      expect(suggestions[1].textContent).toContain('Delete');
    });

    it('triggers a message box when', async () => {
      const state = {
        suggestions: [
          {
            filePath: '/Users/ezhao/Downloads/logs-21-11-02_12-36-26.zip',
            age: '7 days',
          },
        ],
        getSuggestions: jest.fn(),
      };
      render(<Welcome state={state as unknown as SleuthState} />);
      const list = screen.getAllByRole('list')[0];
      const suggestions = within(list).getAllByRole('listitem');
      const btn = within(suggestions[0]).getByLabelText('delete');
      (ipcRenderer.invoke as jest.Mock).mockResolvedValue({
        response: true,
      });
      fireEvent.click(btn);
      await waitFor(() =>
        expect(shell.trashItem).toHaveBeenCalledWith(
          '/Users/ezhao/Downloads/logs-21-11-02_12-36-26.zip',
        ),
      );
    });
  });

  describe('Delete Stale button', () => {
    it('renders the delete button if we have files older than this week', () => {
      const state = {
        suggestions: [
          {
            filePath: '/path/to/file/',
            age: 'dummy age string',
            mtimeMs: Date.now() - 1000 * 60 * 60 * 24 * 11, // 11 days old
          },
        ],
      };
      render(<Welcome state={state as SleuthState} />);
      const btn = screen.getByText('Delete stale logs');
      expect(btn).toBeInTheDocument();
    });

    it('does not render the delete all button if all files are newer than 7 days', () => {
      const state = {
        suggestions: [
          {
            filePath: '/path/to/file/',
            age: 'dummy age string',
            mtimeMs: Date.now() - 1000 * 60 * 60 * 24 * 2, // 2 days old
          },
        ],
      };
      render(<Welcome state={state as SleuthState} />);
      const btn = screen.queryByText('Delete stale logs');
      expect(btn).not.toBeInTheDocument();
    });
  });
});

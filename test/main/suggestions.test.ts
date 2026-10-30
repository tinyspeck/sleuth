import { describe, expect, it, vi } from 'vitest';
import path from 'path';

import { getItemsInSuggestionFolders } from '../../src/main/filesystem/suggestions';

const fixtures = path.join(__dirname, '../static/suggestions');

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) =>
      name === 'downloads' ? fixtures : '/nonexistent/sleuth-test',
  },
  dialog: {},
  shell: {},
}));

describe('getItemsInSuggestionFolders', () => {
  it('reads a bundle with a stored entry whose sizes mismatch', async () => {
    const suggestions = await getItemsInSuggestionFolders();
    const suggestion = suggestions.find(
      (s) => path.basename(s.filePath) === 'logs-stored-size-mismatch.zip',
    );

    expect(suggestion).not.toHaveProperty('error');
    expect(suggestion).toMatchObject({
      platform: 'darwin',
      appVersion: '4.99.0',
      instanceUuid: 'test-instance-uuid',
    });
  });

  it('reports an error for oversized metadata instead of buffering it', async () => {
    const suggestions = await getItemsInSuggestionFolders();
    const suggestion = suggestions.find(
      (s) => path.basename(s.filePath) === 'logs-large-metadata.zip',
    );

    expect(suggestion).toMatchObject({
      error: new Error('environment.json is too large'),
    });
  });
});

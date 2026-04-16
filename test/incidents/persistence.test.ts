import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

import {
  loadPersistedStore,
  writeStoreAtomically,
} from '../../src/incidents/persistence';

const tempDir = join(process.cwd(), 'tmp-test-persistence');
const filePath = join(tempDir, 'incidents.json');

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('persistence', () => {
  test('writes and reloads typed store state', async () => {
    await mkdir(tempDir, { recursive: true });

    await writeStoreAtomically(filePath, {
      incidents: [],
      nextIncidentNumber: 4,
    });

    const persisted = await loadPersistedStore(filePath);

    expect(persisted.nextIncidentNumber).toBe(4);
    expect(persisted.incidents).toHaveLength(0);
  });

  test('returns empty store for missing files', async () => {
    const persisted = await loadPersistedStore(filePath);

    expect(persisted.nextIncidentNumber).toBe(1);
    expect(persisted.incidents).toHaveLength(0);
  });
});

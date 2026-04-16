import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import {
  persistedStoreSchema,
  type PersistedStore,
} from './persistence-types';

export const loadPersistedStore = async (
  filePath: string,
): Promise<PersistedStore> => {
  try {
    const raw = await readFile(filePath, 'utf8');
    return persistedStoreSchema.parse(JSON.parse(raw));
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return {
        incidents: [],
        nextIncidentNumber: 1,
      };
    }

    throw error;
  }
};

export const writeStoreAtomically = async (
  filePath: string,
  store: PersistedStore,
) => {
  const tmpPath = `${filePath}.${crypto.randomUUID()}.tmp`;

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(tmpPath, JSON.stringify(store, null, 2), 'utf8');
  await rename(tmpPath, filePath);
};

import { test as base, type Page } from '@playwright/test';
import { TID } from '../helpers/test-ids';

/**
 * Fixture: create/cleanup test apps.
 * Provides helpers to create from template and track created app IDs for cleanup.
 */
type AppsFixtures = {
  /** List of app IDs created during the test (for future teardown) */
  createdAppIds: string[];
};

export const appsTest = base.extend<AppsFixtures>({
  createdAppIds: async ({}, use) => {
    const ids: string[] = [];
    await use(ids);
    // Teardown: could delete apps here via API in the future
  },
});

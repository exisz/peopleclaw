import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { starterAppTemplate } from './starter-app';

describe('Starter app template safety', () => {
  it('TC-PC-089 proves starter-app template has no SaaS-specific core code', () => {
    const forbiddenCoreCouplings = [
      /from ['"]\.\.\/\.\.\/routes\//,
      /from ['"]\.\.\/\.\.\/lib\/prisma/,
      /from ['"]@prisma\/client/,
      /getPrisma\(/,
      /app\.peopleclaw\.rollersoft\.com\.au/,
      /admin\.peopleclaw\.rollersoft\.com\.au/,
      /tenantId\s*===\s*['"][^'"]+['"]/,
      /appId\s*===\s*['"][^'"]+['"]/,
    ];

    for (const component of starterAppTemplate.components) {
      for (const forbidden of forbiddenCoreCouplings) {
        assert.doesNotMatch(
          component.code,
          forbidden,
          `${component.name} should stay a portable app artifact, not core SaaS-specific code`,
        );
      }
    }
  });
});

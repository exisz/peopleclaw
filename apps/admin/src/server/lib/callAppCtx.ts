/**
 * ctx.callApp — App-to-App call helper injected into running components (PLANET-1459).
 *
 * Tenant-scoped: the caller's tenantId is captured at build time; ctx.callApp can
 * only invoke components in apps owned by the same tenant. Cross-tenant calls
 * throw the same "not in your tenant" error the HTTP endpoint returns.
 */
import { getPrisma } from './prisma.js';
import { runComponentSync, type ComponentWithApp } from './componentInvoker.js';
import { buildAppStoreCtx } from './appStoreCtx.js';

export type CallAppFn = (
  targetAppId: string,
  componentId: string,
  input?: any,
) => Promise<unknown>;

export function buildCallAppCtx(callerTenantId: string): CallAppFn {
  return async function callApp(targetAppId, componentId, input) {
    if (typeof targetAppId !== 'string' || !targetAppId) {
      throw new Error('callApp: targetAppId is required');
    }
    if (typeof componentId !== 'string' || !componentId) {
      throw new Error('callApp: componentId is required');
    }
    const prisma = getPrisma();
    const targetApp = await prisma.app.findFirst({
      where: { id: targetAppId, tenantId: callerTenantId },
    });
    if (!targetApp) {
      throw new Error('callApp: target app not in your tenant');
    }
    const component = await prisma.component.findFirst({
      where: { id: componentId, appId: targetApp.id },
      include: { app: true },
    });
    if (!component) {
      throw new Error('callApp: component not found');
    }
    if (!(component as any).isExported) {
      throw new Error('callApp: component is not exported (isExported=false)');
    }
    // Recursive callApp for nested invocations.
    const nestedCallApp = buildCallAppCtx(callerTenantId);
    const appStore = buildAppStoreCtx(targetApp.id);
    const { result } = await runComponentSync(
      component as ComponentWithApp,
      input ?? {},
      { extraCtx: { callApp: nestedCallApp, appStore, input: input ?? {} } },
    );
    return result;
  };
}

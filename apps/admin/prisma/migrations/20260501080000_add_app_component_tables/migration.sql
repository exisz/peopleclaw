-- PLANET-1415: Add App, Component, ComponentConnection tables
-- Safe: CREATE TABLE only, no existing tables touched

CREATE TABLE "App" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "App_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "Component" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "runtime" TEXT NOT NULL DEFAULT 'PEOPLECLAW_CLOUD',
    "code" TEXT NOT NULL DEFAULT '',
    "inputSchema" TEXT,
    "outputSchema" TEXT,
    "probes" TEXT,
    "canvasX" INTEGER NOT NULL DEFAULT 0,
    "canvasY" INTEGER NOT NULL DEFAULT 0,
    "icon" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Component_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ComponentConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appId" TEXT NOT NULL,
    "fromComponentId" TEXT NOT NULL,
    "toComponentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ComponentConnection_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ComponentConnection_fromComponentId_fkey" FOREIGN KEY ("fromComponentId") REFERENCES "Component" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ComponentConnection_toComponentId_fkey" FOREIGN KEY ("toComponentId") REFERENCES "Component" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "App_tenantId_idx" ON "App"("tenantId");
CREATE INDEX "Component_appId_idx" ON "Component"("appId");
CREATE INDEX "ComponentConnection_appId_idx" ON "ComponentConnection"("appId");
CREATE UNIQUE INDEX "ComponentConnection_fromComponentId_toComponentId_type_key" ON "ComponentConnection"("fromComponentId", "toComponentId", "type");

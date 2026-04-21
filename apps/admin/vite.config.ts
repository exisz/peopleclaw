import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

function getGitShortSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'dev-local';
  }
}

function getGitBranch(): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'dev-local';
  }
}

function getGitSha(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'dev-local';
  }
}

export default defineConfig({
  root: 'src/client',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
  define: {
    // Vercel injects VERCEL_GIT_COMMIT_SHA etc. at build time.
    // Fallback to git CLI for local dev.
    'import.meta.env.VITE_BUILD_SHA': JSON.stringify(
      process.env.VERCEL_GIT_COMMIT_SHA ?? getGitSha()
    ),
    'import.meta.env.VITE_BUILD_SHORT_SHA': JSON.stringify(
      process.env.VERCEL_GIT_COMMIT_SHORT_SHA ?? getGitShortSha()
    ),
    'import.meta.env.VITE_BUILD_BRANCH': JSON.stringify(
      process.env.VERCEL_GIT_COMMIT_REF ?? getGitBranch()
    ),
    'import.meta.env.VITE_BUILD_MESSAGE': JSON.stringify(
      process.env.VERCEL_GIT_COMMIT_MESSAGE ?? ''
    ),
    'import.meta.env.VITE_BUILD_AT': JSON.stringify(
      new Date().toISOString()
    ),
  },
});

#!/usr/bin/env node
// Copy the PeopleClaw agent-skill templates into a target repo.
// Usage:
//   node packages/agent-skill/bin/install.mjs [install] [--dest <dir>] [--merge] [--force] [--no-skill]
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_DIR = path.resolve(__dirname, '..', 'templates');

const MARKER_BEGIN = '<!-- PEOPLECLAW-AGENT-SKILL:BEGIN';
const MARKER_END = '<!-- PEOPLECLAW-AGENT-SKILL:END -->';

function parseArgs(argv) {
  const out = { dest: process.cwd(), merge: false, force: false, skill: true };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === 'install' || a === 'help' || a === '--help' || a === '-h') {
      if (a === 'help' || a === '--help' || a === '-h') out.help = true;
      continue;
    }
    if (a === '--dest') { out.dest = argv[++i]; continue; }
    if (a.startsWith('--dest=')) { out.dest = a.slice('--dest='.length); continue; }
    if (a === '--merge') { out.merge = true; continue; }
    if (a === '--force') { out.force = true; continue; }
    if (a === '--no-skill') { out.skill = false; continue; }
    console.error(`Unknown arg: ${a}`);
    process.exit(2);
  }
  return out;
}

function usage() {
  console.log(`peopleclaw-agent-skill install [--dest <dir>] [--merge] [--force] [--no-skill]

Copies the PeopleClaw agent-skill templates (AGENTS.md, SKILL.md, QUICKSTART.md,
TROUBLESHOOTING.md) into <dir> (default: current directory).

  --dest <dir>   Target directory (default: cwd).
  --merge        If AGENTS.md exists, append/replace the PeopleClaw section
                 between the managed BEGIN/END markers instead of overwriting.
  --force        Overwrite existing files unconditionally.
  --no-skill     Skip SKILL.md.`);
}

function readTemplate(name) {
  return fs.readFileSync(path.join(TEMPLATES_DIR, name), 'utf8');
}

function writeFresh(targetPath, contents, { force }) {
  if (fs.existsSync(targetPath) && !force) {
    console.log(`skip   ${targetPath} (exists; pass --force to overwrite)`);
    return false;
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, contents);
  console.log(`write  ${targetPath}`);
  return true;
}

function mergeAgentsMd(targetPath, snippet) {
  const block = snippet.trim();
  if (!fs.existsSync(targetPath)) {
    fs.writeFileSync(targetPath, `${block}\n`);
    console.log(`write  ${targetPath} (new)`);
    return;
  }
  const existing = fs.readFileSync(targetPath, 'utf8');
  const beginIdx = existing.indexOf(MARKER_BEGIN);
  const endIdx = existing.indexOf(MARKER_END);
  if (beginIdx !== -1 && endIdx !== -1 && endIdx > beginIdx) {
    const before = existing.slice(0, beginIdx);
    const after = existing.slice(endIdx + MARKER_END.length);
    const next = `${before}${block}${after}`.replace(/\n{3,}/g, '\n\n');
    fs.writeFileSync(targetPath, next.endsWith('\n') ? next : `${next}\n`);
    console.log(`merge  ${targetPath} (replaced existing PeopleClaw block)`);
    return;
  }
  const sep = existing.endsWith('\n') ? '\n' : '\n\n';
  fs.writeFileSync(targetPath, `${existing}${sep}${block}\n`);
  console.log(`merge  ${targetPath} (appended PeopleClaw block)`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { usage(); return; }
  const dest = path.resolve(args.dest);
  fs.mkdirSync(dest, { recursive: true });

  const agentsTpl = readTemplate('AGENTS.md');
  const skillTpl = readTemplate('SKILL.md');
  const quickTpl = readTemplate('QUICKSTART.md');
  const troubleTpl = readTemplate('TROUBLESHOOTING.md');

  const agentsTarget = path.join(dest, 'AGENTS.md');
  if (args.merge) {
    mergeAgentsMd(agentsTarget, agentsTpl);
  } else {
    writeFresh(agentsTarget, agentsTpl, { force: args.force });
  }

  if (args.skill) {
    writeFresh(path.join(dest, 'SKILL.md'), skillTpl, { force: args.force });
  }
  writeFresh(path.join(dest, 'docs', 'peopleclaw-agent', 'QUICKSTART.md'), quickTpl, { force: args.force });
  writeFresh(path.join(dest, 'docs', 'peopleclaw-agent', 'TROUBLESHOOTING.md'), troubleTpl, { force: args.force });

  console.log('\nDone. Next:');
  console.log('  1. Mint an app-scoped pc_m2m_ key from PeopleClaw → App → System → Connect Codex.');
  console.log('  2. export PEOPLECLAW_API_KEY=pc_m2m_...   # and ensure your agent runner sees it');
  console.log('  3. peopleclaw whoami --json');
}

main();

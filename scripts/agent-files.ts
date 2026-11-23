#!/usr/bin/env bun
/**
 * Check the agent instruction files against the core standard (C8).
 *
 * - Every skill has SKILL.md with `name` and `description` frontmatter.
 * - Every Claude Code symlink is relative, points at the matching skill, and
 *   resolves.
 * - The two skill sets are identical.
 * - Every `just <recipe>` named in a skill exists in the justfile.
 */
import {
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  readlinkSync,
} from "node:fs";
import { join } from "node:path";

const skillsRoot = ".agents/skills";
const claudeRoot = ".claude/skills";
const errors: string[] = [];

function fail(message: string): void {
  errors.push(message);
}

function directories(root: string): string[] {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

const justfile = readFileSync("justfile", "utf8");
const recipes = new Set(
  [...justfile.matchAll(/^([a-z][a-z0-9-]*)(?:\s[^:\n]*)?:/gm)].map(
    (match) => match[1] as string,
  ),
);

const skills = directories(skillsRoot);
for (const skill of skills) {
  const skillFile = join(skillsRoot, skill, "SKILL.md");
  if (!existsSync(skillFile)) {
    fail(`${skillFile}: missing`);
    continue;
  }
  const text = readFileSync(skillFile, "utf8");
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!frontmatter) {
    fail(`${skillFile}: missing YAML frontmatter`);
  } else {
    const body = frontmatter[1] ?? "";
    if (!/^name:\s*\S+/m.test(body)) {
      fail(`${skillFile}: frontmatter needs a name`);
    }
    if (!/^description:\s*\S+/m.test(body)) {
      fail(`${skillFile}: frontmatter needs a description`);
    }
  }

  for (const match of text.matchAll(/`just ([a-z][a-z0-9-]*)`/g)) {
    const recipe = match[1] as string;
    if (!recipes.has(recipe)) {
      fail(`${skillFile}: names missing recipe 'just ${recipe}'`);
    }
  }
}

const claudeEntries = readdirSync(claudeRoot, { withFileTypes: true })
  .map((entry) => entry.name)
  .sort();

for (const name of claudeEntries) {
  const path = join(claudeRoot, name);
  if (!lstatSync(path).isSymbolicLink()) {
    fail(`${path}: must be a symlink, not a real directory or file`);
    continue;
  }
  const target = readlinkSync(path);
  const expected = `../../.agents/skills/${name}`;
  if (target !== expected) {
    fail(`${path}: points at '${target}', expected '${expected}'`);
  }
  if (!existsSync(path)) {
    fail(`${path}: broken symlink`);
  }
}

for (const skill of skills) {
  if (!claudeEntries.includes(skill)) {
    fail(`${claudeRoot}/${skill}: missing symlink for ${skillsRoot}/${skill}`);
  }
}
for (const name of claudeEntries) {
  if (!skills.includes(name)) {
    fail(`${claudeRoot}/${name}: has no matching skill in ${skillsRoot}`);
  }
}

if (errors.length > 0) {
  console.error(`agent files: ${errors.length} problem(s)`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`agent files: ok (${skills.length} skill(s))`);

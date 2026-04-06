import enums from '@moddota/dota-data/files/vscripts/enums';
import { inlineDesc, wrapDescription } from '../utils';
import { isGlobalEnumMember, normalizeEnumMemberName, normalizeEnumName } from './normalize';

function descLines(text: string): string[] {
  return wrapDescription(text)
    .split('\n')
    .map((l) => `--- ${l}`);
}

export function generateLuaEnumDeclarations(normalize: boolean): string[] {
  const blocks: string[] = [];

  for (const declaration of enums) {
    if (declaration.kind === 'constant') {
      const lines: string[] = [];

      if (declaration.description) {
        lines.push(...descLines(declaration.description));
      }

      lines.push(`---@type integer`);
      lines.push(`${declaration.name} = ${declaration.value}`);
      blocks.push(lines.join('\n'));
      continue;
    }

    // It's an enum
    const [globalMembers, enumMembers] = partition(declaration.members, (m) =>
      isGlobalEnumMember(m, declaration),
    );

    if (normalize) {
      // Emit global/count members as top-level integer constants
      for (const m of globalMembers) {
        const lines: string[] = [];

        if (m.description) {
          lines.push(...descLines(m.description));
        }

        lines.push(`---@type integer`);
        lines.push(`${m.name} = ${m.value}`);
        blocks.push(lines.join('\n'));
      }
    }

    const members = normalize ? enumMembers : declaration.members;

    if (members.length === 0) {
      continue;
    }

    const enumName = normalize ? normalizeEnumName(declaration.name) : declaration.name;

    const lines: string[] = [];

    if (declaration.description) {
      lines.push(...descLines(declaration.description));
    }

    lines.push(`---@enum ${enumName}`);
    lines.push(`${enumName} = {`);

    for (const m of members) {
      const memberName = normalize ? normalizeEnumMemberName(m.name, declaration) : m.name;
      // Enum member names starting with a digit need quoting
      const key = /^\d/.test(memberName) ? `["${memberName}"]` : memberName;
      const desc = m.description ? `  -- ${inlineDesc(m.description)}` : '';
      lines.push(`    ${key} = ${m.value},${desc}`);
    }

    lines.push(`}`);
    blocks.push(lines.join('\n'));
  }

  return blocks;
}

function partition<T>(arr: T[], predicate: (item: T) => boolean): [T[], T[]] {
  const yes: T[] = [];
  const no: T[] = [];

  for (const item of arr) {
    if (predicate(item)) {
      yes.push(item);
    } else {
      no.push(item);
    }
  }

  return [yes, no];
}

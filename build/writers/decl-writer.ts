import type { InlineDescFormatter } from '../formatters/inline-desc-formatter';
import type { WrapDescriptionFormatter } from '../formatters/wrap-description-formatter';
import type { LuaAliasModel } from '../models/lua-alias-model';
import type { LuaClassModel } from '../models/lua-class-model';
import type { LuaDeclModel } from '../models/lua-decl-model';
import type { LuaEnumModel } from '../models/lua-enum-model';
import type { LuaGlobalFunctionModel } from '../models/lua-global-function-model';
import type { LuaMethodModel } from '../models/lua-method-model';
import type { LuaParamModel } from '../models/lua-param-model';
import type { LuaTypeRefModel } from '../models/lua-type-ref-model';

export class DeclWriter {
  private enumNames: Set<string> = new Set();
  private enumFirstMember: Map<string, string> = new Map();

  constructor(
    private readonly wrapFormatter: WrapDescriptionFormatter,
    private readonly inlineFormatter: InlineDescFormatter,
  ) {}

  /** Call before write() to inform the writer which names are enums and their first member. */
  setEnumNames(names: Set<string>): void {
    this.enumNames = names;
  }

  setEnumFirstMembers(map: Map<string, string>): void {
    this.enumFirstMember = map;
  }

  write(decl: LuaDeclModel): string[] {
    switch (decl.kind) {
      case 'class':   return this.writeClass(decl);
      case 'enum':    return this.writeEnum(decl);
      case 'alias':   return this.writeAlias(decl);
      case 'function': return this.writeGlobalFunction(decl);
    }
  }

  // ── Type rendering ──────────────────────────────────────────────────────────

  private renderType(type: LuaTypeRefModel): string {
    switch (type.kind) {
      case 'primitive':
        return type.name;
      case 'named':
        return type.name;
      case 'array':
        return `${this.renderType(type.element)}[]`;
      case 'union':
        return type.types.map((t) => this.renderType(t)).join('|');
      case 'fun': {
        const params = type.params
          .map((p) => `${p.name}: ${this.renderType(p.type)}`)
          .join(', ');
        const returns = type.returns.filter((r) => !(r.kind === 'primitive' && r.name === 'nil'));
        const retStr = returns.length > 0 ? `: ${returns.map((r) => this.renderType(r)).join(', ')}` : '';
        return `fun(${params})${retStr}`;
      }
      case 'table': {
        const key = this.renderType(type.key);
        const value = this.renderType(type.value);
        return `table<${key}, ${value}>`;
      }
    }
  }

  // ── Return stub ─────────────────────────────────────────────────────────────

  private returnStub(returns: LuaTypeRefModel[]): string | null {
    if (returns.length === 0) return null;

    const stubs = returns.map((r) => this.singleReturnStub(r));
    if (stubs.every((s) => s === null)) return null;
    return stubs.map((s) => s ?? 'nil').join(', ');
  }

  private singleReturnStub(type: LuaTypeRefModel): string | null {
    // Union containing nil → nil
    if (type.kind === 'union') {
      const hasNil = type.types.some((t) => t.kind === 'primitive' && t.name === 'nil');
      if (hasNil) return 'nil';
      // Non-nil union — use first type's stub
      return this.singleReturnStub(type.types[0]);
    }

    if (type.kind === 'primitive') {
      switch (type.name) {
        case 'nil':     return null;
        case 'boolean': return 'false';
        case 'integer':
        case 'number':  return '0';
        case 'string':  return '""';
        case 'table':
        case 'userdata':
        case 'any':     return '{}';
      }
    }

    if (type.kind === 'array' || type.kind === 'table') {
      return '{}';
    }

    if (type.kind === 'named') {
      if (this.enumNames.has(type.name)) {
        const firstMember = this.enumFirstMember.get(type.name);
        return firstMember ? `${type.name}.${firstMember}` : '0';
      }
      return type.name;
    }

    if (type.kind === 'fun') {
      return 'function() end';
    }

    return 'nil';
  }

  // ── Description helpers ─────────────────────────────────────────────────────

  private descLines(text: string): string[] {
    return this.wrapFormatter.format(text)
      .split('\n')
      .map((l) => `--- ${l}`);
  }

  private inlineDesc(text: string): string {
    return this.inlineFormatter.format(text);
  }

  // ── Class ───────────────────────────────────────────────────────────────────

  private writeClass(decl: LuaClassModel): string[] {
    const blocks: string[] = [];

    // Class header block
    const lines: string[] = [];
    if (decl.description) lines.push(...this.descLines(decl.description));
    const ext = decl.extends ? ` : ${decl.extends}` : '';
    lines.push(`---@class ${decl.name}${ext}`);

    // Emit operator overloads from metamethods
    if (decl.operators) {
      for (const op of decl.operators) {
        if (op.operand) {
          lines.push(`---@operator ${op.op}(${op.operand}): ${op.result}`);
        } else {
          lines.push(`---@operator ${op.op}: ${op.result}`);
        }
      }
    }

    for (const f of decl.fields) {
      const fieldDesc = f.description ? ` # ${this.inlineDesc(f.description)}` : '';
      lines.push(`---@field ${f.name} ${this.renderType(f.type)}${fieldDesc}`);
    }

    lines.push(`${decl.name} = {}`);
    blocks.push(lines.join('\n'));

    // Methods
    for (const m of decl.methods) {
      blocks.push(this.writeMethod(decl.name, m));
    }

    return blocks;
  }

  private writeMethod(className: string, m: LuaMethodModel): string {
    const lines: string[] = [];
    if (m.description) lines.push(...this.descLines(m.description));

    for (const p of m.params) {
      lines.push(this.paramAnnotation(p));
    }

    const retStr = this.returnAnnotation(m.returns, m.returnDescription);
    if (retStr) lines.push(retStr);

    const paramList = m.params.map((p) => p.name).join(', ');
    const stub = this.returnStub(m.returns);
    const retStub = stub !== null ? ` return ${stub}` : '';
    const sep = m.static ? '.' : ':';
    lines.push(`function ${className}${sep}${m.name}(${paramList})${retStub} end`);

    return lines.join('\n');
  }

  // ── Enum ────────────────────────────────────────────────────────────────────

  private writeEnum(decl: LuaEnumModel): string[] {
    const blocks: string[] = [];

    const lines: string[] = [];
    if (decl.description) lines.push(...this.descLines(decl.description));
    lines.push(`---@enum ${decl.name}`);
    lines.push(`${decl.name} = {`);
    for (const m of decl.members) {
      const comment = m.description ? `  -- ${this.inlineDesc(m.description)}` : '';
      // Enum member names starting with a digit need quoting
      const key = /^\d/.test(m.name) ? `["${m.name}"]` : m.name;
      lines.push(`    ${key} = ${m.value},${comment}`);
    }
    lines.push('}');
    blocks.push(lines.join('\n'));

    // Global alias blocks for bot enums
    if (decl.emitGlobalAliases) {
      for (const m of decl.members) {
        blocks.push(`---@type integer\n${m.name} = ${decl.name}.${m.name}`);
      }
    }

    return blocks;
  }

  // ── Alias ───────────────────────────────────────────────────────────────────

  private writeAlias(decl: LuaAliasModel): string[] {
    const lines: string[] = [];
    if (decl.description) lines.push(...this.descLines(decl.description));
    lines.push(`---@alias ${decl.name} ${this.renderType(decl.target)}`);
    // For non-function aliases that represent a global variable, emit the variable
    if (decl.target.kind === 'named') {
      lines.push(`${decl.name} = nil`);
    } else if (decl.target.kind === 'primitive' && decl.target.name === 'integer') {
      // Constants (from enums constants) — emit as integer assignment
      lines.push(`${decl.name} = 0`);
    }
    return [lines.join('\n')];
  }

  // ── Global function ─────────────────────────────────────────────────────────

  private writeGlobalFunction(decl: LuaGlobalFunctionModel): string[] {
    const lines: string[] = [];
    if (decl.description) lines.push(...this.descLines(decl.description));

    for (const p of decl.params) {
      lines.push(this.paramAnnotation(p));
    }

    const retStr = this.returnAnnotation(decl.returns, decl.returnDescription);
    if (retStr) lines.push(retStr);

    const paramList = decl.params.map((p) => p.name).join(', ');
    const stub = this.returnStub(decl.returns);
    const retStub = stub !== null ? ` return ${stub}` : '';
    lines.push(`function ${decl.name}(${paramList})${retStub} end`);

    return [lines.join('\n')];
  }

  // ── Annotation helpers ──────────────────────────────────────────────────────

  private paramAnnotation(p: LuaParamModel): string {
    const opt = p.optional ? '?' : '';
    const desc = p.description ? ` # ${this.inlineDesc(p.description)}` : '';
    return `---@param ${p.name}${opt} ${this.renderType(p.type)}${desc}`;
  }

  private returnAnnotation(returns: LuaTypeRefModel[], returnDescription?: string): string | null {
    if (returns.length === 0) return null;
    const retType = returns.map((r) => this.renderType(r)).join(', ');
    const desc = returnDescription ? ` # ${this.inlineDesc(returnDescription)}` : '';
    return `---@return ${retType}${desc}`;
  }
}

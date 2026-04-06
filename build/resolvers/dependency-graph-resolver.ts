import type { LuaDeclModel } from '../models/lua-decl-model';
import type { LuaTypeRefModel } from '../models/lua-type-ref-model';

export class DependencyGraphResolver {
  resolve(decls: LuaDeclModel[]): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();

    for (const decl of decls) {
      const deps = new Set<string>();
      collectDepsFromDecl(decl, deps);
      // Remove self-reference
      deps.delete(decl.name);
      graph.set(decl.name, deps);
    }

    return graph;
  }
}

function collectDepsFromType(type: LuaTypeRefModel, deps: Set<string>): void {
  switch (type.kind) {
    case 'primitive':
      break;
    case 'named':
      deps.add(type.name);
      break;
    case 'array':
      collectDepsFromType(type.element, deps);
      break;
    case 'union':
      for (const t of type.types) {
        collectDepsFromType(t, deps);
      }
      break;
    case 'fun':
      for (const p of type.params) {
        collectDepsFromType(p.type, deps);
      }
      for (const r of type.returns) {
        collectDepsFromType(r, deps);
      }
      break;
    case 'table':
      collectDepsFromType(type.key, deps);
      collectDepsFromType(type.value, deps);
      break;
  }
}

function collectDepsFromDecl(decl: LuaDeclModel, deps: Set<string>): void {
  switch (decl.kind) {
    case 'class':
      if (decl.extends) deps.add(decl.extends);
      for (const f of decl.fields) {
        collectDepsFromType(f.type, deps);
      }
      for (const m of decl.methods) {
        for (const p of m.params) {
          collectDepsFromType(p.type, deps);
        }
        for (const r of m.returns) {
          collectDepsFromType(r, deps);
        }
      }
      break;
    case 'enum':
      break;
    case 'alias':
      collectDepsFromType(decl.target, deps);
      break;
    case 'function':
      for (const p of decl.params) {
        collectDepsFromType(p.type, deps);
      }
      for (const r of decl.returns) {
        collectDepsFromType(r, deps);
      }
      break;
  }
}

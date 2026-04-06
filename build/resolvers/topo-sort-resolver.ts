import type { LuaDeclModel } from '../models/lua-decl-model';

export class TopoSortResolver {
  resolve(decls: LuaDeclModel[], graph: Map<string, Set<string>>): LuaDeclModel[] {
    const declByName = new Map<string, LuaDeclModel>();
    for (const decl of decls) {
      declByName.set(decl.name, decl);
    }

    const visited = new Set<string>();
    const onStack = new Set<string>();
    const sorted: LuaDeclModel[] = [];

    const visit = (name: string) => {
      if (visited.has(name)) return;

      if (onStack.has(name)) {
        process.stderr.write(`[TopoSortResolver] cycle detected involving "${name}" — emitting as-is\n`);
        return;
      }

      onStack.add(name);

      const deps = graph.get(name) ?? new Set<string>();
      for (const dep of deps) {
        if (declByName.has(dep)) {
          visit(dep);
        }
      }

      onStack.delete(name);

      if (!visited.has(name)) {
        visited.add(name);
        const decl = declByName.get(name);
        if (decl) sorted.push(decl);
      }
    };

    for (const decl of decls) {
      visit(decl.name);
    }

    return sorted;
  }
}

import type { LuaClassModel } from '../models/lua-class-model';
import type { LuaDeclModel } from '../models/lua-decl-model';
import type { LuaMethodModel } from '../models/lua-method-model';

export class DeclarationsMerger {
  merge(a: LuaDeclModel[], b: LuaDeclModel[]): LuaDeclModel[] {
    // Build a map of all declarations by name from `a`
    const result: LuaDeclModel[] = [...a];
    const indexByName = new Map<string, number>();

    for (let i = 0; i < result.length; i++) {
      indexByName.set(result[i].name, i);
    }

    for (const decl of b) {
      const existingIdx = indexByName.get(decl.name);

      if (existingIdx === undefined) {
        // No conflict — append
        indexByName.set(decl.name, result.length);
        result.push(decl);
        continue;
      }

      const existing = result[existingIdx];

      if (existing.kind === 'class' && decl.kind === 'class') {
        // Merge classes
        result[existingIdx] = mergeClasses(existing, decl);
      } else {
        // Conflict on non-class — log and keep `a` version
        process.stderr.write(
          `[DeclarationsMerger] conflict on ${decl.kind} "${decl.name}" — keeping first source\n`,
        );
      }
    }

    return result;
  }
}

function mergeClasses(base: LuaClassModel, patch: LuaClassModel): LuaClassModel {
  // Merge methods: base methods are the foundation; patch methods override by name
  const methodMap = new Map<string, LuaMethodModel>();

  for (const m of base.methods) {
    methodMap.set(m.name, m);
  }

  for (const m of patch.methods) {
    const existing = methodMap.get(m.name);
    if (existing) {
      // Patch (engine data) wins on params and returns since it's authoritative.
      // But if the base (bot API) has fewer params, mark the extra patch params as optional
      // since the bot API legitimately calls these methods with fewer arguments.
      const mergedParams = m.params.map((p, i) => {
        if (i >= existing.params.length) {
          return { ...p, optional: true };
        }
        return p;
      });

      // Keep the base description as fallback if the patch doesn't provide one.
      methodMap.set(m.name, {
        ...m,
        params: mergedParams,
        description: m.description ?? existing.description,
        static: existing.static ?? m.static,
      });
    } else {
      // Patch-only method — append
      methodMap.set(m.name, m);
    }
  }

  // Preserve original order from base, then append new methods from patch
  const mergedMethods: LuaMethodModel[] = [];
  const seen = new Set<string>();

  for (const m of base.methods) {
    mergedMethods.push(methodMap.get(m.name)!);
    seen.add(m.name);
  }

  for (const m of patch.methods) {
    if (!seen.has(m.name)) {
      mergedMethods.push(methodMap.get(m.name)!);
      seen.add(m.name);
    }
  }

  // Merge fields: patch fields override base fields by name (engine data wins)
  const fieldMap = new Map(base.fields.map((f) => [f.name, f]));
  for (const f of patch.fields) {
    fieldMap.set(f.name, f);
  }

  const mergedFields = [
    ...base.fields.map((f) => fieldMap.get(f.name)!),
    ...patch.fields.filter((f) => !base.fields.some((bf) => bf.name === f.name)),
  ];

  return {
    ...base,
    fields: mergedFields,
    methods: mergedMethods,
  };
}

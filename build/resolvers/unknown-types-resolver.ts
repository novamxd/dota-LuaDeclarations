import type { LuaDeclModel } from '../models/lua-decl-model';
import type { LuaFieldModel } from '../models/lua-field-model';
import type { LuaMethodModel } from '../models/lua-method-model';
import type { LuaParamModel } from '../models/lua-param-model';
import type { LuaTypeRefModel } from '../models/lua-type-ref-model';

const LUA_BUILTINS = new Set([
  'boolean', 'integer', 'number', 'string', 'nil', 'any',
  'table', 'userdata', 'thread', 'function', 'void', 'self',
  'fun',
]);

export class UnknownTypesResolver {
  resolve(decls: LuaDeclModel[]): LuaDeclModel[] {
    // Collect all declared names
    const declared = new Set<string>(decls.map((d) => d.name));

    const resolveType = (type: LuaTypeRefModel): LuaTypeRefModel => {
      switch (type.kind) {
        case 'primitive':
          return type;
        case 'named':
          if (!declared.has(type.name) && !LUA_BUILTINS.has(type.name)) {
            return { kind: 'primitive', name: 'any' };
          }
          return type;
        case 'array':
          return { kind: 'array', element: resolveType(type.element) };
        case 'union':
          return { kind: 'union', types: type.types.map(resolveType) };
        case 'fun':
          return {
            kind: 'fun',
            params: type.params.map((p) => ({ ...p, type: resolveType(p.type) })),
            returns: type.returns.map(resolveType),
          };
        case 'table':
          return { kind: 'table', key: resolveType(type.key), value: resolveType(type.value) };
      }
    };

    const resolveParam = (p: LuaParamModel): LuaParamModel => ({ ...p, type: resolveType(p.type) });
    const resolveField = (f: LuaFieldModel): LuaFieldModel => ({ ...f, type: resolveType(f.type) });
    const resolveMethod = (m: LuaMethodModel): LuaMethodModel => ({
      ...m,
      params: m.params.map(resolveParam),
      returns: m.returns.map(resolveType),
    });

    return decls.map((decl): LuaDeclModel => {
      switch (decl.kind) {
        case 'class':
          return {
            ...decl,
            fields: decl.fields.map(resolveField),
            methods: decl.methods.map(resolveMethod),
          };
        case 'enum':
          return decl;
        case 'alias':
          return { ...decl, target: resolveType(decl.target) };
        case 'function':
          return {
            ...decl,
            params: decl.params.map(resolveParam),
            returns: decl.returns.map(resolveType),
          };
      }
    });
  }
}

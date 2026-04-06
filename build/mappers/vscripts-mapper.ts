// We use `import type` + `typeof` as per the design doc.
// The actual data is injected via constructor — these imports are type-only.
import type _api from '@moddota/dota-data/files/vscripts/api';
import type _apiTypes from '@moddota/dota-data/files/vscripts/api-types';
import type _enums from '@moddota/dota-data/files/vscripts/enums';
import type _events from '@moddota/dota-data/files/events';
import _ from 'lodash';
import type { LuaAliasModel } from '../models/lua-alias-model';
import type { LuaClassModel } from '../models/lua-class-model';
import type { LuaDeclModel } from '../models/lua-decl-model';
import type { LuaEnumModel } from '../models/lua-enum-model';
import type { LuaFieldModel } from '../models/lua-field-model';
import type { LuaGlobalFunctionModel } from '../models/lua-global-function-model';
import type { LuaMethodModel } from '../models/lua-method-model';
import type { LuaParamModel } from '../models/lua-param-model';
import type { LuaTypeRefModel } from '../models/lua-type-ref-model';

// ── Type mapping ──────────────────────────────────────────────────────────────

const primitiveTypeMap: Record<string, LuaTypeRefModel & { kind: 'primitive' }> = {
  bool:    { kind: 'primitive', name: 'boolean' },
  byte:    { kind: 'primitive', name: 'integer' },
  short:   { kind: 'primitive', name: 'integer' },
  int:     { kind: 'primitive', name: 'integer' },
  uint:    { kind: 'primitive', name: 'integer' },
  long:    { kind: 'primitive', name: 'integer' },
  float:   { kind: 'primitive', name: 'number' },
  double:  { kind: 'primitive', name: 'number' },
  ehandle: { kind: 'primitive', name: 'integer' },
  table:   { kind: 'primitive', name: 'table' },
  variant: { kind: 'primitive', name: 'any' },
  unknown: { kind: 'primitive', name: 'any' },
  nil:     { kind: 'primitive', name: 'nil' },
  boolean: { kind: 'primitive', name: 'boolean' },
  integer: { kind: 'primitive', name: 'integer' },
  number:  { kind: 'primitive', name: 'number' },
  string:  { kind: 'primitive', name: 'string' },
  any:     { kind: 'primitive', name: 'any' },
  userdata:{ kind: 'primitive', name: 'userdata' },
};

function mapSingleApiType(type: _api.Type): LuaTypeRefModel {
  if (typeof type === 'string') {
    return primitiveTypeMap[type] ?? { kind: 'named', name: type };
  }

  switch (type.kind) {
    case 'literal':
      // Literal numeric types — represent as integer primitive
      return { kind: 'primitive', name: 'integer' };

    case 'array':
      return { kind: 'array', element: mapApiTypes(type.types) };

    case 'table': {
      const key = mapApiTypes(type.key);
      const value = mapApiTypes(type.value);
      return { kind: 'table', key, value };
    }

    case 'function': {
      const params: LuaParamModel[] = type.args.map((a) => ({
        name: safeParamName(a.name),
        type: mapApiTypes(a.types),
        description: a.description,
      }));
      const returns = type.returns
        .filter((r) => !(typeof r === 'string' && r === 'nil'))
        .map(mapSingleApiType);
      return { kind: 'fun', params, returns };
    }case 'function': {
      const params: LuaParamModel[] = type.args.map((a) => ({
        name: safeParamName(a.name),
        type: mapApiTypes(a.types),
        description: a.description,
      }));
      const returns = type.returns
        .filter((r) => !(typeof r === 'string' && r === 'nil'))
        .map(mapSingleApiType);
      return { kind: 'fun', params, returns };
    }
  }
}

function mapApiTypes(types: _api.Type[]): LuaTypeRefModel {
  const mapped = types.map(mapSingleApiType);
  // Deduplicate by serializing
  const seen = new Set<string>();
  const unique: LuaTypeRefModel[] = [];
  for (const t of mapped) {
    const key = JSON.stringify(t);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(t);
    }
  }
  if (unique.length === 1) return unique[0];
  return { kind: 'union', types: unique };
}

/** Map a single API type directly to a Lua type string (for operator annotations). */
function mapSingleApiTypeToString(type: _api.Type): string {
  if (typeof type === 'string') {
    return primitiveTypeMap[type]?.name ?? type;
  }
  return 'any';
}

/** Map a primitive type string to its Lua equivalent. */
function mapPrimitiveType(type: string): string {
  return primitiveTypeMap[type]?.name ?? type;
}

// ── Event type mapping ────────────────────────────────────────────────────────

const eventTypeMap: Record<string, LuaTypeRefModel> = {
  bool:                        { kind: 'primitive', name: 'integer' }, // 0|1 — use integer
  byte:                        { kind: 'primitive', name: 'integer' },
  short:                       { kind: 'primitive', name: 'integer' },
  int:                         { kind: 'primitive', name: 'integer' },
  long:                        { kind: 'primitive', name: 'integer' },
  uint64:                      { kind: 'primitive', name: 'integer' },
  float:                       { kind: 'primitive', name: 'number' },
  ehandle:                     { kind: 'named', name: 'EntityIndex' },
  player_controller:           { kind: 'named', name: 'EntityIndex' },
  player_controller_and_pawn:  { kind: 'named', name: 'EntityIndex' },
  local:                       { kind: 'primitive', name: 'any' },
};

function mapEventType(type: string): LuaTypeRefModel {
  return eventTypeMap[type] ?? { kind: 'named', name: type };
}

// ── Param name safety ─────────────────────────────────────────────────────────

const parameterNamesMap: Record<string, string> = {
  default: 'defaultValue', function: 'func', end: 'endValue',
  repeat: 'repeatValue', until: 'untilValue', then: 'thenValue',
  do: 'doValue', in: 'inValue', local: 'localValue', return: 'returnValue',
  not: 'notValue', and: 'andValue', or: 'orValue', if: 'ifValue',
  else: 'elseValue', elseif: 'elseifValue', for: 'forValue',
  while: 'whileValue', nil: 'nilValue', true: 'trueValue', false: 'falseValue',
};

function safeParamName(name: string): string {
  return parameterNamesMap[name] ?? name;
}

const functionsWithOptionalParameters = new Set([
  'DeepPrintTable',
  'PrecacheUnitByNameAsync',
  'PrecacheUnitByNameSync',
  'Vector',
]);

// ── Metamethod detection ──────────────────────────────────────────────────────

const metamethods = new Set([
  '__add', '__sub', '__mul', '__div', '__mod', '__pow', '__unm',
  '__idiv', '__band', '__bor', '__bxor', '__bnot', '__shl', '__shr',
  '__concat', '__len', '__eq', '__lt', '__le',
]);

function isMetamethod(name: string): boolean {
  return metamethods.has(name);
}

// ── Mapped primitives (api-types) ─────────────────────────────────────────────

const mappedPrimitives = new Set([
  'bool', 'byte', 'short', 'int', 'uint', 'long', 'float', 'double',
  'ehandle', 'handle', 'table', 'variant', 'nil', 'string',
  'boolean', 'integer', 'number', 'userdata', 'unknown',
]);

// ── VscriptsMapper ────────────────────────────────────────────────────────────

export class VscriptsMapper {
  constructor(
    private readonly api: typeof _api,
    private readonly apiTypes: typeof _apiTypes,
    private readonly enums: typeof _enums,
    private readonly events: typeof _events,
  ) {}

  map(): LuaDeclModel[] {
    const decls: LuaDeclModel[] = [];

    // 1. api-types: handle class, primitives, nominals, objects
    decls.push(...this.mapApiTypes());

    // 2. enums
    decls.push(...this.mapEnums());

    // 3. events
    decls.push(...this.mapEvents());

    // 4. api: classes and global functions
    decls.push(...this.mapApi());

    return decls;
  }

  // ── api-types ───────────────────────────────────────────────────────────────

  private mapApiTypes(): LuaDeclModel[] {
    const decls: LuaDeclModel[] = [];

    // Emit the handle class first
    const handleClass: LuaClassModel = {
      kind: 'class',
      name: 'handle',
      fields: [],
      methods: [],
      source: 'vscripts',
    };
    decls.push(handleClass);

    for (const decl of this.apiTypes) {
      if (decl.kind === 'primitive') {
        if (!mappedPrimitives.has(decl.name)) {
          // Opaque class stub
          const cls: LuaClassModel = {
            kind: 'class',
            name: decl.name,
            description: decl.description,
            fields: [],
            methods: [],
            source: 'vscripts',
          };
          decls.push(cls);
        }
        continue;
      }

      if (decl.kind === 'nominal') {
        decls.push(this.mapNominal(decl));
      } else {
        // object
        decls.push(this.mapObject(decl));
      }
    }

    return decls;
  }

  private mapNominal(decl: Extract<typeof _apiTypes[number], { kind: 'nominal' }>): LuaAliasModel {
    const baseTypeMap: Record<string, LuaTypeRefModel> = {
      int:    { kind: 'primitive', name: 'integer' },
      uint:   { kind: 'primitive', name: 'integer' },
      bool:   { kind: 'primitive', name: 'boolean' },
      float:  { kind: 'primitive', name: 'number' },
      double: { kind: 'primitive', name: 'number' },
      string: { kind: 'primitive', name: 'string' },
    };

    // Special case: PlayerID is a union of specific literal values
    if (decl.name === 'PlayerID') {
      const values = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
      // LuaTypeRefModel doesn't have a literal kind, so we represent each value as a named type
      // with the literal value string — the writer will render them as-is in a union.
      const literalTypes: LuaTypeRefModel[] = values.map((v) => ({ kind: 'named' as const, name: String(v) }));
      return {
        kind: 'alias',
        name: decl.name,
        target: { kind: 'union', types: literalTypes },
        description: decl.description,
      };
    }

    const target: LuaTypeRefModel = baseTypeMap[decl.baseType] ?? { kind: 'named', name: decl.baseType };
    return {
      kind: 'alias',
      name: decl.name,
      target,
      description: decl.description,
    };
  }

  private mapObject(decl: Extract<typeof _apiTypes[number], { kind: 'object' }>): LuaClassModel {
    const fields: LuaFieldModel[] = decl.fields.map((f) => {
      const isOpt = (f.types as _api.Type[]).some((t) => t === 'nil');
      const rawTypes = isOpt ? (f.types as _api.Type[]).filter((t) => t !== 'nil') : (f.types as _api.Type[]);
      let fieldType: LuaTypeRefModel = rawTypes.length > 0 ? mapApiTypes(rawTypes) : { kind: 'primitive', name: 'nil' };
      if (isOpt) {
        fieldType = { kind: 'union', types: [fieldType, { kind: 'primitive', name: 'nil' }] };
      }
      return { name: f.name, type: fieldType, description: f.description };
    });

    return {
      kind: 'class',
      name: decl.name,
      extends: decl.extend?.[0],
      description: decl.description,
      fields,
      methods: [],
      source: 'vscripts',
    };
  }

  // ── enums ───────────────────────────────────────────────────────────────────

  private mapEnums(): LuaDeclModel[] {
    const decls: LuaDeclModel[] = [];

    for (const decl of this.enums) {
      if (decl.kind === 'constant') {
        // Emit as an alias to integer
        const alias: LuaAliasModel = {
          kind: 'alias',
          name: decl.name,
          target: { kind: 'primitive', name: 'integer' },
          description: decl.description,
        };
        decls.push(alias);
        continue;
      }

      // It's an enum
      const enumModel: LuaEnumModel = {
        kind: 'enum',
        name: decl.name,
        description: decl.description,
        members: decl.members.map((m: _enums.EnumMember) => ({
          name: m.name,
          value: m.value,
          description: m.description,
        })),
        emitGlobalAliases: false,
      };
      decls.push(enumModel);
    }

    return decls;
  }

  // ── events ──────────────────────────────────────────────────────────────────

  private mapEvents(): LuaDeclModel[] {
    return this.events.map((event: _events.Event) => {
      const className = `${_.upperFirst(_.camelCase(event.name))}Event`;
      const fields: LuaFieldModel[] = event.fields.map((f: _events.EventField) => ({
        name: f.name,
        type: mapEventType(f.type),
        description: f.description,
      }));
      const cls: LuaClassModel = {
        kind: 'class',
        name: className,
        description: event.description,
        fields,
        methods: [],
        source: 'vscripts',
      };
      return cls;
    });
  }

  // ── api ─────────────────────────────────────────────────────────────────────

  private mapApi(): LuaDeclModel[] {
    const decls: LuaDeclModel[] = [];

    for (const decl of this.api) {
      if (decl.kind === 'class') {
        decls.push(...this.mapClass(decl));
      } else {
        decls.push(this.mapFunction(decl));
      }
    }

    return decls;
  }

  private mapFunction(decl: _api.FunctionDeclaration): LuaGlobalFunctionModel {
    const params: LuaParamModel[] = decl.args.map((p) => {
      const isOpt = p.types.includes('nil') && functionsWithOptionalParameters.has(decl.name);
      return {
        name: safeParamName(p.name),
        type: mapApiTypes(p.types),
        optional: isOpt || undefined,
        description: p.description,
      };
    });

    const nonNilReturns = decl.returns.filter((r) => !(typeof r === 'string' && r === 'nil'));
    const returns: LuaTypeRefModel[] = nonNilReturns.length === 0 && decl.returns.length > 0
      ? [] // nil-only return → no return
      : nonNilReturns.map(mapSingleApiType);

    return {
      kind: 'function',
      name: decl.name,
      description: decl.description,
      params,
      returns,
    };
  }

  private mapClass(decl: _api.ClassDeclaration): LuaDeclModel[] {
    const results: LuaDeclModel[] = [];

    const fields: LuaFieldModel[] = [];
    const methods: LuaMethodModel[] = [];
    const operators: import('../models/lua-operator-model').LuaOperatorModel[] = [];

    for (const member of decl.members) {
      if (member.kind === 'field') {
        const isOpt = (member.types as string[]).includes('nil');
        const rawTypes = isOpt
          ? (member.types as string[]).filter((t) => t !== 'nil')
          : (member.types as string[]);
        let fieldType: LuaTypeRefModel = rawTypes.length > 0
          ? mapApiTypes(rawTypes as _api.Type[])
          : { kind: 'primitive', name: 'nil' };
        if (isOpt) {
          fieldType = { kind: 'union', types: [fieldType, { kind: 'primitive', name: 'nil' }] };
        }
        fields.push({ name: member.name, type: fieldType, description: member.description });
        continue;
      }

      // Convert metamethods to operator annotations
      if (isMetamethod(member.name)) {
        const opName = member.name.slice(2); // strip '__'
        const returnType = member.returns.length > 0
          ? mapSingleApiTypeToString(member.returns[0])
          : 'any';
        if (opName === 'unm' || opName === 'len' || opName === 'bnot') {
          operators.push({ op: opName, result: returnType });
        } else if (member.args.length > 0) {
          const operandType = member.args[0].types
            .filter((t): t is string => typeof t === 'string' && t !== 'nil')
            .map(mapPrimitiveType)
            .join('|') || 'any';
          operators.push({ op: opName, operand: operandType, result: returnType });
        }
        continue;
      }

      const identifier = `${decl.name}.${member.name}`;
      const params: LuaParamModel[] = member.args.map((p) => {
        const isOpt = p.types.includes('nil') && functionsWithOptionalParameters.has(identifier);
        return {
          name: safeParamName(p.name),
          type: mapApiTypes(p.types),
          optional: isOpt || undefined,
          description: p.description,
        };
      });

      const nonNilReturns = member.returns.filter((r) => !(typeof r === 'string' && r === 'nil'));
      const returns: LuaTypeRefModel[] = nonNilReturns.length === 0 && member.returns.length > 0
        ? []
        : nonNilReturns.map(mapSingleApiType);

      methods.push({
        name: member.name,
        description: member.description,
        params,
        returns,
        source: 'vscripts',
      });
    }

    const cls: LuaClassModel = {
      kind: 'class',
      name: decl.name,
      extends: decl.extend,
      description: decl.description,
      fields,
      methods,
      operators: operators.length > 0 ? operators : undefined,
      source: 'vscripts',
    };
    results.push(cls);

    // Instance variable alias
    if (decl.instance && decl.instance !== decl.name) {
      results.push({
        kind: 'alias',
        name: decl.instance,
        target: { kind: 'named', name: decl.name },
      });
    }

    // Client name alias
    if (decl.clientName && decl.clientName !== decl.name) {
      results.push({
        kind: 'alias',
        name: decl.clientName,
        target: { kind: 'named', name: decl.name },
        description: `Client-side alias for ${decl.name}.`,
      });
    }

    return results;
  }
}

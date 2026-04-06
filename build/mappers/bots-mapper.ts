import type { LuaClassModel } from '../models/lua-class-model';
import type { LuaDeclModel } from '../models/lua-decl-model';
import type { LuaEnumModel } from '../models/lua-enum-model';
import type { LuaFieldModel } from '../models/lua-field-model';
import type { LuaGlobalFunctionModel } from '../models/lua-global-function-model';
import type { LuaMethodModel } from '../models/lua-method-model';
import type { LuaParamModel } from '../models/lua-param-model';
import type { LuaTypeRefModel } from '../models/lua-type-ref-model';

// ── JSON schema types ─────────────────────────────────────────────────────────

interface BotEnumMember {
  name: string;
  value: number;
  description?: string;
}

interface BotEnum {
  name: string;
  description?: string;
  members: BotEnumMember[];
}

interface BotParam {
  name: string;
  types: string[];
  description?: string;
}

interface BotFunction {
  name: string;
  description?: string;
  args: BotParam[];
  returns?: string[];
  returnDescription?: string;
  static?: boolean;
}

interface BotClassField {
  name: string;
  type: string;
  description?: string;
}

interface BotClass {
  name: string;
  extends?: string;
  description?: string;
  fields?: BotClassField[];
  methods?: BotFunction[];
}

export interface BotApiSchema {
  enums: BotEnum[];
  classes: BotClass[];
  globalFunctions: BotFunction[];
  unitMethods: BotFunction[];
  abilityMethods?: BotFunction[];
}

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

function mapBotType(t: string): LuaTypeRefModel {
  return primitiveTypeMap[t] ?? { kind: 'named', name: t };
}

function mapBotTypes(types: string[]): LuaTypeRefModel {
  const mapped = types.map(mapBotType);
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

// ── Param name safety ─────────────────────────────────────────────────────────

const RESERVED: Record<string, string> = {
  default: 'defaultValue', function: 'func', end: 'endValue',
  repeat: 'repeatValue', until: 'untilValue', then: 'thenValue',
  do: 'doValue', in: 'inValue', local: 'localValue', return: 'returnValue',
  not: 'notValue', and: 'andValue', or: 'orValue', if: 'ifValue',
  else: 'elseValue', elseif: 'elseifValue', for: 'forValue',
  while: 'whileValue', nil: 'nilValue', true: 'trueValue', false: 'falseValue',
};

function safeName(name: string): string {
  return RESERVED[name] ?? name;
}

// ── BotsMapper ────────────────────────────────────────────────────────────────

export class BotsMapper {
  constructor(private readonly data: BotApiSchema) {}

  map(): LuaDeclModel[] {
    const decls: LuaDeclModel[] = [];

    // 1. Enums (with emitGlobalAliases: true)
    for (const e of this.data.enums) {
      decls.push(this.mapEnum(e));
    }

    // 2. Classes (CDOTA_Bot extends CDOTA_BaseNPC)
    for (const c of this.data.classes) {
      decls.push(this.mapClass(c));
    }

    // 3. unitMethods → methods on CDOTA_BaseNPC with source: 'bots'
    const unitMethodsClass: LuaClassModel = {
      kind: 'class',
      name: 'CDOTA_BaseNPC',
      fields: [],
      methods: this.data.unitMethods.map((fn) => this.mapMethod(fn)),
      source: 'bots',
    };
    decls.push(unitMethodsClass);

    // 4. Global functions
    for (const fn of this.data.globalFunctions) {
      decls.push(this.mapGlobalFunction(fn));
    }

    // 5. abilityMethods → methods on CDOTABaseAbility with source: 'bots'
    if (this.data.abilityMethods && this.data.abilityMethods.length > 0) {
      const abilityMethodsClass: LuaClassModel = {
        kind: 'class',
        name: 'CDOTABaseAbility',
        fields: [],
        methods: this.data.abilityMethods.map((fn) => this.mapMethod(fn)),
        source: 'bots',
      };
      decls.push(abilityMethodsClass);
    }

    return decls;
  }

  private mapEnum(e: BotEnum): LuaEnumModel {
    return {
      kind: 'enum',
      name: e.name,
      description: e.description,
      members: e.members.map((m) => ({
        name: m.name,
        value: m.value,
        description: m.description,
      })),
      emitGlobalAliases: true,
    };
  }

  private mapClass(c: BotClass): LuaClassModel {
    const fields: LuaFieldModel[] = (c.fields ?? []).map((f) => ({
      name: f.name,
      type: mapBotType(f.type),
      description: f.description,
    }));

    const methods: LuaMethodModel[] = (c.methods ?? []).map((m) => this.mapMethod(m));

    return {
      kind: 'class',
      name: c.name,
      extends: c.extends,
      description: c.description,
      fields,
      methods,
      source: 'bots',
    };
  }

  private mapMethod(fn: BotFunction): LuaMethodModel {
    const params: LuaParamModel[] = fn.args.map((p) => ({
      name: safeName(p.name),
      type: mapBotTypes(p.types),
      description: p.description,
    }));

    const hasReturn = fn.returns && fn.returns.length > 0 &&
      !(fn.returns.length === 1 && fn.returns[0] === 'nil');
    const returns: LuaTypeRefModel[] = hasReturn && fn.returns
      ? [mapBotTypes(fn.returns)]
      : [];

    return {
      name: fn.name,
      description: fn.description,
      params,
      returns,
      returnDescription: fn.returnDescription,
      source: 'bots',
      static: fn.static,
    };
  }

  private mapGlobalFunction(fn: BotFunction): LuaGlobalFunctionModel {
    const params: LuaParamModel[] = fn.args.map((p) => ({
      name: safeName(p.name),
      type: mapBotTypes(p.types),
      description: p.description,
    }));

    const hasReturn = fn.returns && fn.returns.length > 0 &&
      !(fn.returns.length === 1 && fn.returns[0] === 'nil');
    const returns: LuaTypeRefModel[] = hasReturn && fn.returns
      ? [mapBotTypes(fn.returns)]
      : [];

    return {
      kind: 'function',
      name: fn.name,
      description: fn.description,
      params,
      returns,
      returnDescription: fn.returnDescription,
    };
  }
}

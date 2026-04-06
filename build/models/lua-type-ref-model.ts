import type { LuaParamModel } from './lua-param-model';

export type LuaTypeRefModel =
  | { kind: 'primitive'; name: 'boolean' | 'integer' | 'number' | 'string' | 'nil' | 'any' | 'table' | 'userdata' }
  | { kind: 'named'; name: string }
  | { kind: 'array'; element: LuaTypeRefModel }
  | { kind: 'union'; types: LuaTypeRefModel[] }
  | { kind: 'fun'; params: LuaParamModel[]; returns: LuaTypeRefModel[] }
  | { kind: 'table'; key: LuaTypeRefModel; value: LuaTypeRefModel };

import type { LuaParamModel } from './lua-param-model';
import type { LuaTypeRefModel } from './lua-type-ref-model';

export interface LuaGlobalFunctionModel {
  kind: 'function';
  name: string;
  description?: string;
  params: LuaParamModel[];
  returns: LuaTypeRefModel[];
  returnDescription?: string;
}

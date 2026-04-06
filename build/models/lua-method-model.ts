import type { LuaParamModel } from './lua-param-model';
import type { LuaTypeRefModel } from './lua-type-ref-model';

export interface LuaMethodModel {
  name: string;
  description?: string;
  params: LuaParamModel[];
  returns: LuaTypeRefModel[];
  returnDescription?: string;
  source: 'vscripts' | 'bots';
  /** When true, emit dot syntax (`Class.method`) instead of colon syntax (`Class:method`). */
  static?: boolean;
}

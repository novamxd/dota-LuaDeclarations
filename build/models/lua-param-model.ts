import type { LuaTypeRefModel } from './lua-type-ref-model';

export interface LuaParamModel {
  name: string;
  type: LuaTypeRefModel;
  optional?: boolean;
  description?: string;
}

import type { LuaTypeRefModel } from './lua-type-ref-model';

export interface LuaFieldModel {
  name: string;
  type: LuaTypeRefModel;
  description?: string;
}

import type { LuaTypeRefModel } from './lua-type-ref-model';

export interface LuaAliasModel {
  kind: 'alias';
  name: string;
  target: LuaTypeRefModel;
  description?: string;
}

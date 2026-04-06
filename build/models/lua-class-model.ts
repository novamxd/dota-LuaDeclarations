import type { LuaFieldModel } from './lua-field-model';
import type { LuaMethodModel } from './lua-method-model';
import type { LuaOperatorModel } from './lua-operator-model';

export interface LuaClassModel {
  kind: 'class';
  name: string;
  extends?: string;
  description?: string;
  fields: LuaFieldModel[];
  methods: LuaMethodModel[];
  operators?: LuaOperatorModel[];
  source: 'vscripts' | 'bots';
}

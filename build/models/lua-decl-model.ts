import type { LuaAliasModel } from './lua-alias-model';
import type { LuaClassModel } from './lua-class-model';
import type { LuaEnumModel } from './lua-enum-model';
import type { LuaGlobalFunctionModel } from './lua-global-function-model';

export type LuaDeclModel = LuaClassModel | LuaEnumModel | LuaAliasModel | LuaGlobalFunctionModel;

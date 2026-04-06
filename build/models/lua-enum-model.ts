export interface LuaEnumModel {
  kind: 'enum';
  name: string;
  description?: string;
  members: { name: string; value: number; description?: string }[];
  emitGlobalAliases: boolean;
}

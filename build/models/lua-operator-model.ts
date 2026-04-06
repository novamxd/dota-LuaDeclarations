export interface LuaOperatorModel {
  op: string;        // e.g. 'add', 'sub', 'mul', 'div', 'unm'
  operand?: string;  // e.g. 'Vector', 'number' — absent for unary
  result: string;    // e.g. 'Vector'
}

export interface FurnitureObject {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  blocksMovement: boolean;
  blocksSound: boolean;
  label?: string;
}

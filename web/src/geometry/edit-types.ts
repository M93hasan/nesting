import type {Point} from '../model';

/** Shared transform contract, independent of gesture and placement implementations. */
export type GeometryEdit =
  | {kind:'rotate';degrees:number;pivot:Point}
  | {kind:'scale';factor:number;pivot:Point};

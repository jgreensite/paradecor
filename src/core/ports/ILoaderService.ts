export interface ILoaderService {
  /** Parses STL binary data into a geometry. Returns any as it matches THREE.BufferGeometry in implementation. */
  parseSTL(buffer: ArrayBuffer): any;
  /** Parses OBJ text data into a group/mesh. */
  parseOBJ(text: string): any;
}

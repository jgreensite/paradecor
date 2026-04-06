import * as THREE from 'three'
// @ts-ignore
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
// @ts-ignore
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import type { ILoaderService } from '../../core/ports/ILoaderService'

export const ThreeLoaderAdapter: ILoaderService = {
  parseSTL(buffer: ArrayBuffer): THREE.BufferGeometry {
    const loader = new STLLoader();
    return loader.parse(buffer);
  },
  
  parseOBJ(text: string): THREE.Group {
    const loader = new OBJLoader();
    return loader.parse(text);
  }
};

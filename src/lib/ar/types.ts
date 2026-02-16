import * as THREE from 'three';

export type ProductType = 'CURTAIN' | 'BLIND';

export interface ARPlacement {
    id: string;
    type: ProductType;
    width: number;  // in meters
    height: number; // in meters
    position: THREE.Vector3;
    rotation: THREE.Quaternion;
    fabricId: string;
    openAmount: number; // 0 to 1 (0 = closed, 1 = fully open)
    mesh?: THREE.Group | THREE.Mesh;
}

export interface ARState {
    mode: ProductType;
    placements: ARPlacement[];
    selectedId: string | null;
    currentFabricId: string;
    isMeasuring: boolean;
    measurePoints: THREE.Vector3[];
    isSessionActive: boolean;
    isSimulationMode: boolean;
    customFabrics: FabricTexture[];
}

export interface HitTestResult {
    position: THREE.Vector3;
    orientation: THREE.Quaternion;
}

export type FabricTexture = {
    id: string;
    name: string;
    url: string;
    patternWidth: number;  // Pattern repeat width in meters
    patternHeight: number; // Pattern repeat height in meters
};

export const DEFAULT_FABRICS: FabricTexture[] = [
    {
        id: 'linen-white',
        name: 'Classic White Linen',
        url: '/fabrics/linen_white.jpg',
        patternWidth: 0.5,
        patternHeight: 0.5
    },
    {
        id: 'velvet-grey',
        name: 'Slate Grey Velvet',
        url: '/fabrics/velvet_grey.jpg',
        patternWidth: 0.8,
        patternHeight: 0.8
    },
    {
        id: 'zebra-standard',
        name: 'Zebra Blind Standard',
        url: '/fabrics/zebra_blind.jpg',
        patternWidth: 0.2,
        patternHeight: 0.2
    }
];

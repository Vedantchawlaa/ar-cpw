"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";

interface FabricMaterialProps {
    url: string;
    width: number;
    height: number;
    patternWidth: number;
    patternHeight: number;
    opacity?: number;
    roughness?: number;
    metalness?: number;
}

export function FabricMaterial({
    url,
    width,
    height,
    patternWidth,
    patternHeight,
    opacity = 1,
    roughness = 0.9,
    metalness = 0.1
}: FabricMaterialProps) {
    const texture = useTexture(url);

    useMemo(() => {
        if (texture) {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(width / (patternWidth || 1), height / (patternHeight || 1));
            texture.colorSpace = THREE.SRGBColorSpace;
        }
    }, [texture, width, height, patternWidth, patternHeight]);

    return (
        <meshStandardMaterial
            map={texture}
            transparent={opacity < 1}
            opacity={opacity}
            roughness={roughness}
            metalness={metalness}
            side={THREE.DoubleSide}
        />
    );
}

"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { FabricMaterial } from "./FabricMaterial";
import { FabricTexture } from "@/lib/ar/types";

interface CurtainProps {
    width: number;
    height: number;
    fabric: FabricTexture;
    openAmount: number;
}

export function Curtain({ width, height, fabric, openAmount }: CurtainProps) {
    const meshRef = useRef<THREE.Mesh>(null);

    // Create pleated geometry
    const geometry = useMemo(() => {
        const geo = new THREE.PlaneGeometry(width, height, 60, 2);
        const positions = geo.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const pleat = Math.sin((x / width) * Math.PI * 16) * 0.04;
            positions.setZ(i, pleat);
        }
        geo.computeVertexNormals();
        return geo;
    }, [width, height]);

    useFrame(() => {
        if (meshRef.current) {
            // Animating width scale and position for opening/closing
            const scaleX = 1 - (openAmount * 0.92);
            meshRef.current.scale.x = scaleX;
            meshRef.current.position.x = (width / 2) * (openAmount * 0.92);
        }
    });

    return (
        <group>
            {/* Curtain Rod */}
            <mesh rotation={[0, 0, Math.PI / 2]} position={[0, height / 2 + 0.02, 0]}>
                <cylinderGeometry args={[0.012, 0.012, width + 0.1]} />
                <meshStandardMaterial color="#2d2d2d" metalness={0.8} roughness={0.2} />
            </mesh>

            {/* Curtain Fabric */}
            <mesh ref={meshRef} geometry={geometry}>
                <FabricMaterial
                    url={fabric.url}
                    width={width}
                    height={height}
                    patternWidth={fabric.patternWidth}
                    patternHeight={fabric.patternHeight}
                />
            </mesh>

            {/* Added subtle floor shadow when in AR - Using standard material to avoid onBuild error */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -height / 2, 0.2]} receiveShadow>
                <planeGeometry args={[width * 2, 1]} />
                <meshStandardMaterial color="#000000" transparent opacity={0.1} />
            </mesh>
        </group>
    );
}

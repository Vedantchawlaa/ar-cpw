"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { FabricMaterial } from "./FabricMaterial";
import { FabricTexture } from "@/lib/ar/types";

interface BlindProps {
    width: number;
    height: number;
    fabric: FabricTexture;
    openAmount: number;
}

export function Blind({ width, height, fabric, openAmount }: BlindProps) {
    const groupRef = useRef<THREE.Group>(null);
    const slatSpacing = 0.045;
    const slatHeight = 0.05;
    const numSlats = Math.ceil(height / slatSpacing);

    const slats = useMemo(() => {
        return Array.from({ length: numSlats }).map((_, i) => ({
            id: i,
            originalY: (height / 2) - (i * slatSpacing)
        }));
    }, [numSlats, height]);

    useFrame(() => {
        if (!groupRef.current) return;

        groupRef.current.children.forEach((child, i) => {
            if (child.name.startsWith("slat-")) {
                const slatIndex = parseInt(child.name.split("-")[1]);
                if (openAmount < 0.5) {
                    // Tilt phase
                    const tilt = (openAmount * 2) * (Math.PI / 2.2);
                    child.rotation.x = tilt;
                    child.position.y = (height / 2) - (slatIndex * slatSpacing);
                    child.visible = true;
                } else {
                    // Lift phase
                    const liftFactor = (openAmount - 0.5) * 2;
                    child.rotation.x = Math.PI / 2.2;
                    const targetY = (height / 2) - (slatIndex * 0.005);
                    const originalY = (height / 2) - (slatIndex * slatSpacing);
                    child.position.y = THREE.MathUtils.lerp(originalY, targetY, liftFactor);
                    child.visible = child.position.y > (height / 2) - (height * (1 - liftFactor));
                }
            }
        });
    });

    return (
        <group ref={groupRef}>
            {/* Top Housing */}
            <mesh position={[0, height / 2 + 0.02, 0]}>
                <boxGeometry args={[width + 0.04, 0.05, 0.06]} />
                <meshStandardMaterial color="#f0f0f0" metalness={0.5} roughness={0.3} />
            </mesh>

            {slats.map((slat) => (
                <mesh
                    key={slat.id}
                    name={`slat-${slat.id}`}
                    position={[0, slat.originalY, 0]}
                >
                    <boxGeometry args={[width, slatHeight, 0.005]} />
                    <FabricMaterial
                        url={fabric.url}
                        width={width}
                        height={slatHeight}
                        patternWidth={fabric.patternWidth}
                        patternHeight={fabric.patternHeight}
                    />
                </mesh>
            ))}

            {/* Guide Strings */}
            <mesh position={[-width / 2 + 0.05, 0, 0]}>
                <cylinderGeometry args={[0.002, 0.002, height]} />
                <meshStandardMaterial color="#ffffff" opacity={0.6} transparent />
            </mesh>
            <mesh position={[width / 2 - 0.05, 0, 0]}>
                <cylinderGeometry args={[0.002, 0.002, height]} />
                <meshStandardMaterial color="#ffffff" opacity={0.6} transparent />
            </mesh>
        </group>
    );
}

"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Interactive, useXRHitTest, useXR } from "@react-three/xr";
import * as THREE from "three";
import { Curtain } from "./models/Curtain";
import { Blind } from "./models/Blind";
import { ARState, DEFAULT_FABRICS } from "@/lib/ar/types";
import { getWallNormal } from "@/lib/ar/snapping";
import { isValidWallNormal } from "@/lib/ar/measurement";

interface ExperienceProps {
    state: ARState;
    setState: React.Dispatch<React.SetStateAction<ARState>>;
}

export function Experience({ state, setState }: ExperienceProps) {
    const session = useXR((state) => state.session);
    const reticleRef = useRef<THREE.Mesh>(null);
    const [isWallAligned, setIsWallAligned] = useState(false);

    // Sync session state to parent
    useEffect(() => {
        const isActive = !!session;
        setState(s => ({ ...s, isSessionActive: isActive }));
        if (isActive) {
            setState(s => ({ ...s, isSimulationMode: false }));
        }
    }, [session, setState]);

    const allFabrics = [...DEFAULT_FABRICS, ...state.customFabrics];

    // Standard R3F session initialization happens in the parent Canvas

    const matrixHelper = useMemo(() => new THREE.Matrix4(), []);

    useXRHitTest((results, getWorldMatrix) => {
        if (reticleRef.current && results.length > 0) {
            reticleRef.current.visible = true;
            getWorldMatrix(matrixHelper, results[0]);
            reticleRef.current.matrix.copy(matrixHelper);

            const normal = getWallNormal(matrixHelper);
            const isWall = isValidWallNormal(normal);
            setIsWallAligned(isWall);
        } else if (reticleRef.current) {
            reticleRef.current.visible = false;
        }
    }, 'viewer');

    const handleSelect = (e: any) => {
        if (!reticleRef.current?.visible || !isWallAligned) return;

        const position = new THREE.Vector3().setFromMatrixPosition(reticleRef.current.matrix);
        const normal = getWallNormal(reticleRef.current.matrix);

        triggerPlacement(position, normal);
    };

    const triggerPlacement = (position: THREE.Vector3, normal: THREE.Vector3) => {
        const currentPoints = state.measurePoints;

        if (currentPoints.length < 3) {
            setState(s => ({ ...s, measurePoints: [...s.measurePoints, position] }));
        } else if (currentPoints.length === 3) {
            const allPoints = [...currentPoints, position];
            const center = new THREE.Vector3();
            allPoints.forEach(p => center.add(p));
            center.divideScalar(4);

            const w1 = allPoints[0].distanceTo(allPoints[1]);
            const w2 = allPoints[3].distanceTo(allPoints[2]);
            const h1 = allPoints[0].distanceTo(allPoints[3]);
            const h2 = allPoints[1].distanceTo(allPoints[2]);
            const width = (w1 + w2) / 2;
            const height = (h1 + h2) / 2;

            const id = Math.random().toString(36).substr(2, 9);

            const rotation = new THREE.Quaternion();
            const matrix = new THREE.Matrix4().lookAt(center, center.clone().add(normal), new THREE.Vector3(0, 1, 0));
            rotation.setFromRotationMatrix(matrix);

            setState(s => ({
                ...s,
                placements: [...s.placements, {
                    id,
                    type: s.mode,
                    width,
                    height,
                    position: center.clone(),
                    rotation: rotation.clone(),
                    fabricId: s.currentFabricId,
                    openAmount: 0
                }],
                measurePoints: [],
                selectedId: id
            }));
        }
    };

    return (
        <>
            <ambientLight intensity={0.7} />
            <pointLight position={[10, 10, 10]} intensity={1.5} castShadow />
            <directionalLight position={[-5, 5, 5]} intensity={0.5} />

            {/* Reticle - Interactive session selection */}
            <Interactive onSelect={handleSelect}>
                <mesh ref={reticleRef} rotation={[-Math.PI / 2, 0, 0]} matrixAutoUpdate={false}>
                    <ringGeometry args={[0.1, 0.12, 32]} />
                    <meshBasicMaterial color={isWallAligned ? "#6366f1" : "#ef4444"} transparent opacity={0.8} />
                </mesh>
            </Interactive>

            {/* Placed Items */}
            {state.placements.map((p) => {
                const fabric = allFabrics.find(f => f.id === p.fabricId) || DEFAULT_FABRICS[0];
                return (
                    <group
                        key={p.id}
                        position={p.position}
                        quaternion={p.rotation}
                        onClick={(e) => {
                            e.stopPropagation();
                            setState(s => ({ ...s, selectedId: p.id }));
                        }}
                    >
                        {p.type === 'CURTAIN' ? (
                            <Curtain
                                width={p.width}
                                height={p.height}
                                fabric={fabric}
                                openAmount={p.openAmount}
                            />
                        ) : (
                            <Blind
                                width={p.width}
                                height={p.height}
                                fabric={fabric}
                                openAmount={p.openAmount}
                            />
                        )}

                        {/* Highlights if selected */}
                        {state.selectedId === p.id && (
                            <mesh position={[0, 0, 0.01]}>
                                <planeGeometry args={[p.width + 0.05, p.height + 0.05]} />
                                <meshBasicMaterial color="#6366f1" wireframe transparent opacity={0.3} />
                            </mesh>
                        )}
                    </group>
                );
            })}

            {/* Measurement Guides */}
            {state.measurePoints.map((pt, i) => (
                <mesh key={i} position={pt}>
                    <sphereGeometry args={[0.02, 16, 16]} />
                    <meshBasicMaterial color="#6366f1" />
                </mesh>
            ))}

            {/* Simulation Wall (only if not in AR session) */}
            {!session && state.isSimulationMode && (
                <mesh position={[0, 0, -2]} name="simulation-wall">
                    <planeGeometry args={[10, 10]} />
                    <meshStandardMaterial color="#e2e8f0" />
                    <gridHelper args={[10, 10, 0x94a3b8, 0xcbd5e1]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.01]} />
                </mesh>
            )}
        </>
    );
}

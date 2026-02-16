"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import {
    ARState,
    ARPlacement,
    ProductType,
    DEFAULT_FABRICS,
    FabricTexture
} from "@/lib/ar/types";
import {
    createQuadGeometry,
    createARMaterial,
    updateTextureScale,
    createCurtainGroup,
    createBlindGroup,
    updatePlacementAnimation
} from "@/lib/ar/geometry";
import { isValidWallNormal } from "@/lib/ar/measurement";
import { getWallNormal } from "@/lib/ar/snapping";
import { UIOverlay } from "./UIOverlay";
import { saveARMeasurements } from "@/lib/ar/api";
import { useRouter, useSearchParams } from "next/navigation";
import { createSimulationRoom, getSimulationHit } from "@/lib/ar/simulation";

export default function ARScene() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const leadId = searchParams.get("leadId") || "unknown";

    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const reticleRef = useRef<THREE.Mesh | null>(null);
    const hitTestSourceRef = useRef<any>(null);
    const simulationWallRef = useRef<THREE.Mesh | null>(null);

    const [state, setState] = useState<ARState>({
        mode: 'CURTAIN',
        placements: [],
        selectedId: null,
        currentFabricId: DEFAULT_FABRICS[0].id,
        isMeasuring: false,
        measurePoints: [],
        isSessionActive: false,
        isSimulationMode: false,
        customFabrics: []
    });

    const stateRef = useRef(state);
    useEffect(() => { stateRef.current = state; }, [state]);

    const allFabrics = [...DEFAULT_FABRICS, ...state.customFabrics];

    const applyFabricToMesh = (mesh: THREE.Object3D, width: number, height: number, fabricId: string) => {
        const fabric = allFabrics.find(f => f.id === fabricId) || DEFAULT_FABRICS[0];
        const loader = new THREE.TextureLoader();
        loader.load(fabric.url, (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            mesh.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                    const m = child as THREE.Mesh;
                    const material = m.material as THREE.MeshStandardMaterial;
                    if (m.name.includes("slat") || m.name.includes("curtain")) {
                        material.map = texture;
                        updateTextureScale(material, width, height, fabric.patternWidth, fabric.patternHeight);
                    }
                }
            });
        });
    };

    const handlePlacement = (position: THREE.Vector3, normal: THREE.Vector3) => {
        const currentPoints = stateRef.current.measurePoints;

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
            const material = createARMaterial(stateRef.current.mode);

            const group = stateRef.current.mode === 'CURTAIN'
                ? createCurtainGroup(width, height, material)
                : createBlindGroup(width, height, material);

            group.position.copy(center);
            group.lookAt(center.clone().add(normal));
            sceneRef.current?.add(group);

            const newPlacement: ARPlacement = {
                id,
                type: stateRef.current.mode,
                width,
                height,
                position: center.clone(),
                rotation: group.quaternion.clone(),
                fabricId: stateRef.current.currentFabricId,
                openAmount: 0,
                mesh: group
            };

            setState(s => ({
                ...s,
                placements: [...s.placements, newPlacement],
                measurePoints: [],
                selectedId: id
            }));

            applyFabricToMesh(group, width, height, stateRef.current.currentFabricId);
        }
    };

    const handleUpdateOpenAmount = (id: string, amount: number) => {
        setState(s => ({
            ...s,
            placements: s.placements.map(p => {
                if (p.id === id) {
                    if (p.mesh instanceof THREE.Group) {
                        updatePlacementAnimation(p.mesh, p.type, amount, p.width, p.height);
                    }
                    return { ...p, openAmount: amount };
                }
                return p;
            })
        }));
    };

    const handleUploadFabric = (fabric: FabricTexture) => {
        setState(s => ({
            ...s,
            customFabrics: [...s.customFabrics, fabric],
            currentFabricId: fabric.id
        }));

        // If an object is selected, apply the newly uploaded fabric instantly
        if (stateRef.current.selectedId) {
            const selected = stateRef.current.placements.find(p => p.id === stateRef.current.selectedId);
            if (selected && selected.mesh) {
                applyFabricToMesh(selected.mesh, selected.width, selected.height, fabric.id);
            }
        }
    };

    const startARSession = async () => {
        if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !reticleRef.current) return;

        try {
            if (!navigator.xr) throw new Error("WebXR not supported");

            const sessionInit = { requiredFeatures: ['hit-test'] };
            // @ts-ignore
            const session = await navigator.xr.requestSession('immersive-ar', sessionInit);

            rendererRef.current.xr.setSession(session);
            setState(s => ({ ...s, isSessionActive: true, isSimulationMode: false }));

            session.addEventListener('end', () => setState(s => ({ ...s, isSessionActive: false })));

            const viewerSpace = await (session as any).requestReferenceSpace('viewer');
            hitTestSourceRef.current = await (session as any).requestHitTestSource({ space: viewerSpace });

            const onSelect = () => {
                if (!reticleRef.current?.visible) return;
                const position = new THREE.Vector3().setFromMatrixPosition(reticleRef.current.matrix);
                handlePlacement(position, getWallNormal(reticleRef.current.matrix));
            };

            session.addEventListener('select', onSelect);

            rendererRef.current.setAnimationLoop((time, frame) => {
                if (frame && sceneRef.current && cameraRef.current && reticleRef.current) {
                    const referenceSpace = rendererRef.current?.xr.getReferenceSpace();
                    if (!referenceSpace) return;

                    const hitTestResults = frame.getHitTestResults(hitTestSourceRef.current);

                    if (hitTestResults.length > 0) {
                        const hit = hitTestResults[0];
                        const pose = hit.getPose(referenceSpace);

                        if (pose) {
                            reticleRef.current.visible = true;
                            reticleRef.current.matrix.fromArray(pose.transform.matrix);
                            const normal = getWallNormal(reticleRef.current.matrix);
                            const isWall = isValidWallNormal(normal);
                            (reticleRef.current.material as THREE.MeshBasicMaterial).color.set(isWall ? 0x6366f1 : 0xef4444);
                        }
                    } else {
                        reticleRef.current.visible = false;
                    }
                    rendererRef.current?.render(sceneRef.current, cameraRef.current);
                }
            });

        } catch (e) {
            console.error("WebXR failed:", e);
            startSimulation();
        }
    };

    const startSimulation = () => {
        if (!sceneRef.current || !rendererRef.current || !cameraRef.current) return;
        const existing = sceneRef.current.getObjectByName("simulation-wall");
        if (existing) return;

        const { wall } = createSimulationRoom(sceneRef.current);
        simulationWallRef.current = wall;
        cameraRef.current.position.set(0, 0, 3);
        cameraRef.current.lookAt(0, 0, 0);
        setState(s => ({ ...s, isSimulationMode: true, isSessionActive: false }));

        rendererRef.current.setAnimationLoop(() => {
            if (sceneRef.current && cameraRef.current) {
                rendererRef.current?.render(sceneRef.current, cameraRef.current);
            }
        });
    };

    const handleSimulationClick = (e: MouseEvent) => {
        if (!stateRef.current.isSimulationMode || !containerRef.current || !cameraRef.current || !simulationWallRef.current) return;
        const point = getSimulationHit(e, containerRef.current, cameraRef.current, simulationWallRef.current);
        if (point) handlePlacement(point, new THREE.Vector3(0, 0, 1));
    };

    const initScene = useCallback(async () => {
        if (!containerRef.current) return;
        const scene = new THREE.Scene();
        sceneRef.current = scene;
        const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
        cameraRef.current = camera;
        const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
        light.position.set(0.5, 1, 0.25);
        scene.add(light);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.xr.enabled = true;
        rendererRef.current = renderer;
        containerRef.current.appendChild(renderer.domElement);
        const reticleGeometry = new THREE.RingGeometry(0.1, 0.11, 32).rotateX(-Math.PI / 2);
        const reticleMaterial = new THREE.MeshBasicMaterial({ color: 0x6366f1 });
        const reticle = new THREE.Mesh(reticleGeometry, reticleMaterial);
        reticle.matrixAutoUpdate = false;
        reticle.visible = false;
        scene.add(reticle);
        reticleRef.current = reticle;
    }, []);

    useEffect(() => {
        initScene();
        return () => {
            if (rendererRef.current) {
                rendererRef.current.dispose();
                containerRef.current?.removeChild(rendererRef.current.domElement);
            }
        };
    }, [initScene]);

    const handleToggleMode = (mode: ProductType) => setState(s => ({ ...s, mode }));
    const handleReset = () => {
        stateRef.current.placements.forEach(p => { if (p.mesh) sceneRef.current?.remove(p.mesh); });
        setState(s => ({ ...s, measurePoints: [], placements: [], selectedId: null, customFabrics: [] }));
    };
    const handleSelectFabric = (fabricId: string) => {
        setState(s => ({ ...s, currentFabricId: fabricId }));
        const selected = stateRef.current.placements.find(p => p.id === stateRef.current.selectedId);
        if (selected && selected.mesh) applyFabricToMesh(selected.mesh, selected.width, selected.height, fabricId);
    };
    const handleDelete = () => {
        if (!state.selectedId) return;
        const toDelete = state.placements.find(p => p.id === state.selectedId);
        if (toDelete?.mesh) sceneRef.current?.remove(toDelete.mesh);
        setState(s => ({ ...s, placements: s.placements.filter(p => p.id !== state.selectedId), selectedId: null }));
    };

    const handleSave = async () => {
        const result = await saveARMeasurements(leadId, state.placements);
        if (result.success || result.status === 404) alert("Data synced! ✅");
        else alert("Failed to sync. ❌");
    };

    return (
        <div className="fixed inset-0 bg-black overflow-hidden">
            <div ref={containerRef} className="absolute inset-0 z-10" onClick={(e) => handleSimulationClick(e.nativeEvent)} />
            <UIOverlay
                state={state}
                onStartAR={startARSession}
                onStartSimulation={startSimulation}
                onToggleMode={handleToggleMode}
                onReset={handleReset}
                onDelete={handleDelete}
                onSave={handleSave}
                onSelectFabric={handleSelectFabric}
                onUpdateOpenAmount={handleUpdateOpenAmount}
                onUploadFabric={handleUploadFabric}
                onClose={() => router.back()}
            />
        </div>
    );
}

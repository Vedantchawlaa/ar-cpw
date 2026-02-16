import * as THREE from 'three';
import { ProductType } from './types';

export function createQuadGeometry(points: THREE.Vector3[]): THREE.BufferGeometry {
    if (points.length !== 4) return new THREE.PlaneGeometry(1, 1);

    const geometry = new THREE.BufferGeometry();
    const center = new THREE.Vector3();
    points.forEach(p => center.add(p));
    center.divideScalar(4);

    const localPoints = points.map(p => p.clone().sub(center));

    const vertices = new Float32Array([
        localPoints[0].x, localPoints[0].y, localPoints[0].z,
        localPoints[1].x, localPoints[1].y, localPoints[1].z,
        localPoints[2].x, localPoints[2].y, localPoints[2].z,

        localPoints[0].x, localPoints[0].y, localPoints[0].z,
        localPoints[2].x, localPoints[2].y, localPoints[2].z,
        localPoints[3].x, localPoints[3].y, localPoints[3].z,
    ]);

    const uvs = new Float32Array([
        0, 1, 1, 1, 1, 0,
        0, 1, 1, 0, 0, 0
    ]);

    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.computeVertexNormals();

    return geometry;
}

/**
 * Creates a realistic curtain with pleats using a sine wave displacement.
 */
export function createCurtainGroup(width: number, height: number, material: THREE.MeshStandardMaterial): THREE.Group {
    const group = new THREE.Group();
    group.name = "curtain-group";

    // Create a high-resolution plane for pleats
    const geometry = new THREE.PlaneGeometry(width, height, 40, 2);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = "curtain-mesh";

    // Add sine wave pleats via vertex displacement
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        // Frequency of 15 pleats per meter
        const pleat = Math.sin((x / width) * Math.PI * 20) * 0.05;
        positions.setZ(i, pleat);
    }
    geometry.computeVertexNormals();

    group.add(mesh);

    // Add a simple rod at the top
    const rodGeo = new THREE.CylinderGeometry(0.015, 0.015, width + 0.1);
    const rodMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 1, roughness: 0.2 });
    const rod = new THREE.Mesh(rodGeo, rodMat);
    rod.rotation.z = Math.PI / 2;
    rod.position.y = height / 2 + 0.02;
    group.add(rod);

    return group;
}

/**
 * Creates a realistic venetian blind with individual slats.
 */
export function createBlindGroup(width: number, height: number, material: THREE.MeshStandardMaterial): THREE.Group {
    const group = new THREE.Group();
    group.name = "blind-group";

    const slatHeight = 0.05; // 5cm slats
    const slatSpacing = 0.045; // Slight overlap
    const slatDepth = 0.01;
    const numSlats = Math.ceil(height / slatSpacing);

    const slatGeo = new THREE.BoxGeometry(width, slatHeight, slatDepth);

    for (let i = 0; i < numSlats; i++) {
        const slat = new THREE.Mesh(slatGeo, material.clone());
        slat.position.y = (height / 2) - (i * slatSpacing);
        slat.name = `slat-${i}`;
        group.add(slat);
    }

    // Add side strings/cords
    const cordGeo = new THREE.CylinderGeometry(0.002, 0.002, height);
    const cordMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee });

    const cordL = new THREE.Mesh(cordGeo, cordMat);
    cordL.position.x = -width / 2 + 0.05;
    group.add(cordL);

    const cordR = new THREE.Mesh(cordGeo, cordMat);
    cordR.position.x = width / 2 - 0.05;
    group.add(cordR);

    return group;
}

/**
 * Updates the visual state of a curtain or blind based on openAmount (0-1).
 */
export function updatePlacementAnimation(group: THREE.Group, type: ProductType, openAmount: number, width: number, height: number) {
    if (type === 'CURTAIN') {
        const mesh = group.getObjectByName("curtain-mesh") as THREE.Mesh;
        if (mesh) {
            // Scale width towards the center or sides
            // For now, let's scale X from the side
            mesh.scale.x = 1 - (openAmount * 0.9); // Don't disappear completely
            mesh.position.x = (width / 2) * (openAmount * 0.9);
        }
    } else {
        // Blinds: Tilt slats and then lift
        const slats = group.children.filter(c => c.name.startsWith("slat-"));
        slats.forEach((slat, i) => {
            if (openAmount < 0.5) {
                // Tilt phase (0 to 0.5)
                const tilt = (openAmount * 2) * (Math.PI / 2.2); // Up to ~80 degrees
                slat.rotation.x = tilt;
                slat.position.y = (height / 2) - (i * 0.045); // Original position
            } else {
                // Lift phase (0.5 to 1.0)
                const liftFactor = (openAmount - 0.5) * 2;
                slat.rotation.x = Math.PI / 2.2; // Keep tilted

                // Compress slats towards the top
                const originalY = (height / 2) - (i * 0.045);
                const targetY = (height / 2) - (i * 0.005); // compressed to 5mm
                slat.position.y = THREE.MathUtils.lerp(originalY, targetY, liftFactor);

                // Hide slats that go above the rod? Or just let them bunch up
                slat.visible = slat.position.y > (height / 2) - (height * (1 - liftFactor));
            }
        });
    }
}

export function createARMaterial(type: ProductType, texture?: THREE.Texture): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
        map: texture || null,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 1.0,
        roughness: 0.8,
        metalness: 0.0,
    });
}

export function updateTextureScale(material: THREE.MeshStandardMaterial, width: number, height: number, patternWidth: number, patternHeight: number) {
    if (!material.map) return;
    material.map.wrapS = THREE.RepeatWrapping;
    material.map.wrapT = THREE.RepeatWrapping;
    material.map.repeat.set(width / patternWidth, height / patternHeight);
    material.map.needsUpdate = true;
}

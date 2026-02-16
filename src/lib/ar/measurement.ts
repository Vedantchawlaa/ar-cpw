import * as THREE from 'three';

/**
 * Measurement Logic (Layer 2)
 * Calculates width (horizontal distance) and height (vertical diff) between two 3D points.
 */
export function calculateMeasuredDimensions(p1: THREE.Vector3, p2: THREE.Vector3) {
    // Width is the horizontal distance in the plane of the wall
    // We treat the horizontal plane as XZ and vertical as Y

    // Horizontal vector (ignoring Y)
    const horiz1 = new THREE.Vector2(p1.x, p1.z);
    const horiz2 = new THREE.Vector2(p2.x, p2.z);
    const width = horiz1.distanceTo(horiz2);

    // Height is the absolute vertical difference
    const height = Math.abs(p1.y - p2.y);

    return {
        width: Math.max(0.1, width),   // Min 10cm
        height: Math.max(0.1, height), // Min 10cm
        center: new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5)
    };
}

/**
 * Surface Validation:
 * Rejects placements that are too close to the floor (horizontal orientation).
 */
export function isValidWallNormal(normal: THREE.Vector3): boolean {
    // A wall normal should be mostly horizontal (Y close to 0)
    // Floor/Ceiling normals are mostly vertical (Y close to 1 or -1)
    const yComponent = Math.abs(normal.y);
    return yComponent < 0.5; // Allow up to 45 degree tilt
}

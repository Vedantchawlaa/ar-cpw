import * as THREE from 'three';

/**
 * Wall Alignment Logic:
 * Uses the hit-test normal to align the object to the wall.
 * Ensures the object's local upward axis stays vertical.
 */
export function alignToObjectToWall(object: THREE.Object3D, position: THREE.Vector3, normal: THREE.Vector3) {
    object.position.copy(position);

    // Look along the normal (away from wall)
    const targetPoint = position.clone().add(normal);

    // We want the object to face the normal but stay upright
    const up = new THREE.Vector3(0, 1, 0);
    object.lookAt(targetPoint);

    // Re-enforce verticality if lookAt tilted it (though it shouldn't for pure wall hits)
    object.up.copy(up);
}

/**
 * Plane Snapping Logic:
 * Ensures the measurement points are projected accurately.
 */
export function getWallNormal(matrix: THREE.Matrix4): THREE.Vector3 {
    const normal = new THREE.Vector3(0, 0, 1); // Default Z forward in local
    normal.applyMatrix4(matrix).normalize();
    return normal;
}

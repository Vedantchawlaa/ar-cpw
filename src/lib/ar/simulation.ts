import * as THREE from "three";

export function createSimulationRoom(scene: THREE.Scene) {
    // Wall (representing the surface where curtains go)
    const wallGeometry = new THREE.PlaneGeometry(10, 10);
    const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0xeeeeee,
        side: THREE.DoubleSide
    });
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.position.z = -2; // 2 meters away
    wall.name = "simulation-wall";
    scene.add(wall);

    // Floor
    const floorGeometry = new THREE.PlaneGeometry(10, 10);
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0xcccccc
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2;
    floor.position.z = -2;
    scene.add(floor);

    // Grid for depth perception
    const grid = new THREE.GridHelper(10, 10);
    grid.position.y = -1.99;
    grid.position.z = -2;
    scene.add(grid);

    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    return { wall, floor };
}

export function getSimulationHit(
    event: MouseEvent,
    container: HTMLDivElement,
    camera: THREE.Camera,
    target: THREE.Object3D
) {
    const rect = container.getBoundingClientRect();
    const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObject(target);
    if (intersects.length > 0) {
        return intersects[0].point;
    }
    return null;
}

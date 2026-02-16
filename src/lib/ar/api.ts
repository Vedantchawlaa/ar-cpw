import { ARPlacement } from './types';

export async function saveARMeasurements(leadId: string, placements: ARPlacement[]) {
    const payload = {
        leadId,
        placements: placements.map(p => ({
            width: p.width,
            height: p.height,
            productType: p.type,
            fabricId: p.fabricId,
            // Convert Three.js objects to plain arrays/objects for JSON
            position: { x: p.position.x, y: p.position.y, z: p.position.z },
            rotation: { x: p.rotation.x, y: p.rotation.y, z: p.rotation.z, w: p.rotation.w }
        })),
        timestamp: new Date().toISOString()
    };

    console.log("Syncing AR Data to CRM:", payload);

    try {
        const response = await fetch('/api/v1/ar-measurements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        // We aren't implementing the backend route yet, so we'll expect a 404/500
        // and handle it gracefully for the demo/build phase.
        return { success: response.ok, status: response.status };
    } catch (error) {
        console.error("CRM Sync Failed:", error);
        return { success: false, error };
    }
}

// safeTexture: utility to prevent Phaser 'sourceSize' crashes.
// Returns the texture key if it exists with valid frame data,
// otherwise returns '__DEFAULT' (Phaser's built-in fallback).

export function safeTex(scene, key, frame) {
    if (!key) return '__DEFAULT';
    if (!scene.textures.exists(key)) {
        console.warn('Missing texture:', key);
        return '__DEFAULT';
    }
    // If a specific frame is requested, verify it exists
    if (frame != null) {
        const tex = scene.textures.get(key);
        if (!tex.has(frame)) {
            console.warn('Missing frame:', key, frame);
            return '__DEFAULT';
        }
    }
    return key;
}

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class RockManager {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;

    this.isLoaded = false;
    this.rockModel = null;

    // Active rocks map keyed by segment index -> array of rock objects
    this.activeSegmentRocks = new Map();

    this.preloadAsset();
  }

  preloadAsset() {
    const loader = new GLTFLoader();
    loader.load(
      '/src/env/stylized_low-poly_stone.glb',
      (gltf) => {
        this.rockModel = gltf.scene;
        
        this.rockModel.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
              child.material.flatShading = true;
              child.material.needsUpdate = true;
            }
          }
        });

        this.isLoaded = true;
      },
      undefined,
      (err) => {
        console.warn('Fallback: Low-poly stone GLTF failed to load, creating procedural rock fallback.', err);
        this.createFallbackRockModel();
        this.isLoaded = true;
      }
    );
  }

  createFallbackRockModel() {
    const group = new THREE.Group();
    const rockGeo = new THREE.DodecahedronGeometry(2.5, 1);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x546e7a,
      roughness: 0.85,
      flatShading: true
    });
    const mesh = new THREE.Mesh(rockGeo, rockMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    this.rockModel = group;
  }

  onSegmentCreated(segmentIndex, zCenter, segmentLength) {
    // Don't spawn rocks in initial starting area (segments 0 and 1) so player starts safely
    if (segmentIndex <= 1) return;

    // 60% chance of 1 rock per 80m segment to guarantee clear open lanes and ample space
    if (Math.random() > 0.60) return;

    const segmentRocks = [];

    // Position Z within segment with margin
    const offsetZ = (Math.random() - 0.5) * (segmentLength - 30);
    const rockZ = zCenter + offsetZ;

    // Distribute across left, center-left, center-right, and right lanes
    const laneChoices = [-10.5, -4.5, 4.5, 10.5];
    const chosenLane = laneChoices[Math.floor(Math.random() * laneChoices.length)];
    const rockX = chosenLane + (Math.random() * 2.0 - 1.0);

    const rockMesh = this.createRockInstance();

    // Highly varied non-uniform sizes (Scale range 1.4x to 3.8x)
    const scaleBase = 1.4 + Math.random() * 2.4;
    const scaleX = scaleBase * (0.85 + Math.random() * 0.3);
    const scaleY = scaleBase * (0.9 + Math.random() * 0.4);
    const scaleZ = scaleBase * (0.85 + Math.random() * 0.3);

    rockMesh.scale.set(scaleX, scaleY, scaleZ);

    // Submerge rock base into lake bed so it looks grounded underwater (-1.0m to -1.8m)
    const posY = -1.0 - (scaleY * 0.22);
    rockMesh.position.set(rockX, posY, rockZ);

    // Unique random 3D rotations for organic shape variation
    rockMesh.rotation.set(
      (Math.random() - 0.5) * 0.4,
      Math.random() * Math.PI * 2,
      (Math.random() - 0.5) * 0.4
    );

    this.scene.add(rockMesh);

    segmentRocks.push({
      mesh: rockMesh,
      x: rockX,
      z: rockZ,
      radius: Math.max(scaleX, scaleZ) * 0.82 // Dynamic collision radius matching scale
    });

    this.activeSegmentRocks.set(segmentIndex, segmentRocks);
  }

  createRockInstance() {
    if (this.rockModel) {
      return this.rockModel.clone(true);
    }
    const rockGeo = new THREE.DodecahedronGeometry(2.5, 1);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x546e7a,
      roughness: 0.85,
      flatShading: true
    });
    const mesh = new THREE.Mesh(rockGeo, rockMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  onSegmentDestroyed(segmentIndex) {
    const rocks = this.activeSegmentRocks.get(segmentIndex);
    if (rocks) {
      rocks.forEach((r) => {
        this.scene.remove(r.mesh);
        r.mesh.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
        });
      });
      this.activeSegmentRocks.delete(segmentIndex);
    }
  }

  update(physics) {
    if (!physics) return;

    const boatPos = physics.worldPosition;
    const boatRadius = 1.6; // Boat contour width

    for (const [idx, rocks] of this.activeSegmentRocks.entries()) {
      for (const rock of rocks) {
        const dx = boatPos.x - rock.x;
        const dz = boatPos.z - rock.z;
        const distSq = dx * dx + dz * dz;
        const hitDist = rock.radius + boatRadius;

        if (distSq < hitDist * hitDist) {
          const dist = Math.sqrt(distSq) || 0.001;
          const nx = dx / dist;
          const nz = dz / dist;

          // 1. HARD IMPENETRABLE COLLISION DISPLACEMENT (Boat physically cannot enter/pass through rock)
          const overlap = hitDist - dist;
          boatPos.x += nx * overlap;
          boatPos.z += nz * overlap;

          // Clamp X to safe lake channel boundary
          boatPos.x = THREE.MathUtils.clamp(
            boatPos.x,
            -physics.safeChannelLimit + 0.5,
            physics.safeChannelLimit - 0.5
          );

          // 2. STOP SPEED & BOUNCE REFLECTION
          physics.speed = Math.max(0, physics.speed * 0.2);
          physics.turnSpeed = nx * 1.5;

          // 3. DAMAGE & FEEDBACK (Only trigger HP reduction when not in invulnerability frames)
          if (physics.invulnerableTimer <= 0) {
            physics.health = Math.max(0, physics.health - 20);
            physics.invulnerableTimer = 0.8;

            if (this.game) {
              this.game.triggerDamageFeedback();
              if (physics.health <= 0) {
                this.game.gameOver();
              }
            }
          }
        }
      }
    }
  }
}

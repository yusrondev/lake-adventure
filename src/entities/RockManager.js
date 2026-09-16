import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class RockManager {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;

    this.isLoaded = false;
    this.rockModel = null;
    this.baseExtents = new THREE.Vector3(2.5, 2.5, 2.5);
    this.baseCenter = new THREE.Vector3(0, 0, 0);

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
              if (child.material.roughness !== undefined) {
                child.material.roughness = 0.65;
                child.material.metalness = 0.15;
              }
              child.material.needsUpdate = true;
            }
          }
        });

        // Compute local 3D bounding box of base GLTF rock geometry
        const box = new THREE.Box3().setFromObject(this.rockModel);
        box.getSize(this.baseExtents);
        box.getCenter(this.baseCenter);

        if (this.baseExtents.x === 0) this.baseExtents.set(2.5, 2.5, 2.5);

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
      roughness: 0.65,
      metalness: 0.15,
      flatShading: true
    });
    const mesh = new THREE.Mesh(rockGeo, rockMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    this.rockModel = group;

    const box = new THREE.Box3().setFromObject(this.rockModel);
    box.getSize(this.baseExtents);
    box.getCenter(this.baseCenter);
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
    const scaleX = scaleBase * (0.85 + Math.random() * 0.35);
    const scaleY = scaleBase * (0.9 + Math.random() * 0.4);
    const scaleZ = scaleBase * (0.85 + Math.random() * 0.35);

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
    rockMesh.updateMatrixWorld(true);

    const inverseMatrix = new THREE.Matrix4().copy(rockMesh.matrixWorld).invert();

    // Calculate local 3D bounding box half-extents for this rock geometry
    const halfExtents = new THREE.Vector3(
      this.baseExtents.x * 0.5,
      this.baseExtents.y * 0.5,
      this.baseExtents.z * 0.5
    );

    segmentRocks.push({
      mesh: rockMesh,
      x: rockX,
      z: rockZ,
      matrixWorld: rockMesh.matrixWorld,
      inverseMatrix: inverseMatrix,
      halfExtents: halfExtents,
      localCenter: this.baseCenter.clone(),
      maxWorldRadius: Math.max(scaleX, scaleY, scaleZ) * 2.8
    });

    this.activeSegmentRocks.set(segmentIndex, segmentRocks);
  }

  createRockInstance() {
    let instance;
    if (this.rockModel) {
      instance = this.rockModel.clone(true);
    } else {
      const rockGeo = new THREE.DodecahedronGeometry(2.5, 1);
      const rockMat = new THREE.MeshStandardMaterial({
        color: 0x546e7a,
        roughness: 0.65,
        metalness: 0.15,
        flatShading: true
      });
      instance = new THREE.Mesh(rockGeo, rockMat);
    }

    instance.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    return instance;
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
    if (!physics || !physics.boat) return;

    const boatPos = physics.worldPosition;
    const halfLength = physics.boat.length / 2;
    const bowWidth = physics.boat.getHullHalfWidthAtZ(-halfLength * 0.9);
    const midWidth = physics.boat.getHullHalfWidthAtZ(0);
    const sternWidth = physics.boat.getHullHalfWidthAtZ(halfLength * 0.9);

    // 7 key sampling points on 3D boat contour
    const localHullPoints = [
      new THREE.Vector3(0, 0, -halfLength),              // Bow tip
      new THREE.Vector3(-bowWidth, 0, -halfLength * 0.7), // Bow Port
      new THREE.Vector3(bowWidth, 0, -halfLength * 0.7),  // Bow Starboard
      new THREE.Vector3(-midWidth, 0, 0),                 // Midship Port
      new THREE.Vector3(midWidth, 0, 0),                  // Midship Starboard
      new THREE.Vector3(-sternWidth, 0, halfLength * 0.85),// Stern Port
      new THREE.Vector3(sternWidth, 0, halfLength * 0.85) // Stern Starboard
    ];

    const rotMatrix = new THREE.Euler(physics.pitch, physics.heading, -physics.roll, 'YXZ');
    const worldHullPoints = localHullPoints.map((pt) =>
      pt.clone().applyEuler(rotMatrix).add(boatPos)
    );

    const localPt = new THREE.Vector3();
    const closestPt = new THREE.Vector3();
    const localDiff = new THREE.Vector3();
    const worldNormal = new THREE.Vector3();

    for (const [idx, rocks] of this.activeSegmentRocks.entries()) {
      for (const rock of rocks) {
        // Broad phase cutoff: check distance to rock world position
        const dx = boatPos.x - rock.x;
        const dz = boatPos.z - rock.z;
        if (dx * dx + dz * dz > (rock.maxWorldRadius + 6.0) * (rock.maxWorldRadius + 6.0)) {
          continue;
        }

        // Narrow phase: 3D Oriented Bounding Geometry Check matching exact mesh orientation & scale
        const minX = rock.localCenter.x - rock.halfExtents.x;
        const maxX = rock.localCenter.x + rock.halfExtents.x;
        const minY = rock.localCenter.y - rock.halfExtents.y;
        const maxY = rock.localCenter.y + rock.halfExtents.y;
        const minZ = rock.localCenter.z - rock.halfExtents.z;
        const maxZ = rock.localCenter.z + rock.halfExtents.z;

        const boatMargin = 0.45; // Fitted margin matching rock 3D surface contour

        for (const worldPt of worldHullPoints) {
          // Transform world hull point into local rock coordinate space
          localPt.copy(worldPt).applyMatrix4(rock.inverseMatrix);

          // Find closest point on local rock box
          closestPt.x = THREE.MathUtils.clamp(localPt.x, minX, maxX);
          closestPt.y = THREE.MathUtils.clamp(localPt.y, minY, maxY);
          closestPt.z = THREE.MathUtils.clamp(localPt.z, minZ, maxZ);

          localDiff.subVectors(localPt, closestPt);
          const distSq = localDiff.lengthSq();

          if (distSq < boatMargin * boatMargin || (localPt.x >= minX && localPt.x <= maxX && localPt.z >= minZ && localPt.z <= maxZ)) {
            // EXACT CONTOUR COLLISION DETECTED!
            const dist = Math.sqrt(distSq) || 0.001;
            
            if (distSq > 0.0001) {
              worldNormal.copy(localDiff).normalize().transformDirection(rock.matrixWorld).normalize();
            } else {
              worldNormal.set(boatPos.x - rock.x, 0, boatPos.z - rock.z).normalize();
            }

            // 1. HARD IMPENETRABLE COLLISION DISPLACEMENT ALONG MESH CONTOUR
            const overlap = Math.max(0.35, boatMargin - dist);
            physics.worldPosition.x += worldNormal.x * overlap;
            physics.worldPosition.z += worldNormal.z * overlap;

            // Clamp X to safe channel boundary
            physics.worldPosition.x = THREE.MathUtils.clamp(
              physics.worldPosition.x,
              -physics.safeChannelLimit + 0.5,
              physics.safeChannelLimit - 0.5
            );

            // 2. STOP FORWARD SPEED & APPLY STEERING BOUNCE IMPULSE
            physics.speed = Math.max(0, physics.speed * 0.15);
            physics.turnSpeed = worldNormal.x * 1.8;

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

            break; // Handled hit for this rock
          }
        }
      }
    }
  }
}

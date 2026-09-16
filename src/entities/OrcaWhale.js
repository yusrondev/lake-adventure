import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class OrcaWhaleManager {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;

    this.isLoaded = false;
    this.orcaGroup = new THREE.Group();
    this.scene.add(this.orcaGroup);
    this.orcaGroup.visible = false;

    // Breach state parameters
    this.isBreaching = false;
    this.breachTime = 0;
    this.breachDuration = 3.2; // 3.2 seconds dolphin jump arc
    this.side = 1; // +1 = Right side, -1 = Left side
    this.spawnTimer = 12.0; // First spawn after 12 seconds
    this.hasHitBoat = false;

    // Splash Particle Pool (Low-Poly Performance Optimized)
    this.initSplashParticles();

    // Preallocated Vectors for Zero-GC calculation
    this.startPos = new THREE.Vector3();
    this.targetPos = new THREE.Vector3();
    this.currentPos = new THREE.Vector3();
  }

  preloadAsset(onProgress, onLoad) {
    const loader = new GLTFLoader();
    // Load GLTF asset
    loader.load(
      '/src/env/orca_whale_low_poly.glb',
      (gltf) => {
        this.orcaModel = gltf.scene;
        
        // Optimize materials & shadows
        this.orcaModel.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
              child.material.flatShading = true;
              child.material.needsUpdate = true;
            }
          }
        });

        // Proportional scale for 8.4m wooden boat environment
        this.orcaModel.scale.set(1.8, 1.8, 1.8);
        this.orcaGroup.add(this.orcaModel);
        this.isLoaded = true;

        if (onLoad) onLoad();
      },
      (xhr) => {
        if (xhr.lengthComputable && onProgress) {
          const percent = Math.round((xhr.loaded / xhr.total) * 100);
          onProgress(percent);
        }
      },
      (err) => {
        console.warn('Fallback: Orca GLTF load failed, generating low-poly mesh fallback.', err);
        this.createFallbackOrcaMesh();
        this.isLoaded = true;
        if (onLoad) onLoad();
      }
    );
  }

  createFallbackOrcaMesh() {
    this.orcaModel = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e272e, roughness: 0.4, flatShading: true });
    const bellyMat = new THREE.MeshStandardMaterial({ color: 0xf5f6fa, roughness: 0.4, flatShading: true });

    // Body
    const bodyGeo = new THREE.ConeGeometry(1.2, 5.0, 7);
    bodyGeo.rotateX(Math.PI / 2);
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.orcaModel.add(bodyMesh);

    // Belly patch
    const bellyGeo = new THREE.BoxGeometry(0.9, 0.4, 3.2);
    const bellyMesh = new THREE.Mesh(bellyGeo, bellyMat);
    bellyMesh.position.set(0, -0.4, 0);
    this.orcaModel.add(bellyMesh);

    // Dorsal Fin
    const finGeo = new THREE.ConeGeometry(0.35, 1.6, 4);
    finGeo.rotateX(-Math.PI / 4);
    const finMesh = new THREE.Mesh(finGeo, bodyMat);
    finMesh.position.set(0, 0.9, 0.4);
    this.orcaModel.add(finMesh);

    this.orcaModel.scale.set(1.6, 1.6, 1.6);
    this.orcaGroup.add(this.orcaModel);
  }

  initSplashParticles() {
    this.splashGroup = new THREE.Group();
    this.splashParticles = [];
    const particleCount = 22;

    const splashMat = new THREE.MeshStandardMaterial({
      color: 0xe0f7fa,
      roughness: 0.3,
      transparent: true,
      opacity: 0.0,
      flatShading: true
    });

    const puffGeo = new THREE.DodecahedronGeometry(0.25, 0);

    for (let i = 0; i < particleCount; i++) {
      const mesh = new THREE.Mesh(puffGeo, splashMat);
      mesh.visible = false;
      this.splashGroup.add(mesh);
      this.splashParticles.push({
        mesh: mesh,
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 0.7
      });
    }

    this.scene.add(this.splashGroup);
  }

  triggerSplash(pos) {
    this.splashGroup.position.copy(pos);
    this.splashParticles.forEach((p) => {
      p.mesh.visible = true;
      p.mesh.position.set(0, 0, 0);
      const angle = Math.random() * Math.PI * 2;
      const speed = 3.5 + Math.random() * 5.0;
      p.vel.set(
        Math.cos(angle) * speed,
        4.0 + Math.random() * 4.0,
        Math.sin(angle) * speed
      );
      p.life = p.maxLife;
      p.mesh.scale.setScalar(0.6 + Math.random() * 0.8);
    });
  }

  updateSplash(delta) {
    this.splashParticles.forEach((p) => {
      if (p.life > 0) {
        p.life -= delta;
        p.vel.y -= 12.0 * delta; // Gravity
        p.mesh.position.addScaledVector(p.vel, delta);
        
        const normLife = Math.max(0, p.life / p.maxLife);
        p.mesh.material.opacity = normLife * 0.75;
        p.mesh.scale.multiplyScalar(0.96);

        if (p.life <= 0) {
          p.mesh.visible = false;
        }
      }
    });
  }

  startBreach(boatWorldPos, boatHeading) {
    if (!this.isLoaded || this.isBreaching) return;

    this.isBreaching = true;
    this.breachTime = 0;
    this.hasHitBoat = false;
    this.side = Math.random() > 0.5 ? 1 : -1; // Randomly left or right side

    // Set starting position underwater behind/beside the boat
    const lateralOffset = this.side * (2.8 + Math.random() * 1.5);
    const startZOffset = 12.0; // Starts 12m behind boat
    
    // Compute world coordinates forward along river (-Z in boat space)
    const forwardVec = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), boatHeading);
    const rightVec = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), boatHeading);

    this.startPos.copy(boatWorldPos)
      .addScaledVector(rightVec, lateralOffset)
      .addScaledVector(forwardVec, -startZOffset);
    this.startPos.y = -5.0; // Deep underwater

    this.targetPos.copy(boatWorldPos)
      .addScaledVector(rightVec, -this.side * 1.0)
      .addScaledVector(forwardVec, 18.0);
    this.targetPos.y = -4.0;

    this.orcaGroup.position.copy(this.startPos);
    this.orcaGroup.visible = true;

    // Trigger initial underwater splash foam
    this.triggerSplash(new THREE.Vector3(this.startPos.x, 0.2, this.startPos.z));
  }

  update(delta, boatPhysics) {
    if (!this.isLoaded) return;

    // Update splash particles
    this.updateSplash(delta);

    const isPlaying = this.game && this.game.gameState === 'PLAYING';

    if (isPlaying && !this.isBreaching) {
      this.spawnTimer -= delta;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = 18.0 + Math.random() * 12.0; // Next breach in 18-30s
        this.startBreach(boatPhysics.worldPosition, boatPhysics.heading);
      }
    }

    if (this.isBreaching) {
      this.breachTime += delta;
      const progress = Math.min(1.0, this.breachTime / this.breachDuration);

      // Smooth parabolic arc jump equation (Breach)
      const currentX = THREE.MathUtils.lerp(this.startPos.x, this.targetPos.x, progress);
      const currentZ = THREE.MathUtils.lerp(this.startPos.z, this.targetPos.z, progress);
      
      // Arc Height Y (Breaches up to +5.2m out of the water!)
      const arcY = Math.sin(progress * Math.PI) * 10.5 - 5.0;

      this.orcaGroup.position.set(currentX, arcY, currentZ);

      // Dynamic orientation (Pitches up on ascent, levels at peak, pitches down into water)
      const tangentY = Math.cos(progress * Math.PI) * 10.5;
      const pitchAngle = -Math.atan2(tangentY, 8.0);
      const yawAngle = boatPhysics.heading + (this.side * -0.25);
      const rollAngle = -this.side * 0.45;

      this.orcaGroup.rotation.set(pitchAngle, yawAngle, rollAngle, 'YXZ');

      // Check impact collision with boat near peak/descent (progress between 0.35 and 0.70)
      if (!this.hasHitBoat && progress >= 0.35 && progress <= 0.70) {
        const boatPos = boatPhysics.worldPosition;
        const distToBoat = Math.hypot(currentX - boatPos.x, currentZ - boatPos.z);

        if (distToBoat <= 3.8 && Math.abs(arcY - boatPos.y) <= 3.5) {
          this.hasHitBoat = true;

          // Reduce Boat HP by 20%
          boatPhysics.health = Math.max(0, boatPhysics.health - 20);
          
          // Trigger impact feedback, screen shake & red flash
          if (this.game) {
            this.game.triggerDamageFeedback();
            if (boatPhysics.health <= 0) {
              this.game.gameOver();
            }
          }

          // Trigger massive water splash on hit
          this.triggerSplash(new THREE.Vector3(currentX, 0.4, currentZ));
        }
      }

      // Splash when re-entering water (progress > 0.85)
      if (progress > 0.85 && progress < 0.90 && arcY <= 0.5) {
        this.triggerSplash(new THREE.Vector3(currentX, 0.2, currentZ));
      }

      if (progress >= 1.0) {
        this.isBreaching = false;
        this.orcaGroup.visible = false;
      }
    }
  }
}

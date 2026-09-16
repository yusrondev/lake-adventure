import * as THREE from 'three';

export class WoodenPlank {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.Group();

    this.width = 1.6;  // X: -0.8 to +0.8
    this.length = 3.2; // Z: -1.6 to +1.6

    this.buildPlankGeometry();
    this.buildRealisticWaterWake();
  }

  buildPlankGeometry() {
    const woodMaterial = new THREE.MeshStandardMaterial({
      color: 0x8d5524,
      roughness: 0.75,
      metalness: 0.08
    });

    const darkWoodMat = new THREE.MeshStandardMaterial({
      color: 0x5a3215,
      roughness: 0.85
    });

    const ropeMaterial = new THREE.MeshStandardMaterial({
      color: 0xd6c29a,
      roughness: 0.9
    });

    // 5 Planks of bound timber
    const plankCount = 5;
    const plankWidth = this.width / plankCount;

    for (let i = 0; i < plankCount; i++) {
      const plankGeo = new THREE.BoxGeometry(plankWidth - 0.03, 0.16, this.length);
      const mat = (i % 2 === 0) ? woodMaterial : darkWoodMat;
      const plankMesh = new THREE.Mesh(plankGeo, mat);
      
      const xPos = -this.width / 2 + plankWidth / 2 + i * plankWidth;
      plankMesh.position.set(xPos, 0, 0);
      plankMesh.castShadow = true;
      plankMesh.receiveShadow = true;
      this.mesh.add(plankMesh);
    }

    // Cross-beams
    const crossBeamFront = new THREE.Mesh(
      new THREE.BoxGeometry(this.width + 0.1, 0.1, 0.12),
      ropeMaterial
    );
    crossBeamFront.position.set(0, 0.08, -this.length * 0.35);
    this.mesh.add(crossBeamFront);

    const crossBeamBack = new THREE.Mesh(
      new THREE.BoxGeometry(this.width + 0.1, 0.1, 0.12),
      ropeMaterial
    );
    crossBeamBack.position.set(0, 0.08, this.length * 0.35);
    this.mesh.add(crossBeamBack);

    this.scene.add(this.mesh);
  }

  buildRealisticWaterWake() {
    // 1. Water Wake Trails (V-Shaped expanding stern wash)
    this.wakeCount = 60;
    this.wakeGeo = new THREE.BufferGeometry();
    const wakePositions = new Float32Array(this.wakeCount * 3);
    const wakeSizes = new Float32Array(this.wakeCount);
    const wakeLifetimes = new Float32Array(this.wakeCount);

    for (let i = 0; i < this.wakeCount; i++) {
      wakePositions[i * 3] = (Math.random() - 0.5) * 0.8;
      wakePositions[i * 3 + 1] = 0.03;
      wakePositions[i * 3 + 2] = 1.6 + Math.random() * 4.0;
      wakeSizes[i] = 0.4 + Math.random() * 0.5;
      wakeLifetimes[i] = Math.random();
    }

    this.wakeGeo.setAttribute('position', new THREE.BufferAttribute(wakePositions, 3));
    this.wakeGeo.setAttribute('size', new THREE.BufferAttribute(wakeSizes, 1));

    // Particle texture
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    grad.addColorStop(0.4, 'rgba(230, 248, 255, 0.7)');
    grad.addColorStop(0.8, 'rgba(180, 230, 255, 0.2)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const wakeTex = new THREE.CanvasTexture(canvas);

    this.wakeMat = new THREE.PointsMaterial({
      size: 1.2,
      map: wakeTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });

    this.wakePoints = new THREE.Points(this.wakeGeo, this.wakeMat);
    this.mesh.add(this.wakePoints);

    // 2. Side Spray Emitter (Carving spray when turning)
    this.sprayCount = 40;
    this.sprayGeo = new THREE.BufferGeometry();
    const sprayPos = new Float32Array(this.sprayCount * 3);
    const sprayVel = new Float32Array(this.sprayCount * 3);

    for (let i = 0; i < this.sprayCount; i++) {
      sprayPos[i * 3] = (Math.random() > 0.5 ? 0.8 : -0.8);
      sprayPos[i * 3 + 1] = 0.05;
      sprayPos[i * 3 + 2] = (Math.random() - 0.5) * 2.0;
      sprayVel[i * 3] = (sprayPos[i * 3] > 0 ? 1 : -1) * (1.0 + Math.random() * 2.0);
      sprayVel[i * 3 + 1] = 0.8 + Math.random() * 1.5;
      sprayVel[i * 3 + 2] = 0.5 + Math.random() * 1.0;
    }

    this.sprayGeo.setAttribute('position', new THREE.BufferAttribute(sprayPos, 3));
    this.sprayVelocities = sprayVel;

    this.sprayMat = new THREE.PointsMaterial({
      size: 0.6,
      map: wakeTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.7,
      blending: THREE.AdditiveBlending
    });

    this.sprayPoints = new THREE.Points(this.sprayGeo, this.sprayMat);
    this.mesh.add(this.sprayPoints);
  }

  updateSplash(speed, turnRate, delta) {
    if (!this.wakePoints || !this.sprayPoints) return;

    // 1. Update Stern Wake
    const wakePos = this.wakeGeo.attributes.position.array;
    const isMoving = speed > 0.3;

    for (let i = 0; i < this.wakeCount; i++) {
      if (isMoving) {
        // Move backwards relative to raft
        wakePos[i * 3 + 2] += (speed * 1.6 + 1.2) * delta;
        // Expand outward in V-shape
        const sideSign = wakePos[i * 3] >= 0 ? 1 : -1;
        wakePos[i * 3] += sideSign * 0.4 * delta;
        // Float on surface
        wakePos[i * 3 + 1] = 0.04 + Math.sin(wakePos[i * 3 + 2] * 2.0) * 0.02;

        if (wakePos[i * 3 + 2] > 8.0) {
          wakePos[i * 3] = (Math.random() - 0.5) * 0.6;
          wakePos[i * 3 + 1] = 0.04;
          wakePos[i * 3 + 2] = 1.5 + Math.random() * 0.4;
        }
      }
    }
    this.wakeGeo.attributes.position.needsUpdate = true;
    this.wakeMat.opacity = Math.min(0.9, speed * 0.08 + (isMoving ? 0.3 : 0.0));

    // 2. Update Side Spray (intensifies when turning / carving water)
    const sprayPos = this.sprayGeo.attributes.position.array;
    const turnIntensity = Math.abs(turnRate);

    for (let i = 0; i < this.sprayCount; i++) {
      if (isMoving) {
        sprayPos[i * 3] += this.sprayVelocities[i * 3] * (1.0 + turnIntensity * 2.0) * delta;
        sprayPos[i * 3 + 1] += this.sprayVelocities[i * 3 + 1] * delta;
        this.sprayVelocities[i * 3 + 1] -= 9.8 * delta * 0.5; // Gravity
        sprayPos[i * 3 + 2] += this.sprayVelocities[i * 3 + 2] * delta;

        // Reset spray drop
        if (sprayPos[i * 3 + 1] <= 0 || Math.abs(sprayPos[i * 3]) > 3.0) {
          const isLeft = Math.random() > 0.5;
          sprayPos[i * 3] = isLeft ? -0.8 : 0.8;
          sprayPos[i * 3 + 1] = 0.06;
          sprayPos[i * 3 + 2] = -0.5 + Math.random() * 2.0;
          this.sprayVelocities[i * 3] = (isLeft ? -1 : 1) * (1.2 + Math.random() * 2.0);
          this.sprayVelocities[i * 3 + 1] = 1.0 + Math.random() * 1.8;
        }
      }
    }
    this.sprayGeo.attributes.position.needsUpdate = true;
    this.sprayMat.opacity = Math.min(0.85, (speed * 0.06) + (turnIntensity * 0.4));
  }
}

import * as THREE from 'three';

export class BlockyHumanoid {
  constructor() {
    this.mesh = new THREE.Group();

    // Color Palette
    this.materials = {
      skin: new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.6 }),
      shirt: new THREE.MeshStandardMaterial({ color: 0x0984e3, roughness: 0.5 }), // Vibrant cyan-blue
      pants: new THREE.MeshStandardMaterial({ color: 0x2d3436, roughness: 0.6 }),
      shoes: new THREE.MeshStandardMaterial({ color: 0x636e72, roughness: 0.8 }),
      hair: new THREE.MeshStandardMaterial({ color: 0x2d1c10, roughness: 0.9 }),
      eyes: new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.2 })
    };

    this.buildBodyParts();

    // Procedural animation state
    this.walkCycle = 0;
    this.currentFacingAngle = 0;
    this.currentLeanX = 0;
    this.currentLeanZ = 0;
    this.prevLocalPos = new THREE.Vector2(0, 0);
  }

  buildBodyParts() {
    // 1. Pelvis / Hips Root (Positioned so soles of feet rest perfectly at y = 0.0)
    this.hips = new THREE.Group();
    this.hips.position.y = 0.65; 
    this.mesh.add(this.hips);

    const pelvisMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.15, 0.22),
      this.materials.pants
    );
    this.hips.add(pelvisMesh);

    // 2. Abdomen / Perut
    this.abdomen = new THREE.Group();
    this.abdomen.position.y = 0.12;
    this.hips.add(this.abdomen);

    const abdomenMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.18, 0.20),
      this.materials.shirt
    );
    this.abdomen.add(abdomenMesh);

    // 3. Chest / Dada
    this.chest = new THREE.Group();
    this.chest.position.y = 0.18;
    this.abdomen.add(this.chest);

    const chestMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.26, 0.24),
      this.materials.shirt
    );
    this.chest.add(chestMesh);

    // 4. Neck & Head (Kepala & Leher)
    this.neck = new THREE.Group();
    this.neck.position.y = 0.16;
    this.chest.add(this.neck);

    const neckMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.06, 0.12),
      this.materials.skin
    );
    this.neck.add(neckMesh);

    this.head = new THREE.Group();
    this.head.position.y = 0.15;
    this.neck.add(this.head);

    const headMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.30, 0.30, 0.30),
      this.materials.skin
    );
    headMesh.castShadow = true;
    this.head.add(headMesh);

    // Hair
    const hairMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.10, 0.32),
      this.materials.hair
    );
    hairMesh.position.y = 0.12;
    this.head.add(hairMesh);

    // Eyes
    const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), this.materials.eyes);
    leftEye.position.set(-0.07, 0.02, -0.155);
    const rightEye = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), this.materials.eyes);
    rightEye.position.set(0.07, 0.02, -0.155);
    this.head.add(leftEye, rightEye);

    // 5. Left Arm (Lengan Kiri)
    this.leftShoulder = new THREE.Group();
    this.leftShoulder.position.set(-0.25, 0.08, 0);
    this.chest.add(this.leftShoulder);

    const leftUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 0.12), this.materials.shirt);
    leftUpperArm.position.y = -0.10;
    this.leftShoulder.add(leftUpperArm);

    this.leftElbow = new THREE.Group();
    this.leftElbow.position.y = -0.20;
    this.leftShoulder.add(this.leftElbow);

    const leftForearm = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.22, 0.10), this.materials.skin);
    leftForearm.position.y = -0.10;
    this.leftElbow.add(leftForearm);

    // 6. Right Arm (Lengan Kanan)
    this.rightShoulder = new THREE.Group();
    this.rightShoulder.position.set(0.25, 0.08, 0);
    this.chest.add(this.rightShoulder);

    const rightUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 0.12), this.materials.shirt);
    rightUpperArm.position.y = -0.10;
    this.rightShoulder.add(rightUpperArm);

    this.rightElbow = new THREE.Group();
    this.rightElbow.position.y = -0.20;
    this.rightShoulder.add(this.rightElbow);

    const rightForearm = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.22, 0.10), this.materials.skin);
    rightForearm.position.y = -0.10;
    this.rightElbow.add(rightForearm);

    // 7. Left Leg (Kaki Kiri)
    this.leftHipJoint = new THREE.Group();
    this.leftHipJoint.position.set(-0.10, -0.07, 0);
    this.hips.add(this.leftHipJoint);

    const leftThigh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.30, 0.14), this.materials.pants);
    leftThigh.position.y = -0.14;
    this.leftHipJoint.add(leftThigh);

    this.leftKnee = new THREE.Group();
    this.leftKnee.position.y = -0.28;
    this.leftHipJoint.add(this.leftKnee);

    const leftShin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.12), this.materials.pants);
    leftShin.position.y = -0.13;
    this.leftKnee.add(leftShin);

    this.leftFoot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.20), this.materials.shoes);
    this.leftFoot.position.set(0, -0.26, -0.03);
    this.leftKnee.add(this.leftFoot);

    // 8. Right Leg (Kaki Kanan)
    this.rightHipJoint = new THREE.Group();
    this.rightHipJoint.position.set(0.10, -0.07, 0);
    this.hips.add(this.rightHipJoint);

    const rightThigh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.30, 0.14), this.materials.pants);
    rightThigh.position.y = -0.14;
    this.rightHipJoint.add(rightThigh);

    this.rightKnee = new THREE.Group();
    this.rightKnee.position.y = -0.28;
    this.rightHipJoint.add(this.rightKnee);

    const rightShin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.12), this.materials.pants);
    rightShin.position.y = -0.13;
    this.rightKnee.add(rightShin);

    this.rightFoot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.20), this.materials.shoes);
    this.rightFoot.position.set(0, -0.26, -0.03);
    this.rightKnee.add(this.rightFoot);

    // Shadows
    this.mesh.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
  }

  updateAnimation(speed, currentLocalPos, targetLocalPos, delta) {
    const smoothDamp = 1.0 - Math.exp(-9.0 * delta);

    const moveX = targetLocalPos.x - currentLocalPos.x;
    const moveZ = targetLocalPos.y - currentLocalPos.y;
    const moveDist = Math.hypot(moveX, moveZ);
    const isStepping = moveDist > 0.04;

    const normX = currentLocalPos.x / 0.65;
    const normZ = currentLocalPos.y / 1.35;

    this.currentLeanX += (normX - this.currentLeanX) * smoothDamp;
    this.currentLeanZ += (normZ - this.currentLeanZ) * smoothDamp;

    // 1. DYNAMIC FACING ROTATION
    let targetFacing = 0;
    if (isStepping) {
      targetFacing = Math.atan2(moveX, -moveZ);
    } else {
      targetFacing = this.currentLeanX * 0.45;
    }

    this.currentFacingAngle += (targetFacing - this.currentFacingAngle) * (1.0 - Math.exp(-8.0 * delta));
    this.mesh.rotation.y = this.currentFacingAngle;

    // 2. ACTIVE WALKING / STEPPING FEET ANIMATION
    if (isStepping) {
      this.walkCycle += delta * 12.0;
      const stepPhase = Math.sin(this.walkCycle);
      const stepCos = Math.cos(this.walkCycle);

      this.leftHipJoint.rotation.x = stepPhase * 0.55;
      this.rightHipJoint.rotation.x = -stepPhase * 0.55;

      this.leftKnee.rotation.x = Math.max(0.1, stepCos * 0.6);
      this.rightKnee.rotation.x = Math.max(0.1, -stepCos * 0.6);

      this.leftShoulder.rotation.x = -stepPhase * 0.45;
      this.rightShoulder.rotation.x = stepPhase * 0.45;
      this.leftShoulder.rotation.z = 0.35;
      this.rightShoulder.rotation.z = -0.35;

      // Hips bobbing height relative to raft surface (0.65 base height)
      this.hips.position.y = 0.65 + Math.abs(Math.sin(this.walkCycle * 2.0)) * 0.03;
    } else {
      // 3. STATIONARY ATHLETIC SURFING STANCE
      this.walkCycle += delta * 2.5;
      const breathe = Math.sin(this.walkCycle) * 0.02;

      this.leftHipJoint.rotation.x = 0.1;
      this.rightHipJoint.rotation.x = -0.15;
      this.leftKnee.rotation.x = 0.22;
      this.rightKnee.rotation.x = 0.22;

      const balanceSpread = 0.35 + Math.abs(this.currentLeanX) * 0.35;
      this.leftShoulder.rotation.z = balanceSpread;
      this.rightShoulder.rotation.z = -balanceSpread;
      this.leftShoulder.rotation.x = breathe - this.currentLeanZ * 0.25;
      this.rightShoulder.rotation.x = -breathe - this.currentLeanZ * 0.25;

      this.leftElbow.rotation.x = 0.25 + Math.abs(this.currentLeanX) * 0.2;
      this.rightElbow.rotation.x = 0.25 + Math.abs(this.currentLeanX) * 0.2;

      this.hips.position.y = 0.64 + breathe;
    }

    // 4. SPINE & HEAD LEAN
    this.chest.rotation.z = -this.currentLeanX * 0.25;
    this.chest.rotation.x = -this.currentLeanZ * 0.20;
    this.head.rotation.z = this.currentLeanX * 0.12;
    this.head.rotation.y = -this.currentLeanX * 0.25;
  }
}

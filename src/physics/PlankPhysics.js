import * as THREE from 'three';

export class PlankPhysics {
  constructor(woodenBoat, humanoid, waterSystem) {
    this.boat = woodenBoat;
    this.humanoid = humanoid;
    this.waterSystem = waterSystem;

    // Attach humanoid directly to boat group for 100% matrix synchronization
    this.boat.mesh.add(this.humanoid.mesh);
    this.humanoid.mesh.position.set(0, 0.12, 0);

    // Initial default bounds for doubled grand vessel (8.4m length)
    this.maxX = 1.6;
    this.maxZ = 3.8;

    this.playerLocalPos = new THREE.Vector2(0, 0);
    this.targetPlayerLocalPos = new THREE.Vector2(0, 0);

    // Hydrodynamic parameters
    this.speed = 0;              
    this.maxSpeed = 16.0;        
    this.maxReverseSpeed = 4.8; // ~17 km/h max reverse speed
    this.acceleration = 11.0;    
    this.brakingRate = 16.0;     
    this.drag = 1.2;             

    this.heading = 0;            
    this.turnSpeed = 0;          
    this.maxTurnSpeed = 0.45;    
    this.maxHeadingAngle = 0.22; // Subtle 12.6 degree max turn angle for realism

    this.roll = 0;               
    this.pitch = 0;              

    // World Position
    this.worldPosition = new THREE.Vector3(0, 0, 0);
    this.safeChannelLimit = 16.5;

    // Health
    this.maxHealth = 100;
    this.health = 100;
    this.invulnerableTimer = 0;
  }

  applyJoystickVector(normX, normY, delta) {
    const moveRate = 3.6; // Walking speed on deck
    this.targetPlayerLocalPos.x += normX * moveRate * delta;
    this.targetPlayerLocalPos.y += normY * moveRate * delta;

    // Dynamically clamp player within 3D boat hull contour
    const currentMaxX = this.boat.getHullHalfWidthAtZ(this.targetPlayerLocalPos.y);
    this.targetPlayerLocalPos.x = THREE.MathUtils.clamp(this.targetPlayerLocalPos.x, -currentMaxX, currentMaxX);
    this.targetPlayerLocalPos.y = THREE.MathUtils.clamp(this.targetPlayerLocalPos.y, -this.maxZ, this.maxZ);
  }

  updateInput(input, delta) {
    const moveRate = 3.6;

    let dirX = 0;
    let dirZ = 0;

    if (input.left) dirX -= 1;
    if (input.right) dirX += 1;
    if (input.forward) dirZ -= 1;
    if (input.backward) dirZ += 1;

    if (dirX !== 0 || dirZ !== 0) {
      this.targetPlayerLocalPos.x += dirX * moveRate * delta;
      this.targetPlayerLocalPos.y += dirZ * moveRate * delta;

      const currentMaxX = this.boat.getHullHalfWidthAtZ(this.targetPlayerLocalPos.y);
      this.targetPlayerLocalPos.x = THREE.MathUtils.clamp(this.targetPlayerLocalPos.x, -currentMaxX, currentMaxX);
      this.targetPlayerLocalPos.y = THREE.MathUtils.clamp(this.targetPlayerLocalPos.y, -this.maxZ, this.maxZ);
    }
  }

  updatePhysics(delta) {
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= delta;
    }

    // 1. SMOOTH PLAYER POSITION ON BOAT DECK (Player remains at last position!)
    const posDamp = 1.0 - Math.exp(-12.0 * delta);
    this.playerLocalPos.x += (this.targetPlayerLocalPos.x - this.playerLocalPos.x) * posDamp;
    this.playerLocalPos.y += (this.targetPlayerLocalPos.y - this.playerLocalPos.y) * posDamp;

    // Dynamically clamp active position to 3D hull contour
    const activeMaxX = this.boat.getHullHalfWidthAtZ(this.playerLocalPos.y);
    this.playerLocalPos.x = THREE.MathUtils.clamp(this.playerLocalPos.x, -activeMaxX, activeMaxX);

    const normX = this.playerLocalPos.x / (activeMaxX > 0 ? activeMaxX : 0.7);
    const normZ = this.playerLocalPos.y / this.maxZ;

    // 2. SUBTLE HYDRODYNAMIC STEERING & REALISTIC WHOLE-HULL WEIGHT LISTING
    let targetTurnRate = 0;
    // Entire boat hull rolls/heels uniformly when player weight shifts to left or right deck
    const targetRoll = normX * 0.16; 

    if (Math.abs(normX) > 0.25) {
      const activeX = (normX - Math.sign(normX) * 0.25) / 0.75;
      targetTurnRate = activeX * this.maxTurnSpeed;
    } else {
      targetTurnRate = -this.heading * 1.8;
    }

    const steerDamp = 1.0 - Math.exp(-6.0 * delta);
    this.turnSpeed += (targetTurnRate - this.turnSpeed) * steerDamp;
    this.heading += this.turnSpeed * delta;
    this.heading = THREE.MathUtils.clamp(this.heading, -this.maxHeadingAngle, this.maxHeadingAngle);

    // 3. BASE CRUISING SPEED, ACCELERATION & REVERSE DYNAMICS
    const baseCruisingSpeed = 3.6; // ~13 km/h
    const factor = Math.abs(normZ);

    if (normZ > 0.15) {
      // Standing on back of deck (Holding Backward / S key / Joystick Down)
      if (this.speed > 0) {
        // Step 1: Brake forward speed down to 0
        this.speed -= this.brakingRate * factor * delta;
        if (this.speed < 0) this.speed = 0;
      } else {
        // Step 2: Once speed reaches 0, holding position accelerates boat in REVERSE!
        this.speed -= this.acceleration * 0.45 * factor * delta;
      }
    } else if (normZ < -0.15) {
      // Standing on front of deck (Holding Forward / W key / Joystick Up)
      if (this.speed < 0) {
        // Step 1: Brake reverse speed back to 0
        this.speed += this.brakingRate * 1.5 * factor * delta;
        if (this.speed > 0) this.speed = 0;
      } else {
        // Step 2: Accelerate forward
        this.speed += (this.maxSpeed - this.speed) * factor * delta * 2.0;
      }
    } else {
      // Neutral deck position: return reverse speed to 0, or cruising speed if moving forward
      if (this.speed < 0) {
        this.speed += 6.0 * delta;
        if (this.speed > 0) this.speed = 0;
      } else {
        this.speed += (baseCruisingSpeed - this.speed) * delta * 1.5;
      }
    }

    this.speed = THREE.MathUtils.clamp(this.speed, -this.maxReverseSpeed, this.maxSpeed);

    // 4. WAVE BUOYANCY & TILT INTERACTION
    let waveY = 0;
    let wavePitch = 0;
    if (this.waterSystem) {
      waveY = this.waterSystem.getWaveHeight(this.worldPosition.x, this.worldPosition.z);
      const frontWave = this.waterSystem.getWaveHeight(this.worldPosition.x, this.worldPosition.z - 1.5);
      const backWave = this.waterSystem.getWaveHeight(this.worldPosition.x, this.worldPosition.z + 1.5);
      wavePitch = (frontWave - backWave) * 0.35;
    }

    const targetPitch = (normZ * 0.08) + wavePitch;
    const tiltDamp = 1.0 - Math.exp(-6.0 * delta);
    this.pitch += (targetPitch - this.pitch) * tiltDamp;
    this.roll += (targetRoll - this.roll) * tiltDamp;

    // 5. WORLD POSITION UPDATE
    const forwardX = Math.sin(this.heading);
    const forwardZ = -Math.cos(this.heading);

    this.worldPosition.x += forwardX * this.speed * delta;
    this.worldPosition.z += forwardZ * this.speed * delta;
    this.worldPosition.y = waveY * 0.8;

    this.worldPosition.x = THREE.MathUtils.clamp(this.worldPosition.x, -this.safeChannelLimit, this.safeChannelLimit);

    // 6. THREE.JS MESH UPDATES
    this.boat.mesh.position.copy(this.worldPosition);
    this.boat.mesh.rotation.set(this.pitch, this.heading, -this.roll, 'YXZ');

    // Humanoid is child of boat: set local position flush on deck floor (deckY)
    this.humanoid.mesh.position.set(this.playerLocalPos.x, this.boat.deckY || 0.12, this.playerLocalPos.y);
    this.humanoid.updateAnimation(this.speed, this.playerLocalPos, this.targetPlayerLocalPos, delta);

    // Update Splash & Wake Particles + Lantern Sway Physics & Water Lighting Sync
    this.boat.updateSplash(this.speed, this.turnSpeed, delta);
    this.boat.updateLanternPhysics(delta, this.speed, this.turnSpeed, this.roll, this.pitch, this.waterSystem ? this.waterSystem.material : null);
  }

  // 3D Mesh Contour Shore Collision Check
  check3DHullShoreCollision(chunkManager) {
    if (!this.boat.isLoaded) return chunkManager.checkBankCollision(this.worldPosition.x);

    // Sample 5 key contour points on the 3D boat GLTF mesh (Bow tip, Bow-Port, Bow-Starboard, Stern-Port, Stern-Starboard)
    const halfLength = this.boat.length / 2;
    const bowWidth = this.boat.getHullHalfWidthAtZ(-halfLength * 0.9);
    const midWidth = this.boat.getHullHalfWidthAtZ(0);
    const sternWidth = this.boat.getHullHalfWidthAtZ(halfLength * 0.9);

    const localHullPoints = [
      new THREE.Vector3(0, 0, -halfLength),           // Pointed Bow tip
      new THREE.Vector3(-bowWidth, 0, -halfLength * 0.7), // Bow Port
      new THREE.Vector3(bowWidth, 0, -halfLength * 0.7),  // Bow Starboard
      new THREE.Vector3(-midWidth, 0, 0),                 // Midship Port
      new THREE.Vector3(midWidth, 0, 0),                  // Midship Starboard
      new THREE.Vector3(-sternWidth, 0, halfLength * 0.85),// Stern Port
      new THREE.Vector3(sternWidth, 0, halfLength * 0.85) // Stern Starboard
    ];

    const rotMatrix = new THREE.Euler(this.pitch, this.heading, -this.roll, 'YXZ');

    for (const localPt of localHullPoints) {
      const worldPt = localPt.clone().applyEuler(rotMatrix).add(this.worldPosition);
      const collision = chunkManager.checkBankCollision(worldPt.x);
      if (collision.collided) {
        return collision; // Return true collision based on 3D mesh contour!
      }
    }

    return { collided: false, bounceDir: 0 };
  }

  handleCollision(bounceDirection) {
    if (this.invulnerableTimer > 0) return false;

    this.health = Math.max(0, this.health - 20);
    this.invulnerableTimer = 0.7;

    this.speed = Math.max(3.0, this.speed * 0.4);
    this.heading = bounceDirection * 0.4;
    this.turnSpeed = bounceDirection * 1.8;
    this.worldPosition.x += bounceDirection * 1.5;
    this.worldPosition.x = THREE.MathUtils.clamp(this.worldPosition.x, -this.safeChannelLimit + 0.5, this.safeChannelLimit - 0.5);

    return true;
  }

  getStatusText() {
    const normX = this.playerLocalPos.x / 0.7;
    const normZ = this.playerLocalPos.y / 1.35;

    if (normZ > 0.4) {
      return this.speed < -0.2 ? "⏪ Mundur (Tumpuan Belakang)" : "⏹️ Mengerem (Tumpuan Belakang)";
    }
    if (normZ < -0.4) return "🚀 Maju (Tumpuan Depan)";
    if (normX < -0.25) return "↩️ Belok Kiri";
    if (normX > 0.25) return "↪️ Belok Kanan";
    return "⚖️ Meluncur Lurus";
  }
}

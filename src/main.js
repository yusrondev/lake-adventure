import * as THREE from 'three';
import { WaterSystem } from './graphics/WaterShader.js';
import { BlockyHumanoid } from './entities/BlockyHumanoid.js';
import { WoodenBoat } from './entities/WoodenBoat.js';
import { PlankPhysics } from './physics/PlankPhysics.js';
import { ChunkManager } from './world/ChunkManager.js';
import { DayNightCycle } from './graphics/DayNightCycle.js';
import { RockManager } from './entities/RockManager.js';

class InfiniteLakeGame {
  constructor() {
    this.container = document.getElementById('game-container');
    
    // UI Elements
    this.timeEl = document.getElementById('time-val');
    this.compassEl = document.getElementById('compass-val');
    this.distanceEl = document.getElementById('distance-val');
    this.speedEl = document.getElementById('speed-val');
    this.highscoreEl = document.getElementById('highscore-val');
    this.hpValEl = document.getElementById('hp-val');
    this.hpFillEl = document.getElementById('hp-bar-fill');
    this.modalScreen = document.getElementById('modal-screen');
    this.btnStart = document.getElementById('btn-start');

    // Joystick UI Elements
    this.joystickBase = document.getElementById('joystick-base');
    this.joystickStick = document.getElementById('joystick-stick');
    this.joystickActive = false;
    this.joystickVector = { x: 0, y: 0 };

    // Lantern UI Elements & 360 Spotlight Aim State
    this.btnLanternToggle = document.getElementById('btn-lantern-toggle');
    this.lanternAimBar = document.getElementById('lantern-aim-bar');
    this.btnAimLeft = document.getElementById('btn-aim-left');
    this.btnAimFront = document.getElementById('btn-aim-front');
    this.btnAimRight = document.getElementById('btn-aim-right');
    this.spotlightDegree = 0; // 0 = Forward (-Z)

    // Camera Shake
    this.screenShake = 0;

    // High Score
    this.highScore = parseInt(localStorage.getItem('lake_highscore') || '0', 10);
    if (this.highscoreEl) {
      this.highscoreEl.innerHTML = `${this.highScore} <small>m</small>`;
    }

    // Game state
    this.gameState = 'MENU';
    this.distanceTraveled = 0;

    // Keyboard Input States
    this.input = {
      forward: false,
      backward: false,
      left: false,
      right: false
    };

    // Pre-allocated Vector3 buffers to prevent GC stuttering in animation loop
    this.tempCamOffset = new THREE.Vector3();
    this.targetCamPos = new THREE.Vector3();
    this.lookAtPos = new THREE.Vector3();
    this.upAxis = new THREE.Vector3(0, 1, 0);

    this.initThree();
    this.initEntities();
    this.setupEvents();
    this.setupJoystick();

    // Start Animation Loop
    this.clock = new THREE.Clock();
    this.animate();
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x60a5fa);
    this.scene.fog = new THREE.FogExp2(0x60a5fa, 0.007);

    // Farther camera POV as requested (7.5 height, 15.0 distance back)
    this.camera = new THREE.PerspectiveCamera(
      58,
      window.innerWidth / window.innerHeight,
      0.1,
      600
    );
    this.camera.position.set(0, 7.5, 15.0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.container.appendChild(this.renderer.domElement);

    const ambientLight = new THREE.HemisphereLight(0xddeeff, 0x224422, 0.65);
    this.scene.add(ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfffaed, 1.4);
    this.sunLight.position.set(40, 60, 20);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 200;
    this.sunLight.shadow.camera.left = -30;
    this.sunLight.shadow.camera.right = 30;
    this.sunLight.shadow.camera.top = 30;
    this.sunLight.shadow.camera.bottom = -30;
    this.scene.add(this.sunLight);
  }

  initEntities() {
    this.waterSystem = new WaterSystem(this.scene);
    this.humanoid = new BlockyHumanoid();

    // Direct synchronous low-poly wooden boat instantiation
    this.woodenBoat = new WoodenBoat(this.scene);
    this.physics = new PlankPhysics(this.woodenBoat, this.humanoid, this.waterSystem);

    this.chunkManager = new ChunkManager(this.scene, this.waterSystem.material);

    // Lake Rock Obstacle Manager (stylized_low-poly_stone.glb)
    this.rockManager = new RockManager(this.scene, this);
    this.chunkManager.setRockManager(this.rockManager);
    
    // Dynamic Day-Night Celestial Cycle with giant glowing sun & water lighting sync
    this.dayNightCycle = new DayNightCycle(this.scene, this.sunLight, this.camera, this.waterSystem.material);
  }

  setupEvents() {
    window.addEventListener('keydown', (e) => this.handleKey(e, true));
    window.addEventListener('keyup', (e) => this.handleKey(e, false));

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    if (this.btnStart) {
      this.btnStart.addEventListener('click', () => this.startGame());
    }

    // Reliable Event Binding Helper for both Desktop Mouse & Mobile Touch Screens
    const bindBtnEvent = (btnEl, actionFn) => {
      if (!btnEl) return;
      const handler = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        actionFn();
      };
      btnEl.addEventListener('pointerdown', handler);
      btnEl.addEventListener('click', handler);
    };

    // Interactive Lantern On/Off & 360 Spotlight Controls
    bindBtnEvent(this.btnLanternToggle, () => {
      const newState = !this.woodenBoat.isLanternOn;
      this.woodenBoat.setLanternOn(newState);

      if (newState) {
        this.btnLanternToggle.textContent = '🔌 Matikan Lampu';
        this.btnLanternToggle.classList.add('on');
        if (this.lanternAimBar) this.lanternAimBar.classList.remove('hidden');
      } else {
        this.btnLanternToggle.textContent = '💡 Nyalakan Lampu';
        this.btnLanternToggle.classList.remove('on');
        if (this.lanternAimBar) this.lanternAimBar.classList.add('hidden');
      }
    });

    const updateSpotlightAngle = (targetDeg) => {
      // Normalize degree to range [-180, 180] for smooth and accurate orientation
      let norm = targetDeg % 360;
      if (norm > 180) norm -= 360;
      if (norm < -180) norm += 360;

      this.spotlightDegree = norm;
      const rad = (this.spotlightDegree * Math.PI) / 180;
      this.woodenBoat.setSpotlightAngle(rad);

      // Update UI button active highlights
      if (this.btnAimFront) {
        if (Math.abs(this.spotlightDegree) < 5) {
          this.btnAimFront.classList.add('active');
        } else {
          this.btnAimFront.classList.remove('active');
        }
      }
      if (this.btnAimLeft) {
        if (this.spotlightDegree <= -5) {
          this.btnAimLeft.classList.add('active');
        } else {
          this.btnAimLeft.classList.remove('active');
        }
      }
      if (this.btnAimRight) {
        if (this.spotlightDegree >= 5) {
          this.btnAimRight.classList.add('active');
        } else {
          this.btnAimRight.classList.remove('active');
        }
      }
    };

    bindBtnEvent(this.btnAimLeft, () => {
      updateSpotlightAngle(this.spotlightDegree - 30);
    });

    bindBtnEvent(this.btnAimRight, () => {
      updateSpotlightAngle(this.spotlightDegree + 30);
    });

    bindBtnEvent(this.btnAimFront, () => {
      updateSpotlightAngle(0);
    });
  }

  setupJoystick() {
    if (!this.joystickBase) return;

    this.joystickOrigin = null;

    const handlePointerStart = (clientX, clientY) => {
      if (this.gameState !== 'PLAYING') return;

      this.joystickActive = true;
      this.joystickOrigin = { x: clientX, y: clientY };

      // Dynamically move joystick base to touch/mouse origin
      this.joystickBase.style.left = `${clientX}px`;
      this.joystickBase.style.top = `${clientY}px`;
      this.joystickBase.classList.add('active');
      this.joystickStick.style.transform = `translate(0px, 0px)`;
      this.joystickVector = { x: 0, y: 0 };
    };

    const handlePointerMove = (clientX, clientY) => {
      if (!this.joystickActive || !this.joystickOrigin) return;

      let deltaX = clientX - this.joystickOrigin.x;
      let deltaY = clientY - this.joystickOrigin.y;

      const maxRadius = 55;
      const distance = Math.hypot(deltaX, deltaY);

      if (distance > maxRadius) {
        deltaX = (deltaX / distance) * maxRadius;
        deltaY = (deltaY / distance) * maxRadius;
      }

      this.joystickStick.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

      const normX = deltaX / maxRadius;
      const normY = deltaY / maxRadius;

      this.joystickVector.x = normX;
      this.joystickVector.y = normY;
    };

    const handlePointerEnd = () => {
      this.joystickActive = false;
      this.joystickOrigin = null;
      this.joystickBase.classList.remove('active');
      this.joystickStick.style.transform = `translate(0px, 0px)`;
      this.joystickVector = { x: 0, y: 0 };
    };

    // Check if touch or click is targeting interactive UI elements
    const isTargetingUI = (target, clientY) => {
      if (clientY < 60) return true;
      if (!target) return false;
      return !!target.closest('#lantern-hud-container, .hud-top-bar, .lantern-btn, .aim-btn, .modal-card');
    };

    // Global screen touch listener for dynamic joystick spawning
    window.addEventListener('touchstart', (e) => {
      if (this.gameState !== 'PLAYING') return;
      const touch = e.touches[0];
      if (isTargetingUI(e.target || touch.target, touch.clientY)) return;
      handlePointerStart(touch.clientX, touch.clientY);
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (this.joystickActive && e.touches.length > 0) {
        const touch = e.touches[0];
        handlePointerMove(touch.clientX, touch.clientY);
      }
    }, { passive: true });

    window.addEventListener('touchend', () => handlePointerEnd());
    window.addEventListener('touchcancel', () => handlePointerEnd());

    window.addEventListener('mousedown', (e) => {
      if (this.gameState !== 'PLAYING') return;
      if (isTargetingUI(e.target, e.clientY)) return;
      handlePointerStart(e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', (e) => {
      if (this.joystickActive) {
        handlePointerMove(e.clientX, e.clientY);
      }
    });

    window.addEventListener('mouseup', () => handlePointerEnd());
  }

  handleKey(e, isDown) {
    const code = e.code;
    if (code === 'KeyW' || code === 'ArrowUp') this.input.forward = isDown;
    if (code === 'KeyS' || code === 'ArrowDown') this.input.backward = isDown;
    if (code === 'KeyA' || code === 'ArrowLeft') this.input.left = isDown;
    if (code === 'KeyD' || code === 'ArrowRight') this.input.right = isDown;
  }

  startGame() {
    this.gameState = 'PLAYING';
    this.modalScreen.classList.add('hidden');

    // Auto Fullscreen Trigger on Game Start
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(() => {});
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen().catch(() => {});
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen().catch(() => {});
    }
    
    this.physics.worldPosition.set(0, 0, 0);
    this.physics.playerLocalPos.set(0, 0);
    this.physics.targetPlayerLocalPos.set(0, 0);
    this.physics.speed = 0;
    this.physics.heading = 0;
    this.physics.turnSpeed = 0;
    this.physics.health = 100;
    this.distanceTraveled = 0;
    this.updateHpUI();
  }

  updateHpUI() {
    const hp = this.physics.health;
    if (this.hpValEl) this.hpValEl.textContent = `${hp}%`;
    if (this.hpFillEl) {
      this.hpFillEl.style.width = `${hp}%`;
      if (hp > 50) {
        this.hpFillEl.style.background = 'linear-gradient(90deg, #2ed573, #7bed9f)';
        if (this.hpValEl) this.hpValEl.style.color = '#2ed573';
      } else if (hp > 25) {
        this.hpFillEl.style.background = 'linear-gradient(90deg, #ffa502, #ffc048)';
        if (this.hpValEl) this.hpValEl.style.color = '#ffa502';
      } else {
        this.hpFillEl.style.background = 'linear-gradient(90deg, #ff4757, #ff6b81)';
        if (this.hpValEl) this.hpValEl.style.color = '#ff4757';
      }
    }
  }

  triggerDamageFeedback() {
    this.screenShake = 0.45;
    document.body.classList.add('damage-flash');
    setTimeout(() => {
      document.body.classList.remove('damage-flash');
    }, 400);
    this.updateHpUI();
  }

  gameOver() {
    this.gameState = 'GAMEOVER';
    
    const finalDist = Math.floor(this.distanceTraveled);
    if (finalDist > this.highScore) {
      this.highScore = finalDist;
      localStorage.setItem('lake_highscore', this.highScore.toString());
      if (this.highscoreEl) {
        this.highscoreEl.innerHTML = `${this.highScore} <small>m</small>`;
      }
    }

    const titleEl = this.modalScreen.querySelector('.modal-title');
    const subtitleEl = this.modalScreen.querySelector('.modal-subtitle');

    if (titleEl) titleEl.textContent = 'GAME OVER - PERAHU HANCUR!';
    if (subtitleEl) subtitleEl.textContent = `Perahu Anda hancur akibat benturan tebing. Jarak tempuh: ${finalDist} meter.`;
    if (this.btnStart) this.btnStart.textContent = 'Coba Lagi';

    this.modalScreen.classList.remove('hidden');
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = Math.min(this.clock.getDelta(), 0.1);

    if (this.gameState === 'PLAYING') {
      if (this.joystickActive && (this.joystickVector.x !== 0 || this.joystickVector.y !== 0)) {
        this.physics.applyJoystickVector(this.joystickVector.x, this.joystickVector.y, delta);
      } else {
        this.physics.updateInput(this.input, delta);
      }

      this.physics.updatePhysics(delta);
      this.waterSystem.update(delta);

      const pPos = this.physics.worldPosition;
      this.chunkManager.update(pPos.z);

      // Update Dynamic Day-Night Celestial Cycle
      this.dayNightCycle.update(pPos, delta);

      // Update Boat Compass Direction Badge
      if (this.compassEl) {
        const deg = Math.round(this.physics.heading * 180 / Math.PI);
        this.compassEl.textContent = `🧭 ${deg}°`;
      }

      // Check collisions with Lake Rock Obstacles (20% HP reduction & bounce feedback)
      if (this.rockManager) {
        this.rockManager.update(this.physics);
      }

      const collision = this.physics.check3DHullShoreCollision(this.chunkManager);
      if (collision.collided) {
        const hit = this.physics.handleCollision(collision.bounceDir);
        if (hit) {
          this.triggerDamageFeedback();
          if (this.physics.health <= 0) {
            this.gameOver();
          }
        }
      }

      this.distanceTraveled = Math.max(this.distanceTraveled, -pPos.z);
      const speedKmH = (Math.abs(this.physics.speed) * 3.6).toFixed(1);
      const isReverse = this.physics.speed < -0.15;

      if (this.distanceEl) this.distanceEl.innerHTML = `${Math.floor(this.distanceTraveled)} <small>m</small>`;
      if (this.speedEl) this.speedEl.innerHTML = `${isReverse ? '⏪ ' : ''}${speedKmH} <small>km/h</small>`;

      // Proximity Trigger check for player character on deck near lantern post (x=0, z=-3.0)
      const playerPosOnDeck = this.physics.playerLocalPos;
      const distToLantern = Math.hypot(playerPosOnDeck.x - 0, playerPosOnDeck.y - (-3.0));

      if (distToLantern <= 2.8) {
        if (this.btnLanternToggle) this.btnLanternToggle.classList.remove('hidden');
        if (this.woodenBoat.isLanternOn && this.lanternAimBar) {
          this.lanternAimBar.classList.remove('hidden');
        }
      } else {
        if (this.btnLanternToggle) this.btnLanternToggle.classList.add('hidden');
        if (this.lanternAimBar) this.lanternAimBar.classList.add('hidden');
      }

      // Zero-GC Camera Tracking (Farther POV: Vector3(0, 7.5, 15.0))
      this.tempCamOffset.set(0, 7.5, 15.0);
      this.tempCamOffset.applyAxisAngle(this.upAxis, this.physics.heading * 0.15);

      this.targetCamPos.copy(pPos).add(this.tempCamOffset);
      this.targetCamPos.x = THREE.MathUtils.clamp(this.targetCamPos.x, -14.0, 14.0);

      if (this.screenShake > 0) {
        this.targetCamPos.x += (Math.random() - 0.5) * this.screenShake;
        this.targetCamPos.y += (Math.random() - 0.5) * this.screenShake;
        this.screenShake = Math.max(0, this.screenShake - delta * 2.0);
      }

      this.camera.position.lerp(this.targetCamPos, 1.0 - Math.exp(-8.0 * delta));
      
      this.lookAtPos.set(0, 1.2, -5.0);
      this.lookAtPos.applyAxisAngle(this.upAxis, this.physics.heading * 0.15);
      this.lookAtPos.add(pPos);
      this.camera.lookAt(this.lookAtPos);
    }

    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new InfiniteLakeGame();
});

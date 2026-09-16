import * as THREE from 'three';

export class DayNightCycle {
  constructor(scene, sunLight, camera, waterMaterial = null) {
    this.scene = scene;
    this.sunLight = sunLight;
    this.camera = camera;
    this.waterMaterial = waterMaterial;

    // Time state (0.0 to 24.0 hours)
    // Start at 15.2 (Sore) so player quickly experiences Senja sunset transition into night and then morning
    this.timeOfDay = 15.2; 
    this.timeSpeed = 0.08; // Continuous dynamic cycle (~5 minutes per full 24h day/night)
    this.elapsedTime = 0;

    // Pre-allocate temporary Color objects for keyframe interpolation (Zero-GC)
    this.skyColorCurrent = new THREE.Color();
    this.fogColorCurrent = new THREE.Color();
    this.sunLightColorCurrent = new THREE.Color();
    this.sunMatColorCurrent = new THREE.Color();
    this.haloColorCurrent = new THREE.Color();
    this.glareColorCurrent = new THREE.Color();
    this.waterSunColorCurrent = new THREE.Color();

    this.initCelestialOrbs();
    this.initStarfield();
    this.initLowPolyClouds();
    this.initKeyframes();
  }

  initKeyframes() {
    // 100% Realistic Continuous 24-hour Life Cycle Keyframes
    this.keyframes = [
      { time: 0.0,  sky: 0x060c1c, fog: 0x060c1c, fogDensity: 0.007, light: 0x2c3e50, lightIntensity: 0.28, starOpacity: 0.95, sunMat: 0xff4500, halo: 0xaa1100, glareOpacity: 0.0,  sunScale: 0.5 },
      { time: 4.5,  sky: 0x0b1736, fog: 0x0b1736, fogDensity: 0.007, light: 0x3b4c68, lightIntensity: 0.32, starOpacity: 0.80, sunMat: 0xff5722, halo: 0xd97706, glareOpacity: 0.1,  sunScale: 0.6 },
      { time: 5.5,  sky: 0xf43f5e, fog: 0xe11d48, fogDensity: 0.006, light: 0xfde047, lightIntensity: 0.65, starOpacity: 0.00, sunMat: 0xffb703, halo: 0xf43f5e, glareOpacity: 0.3,  sunScale: 0.8 }, // Subuh / Dawn
      { time: 7.0,  sky: 0x38bdf8, fog: 0x38bdf8, fogDensity: 0.005, light: 0xfffbeb, lightIntensity: 1.35, starOpacity: 0.00, sunMat: 0xffffff, halo: 0xffea00, glareOpacity: 0.75, sunScale: 1.25 }, // Pagi
      { time: 12.0, sky: 0x60a5fa, fog: 0x60a5fa, fogDensity: 0.004, light: 0xffffff, lightIntensity: 1.70, starOpacity: 0.00, sunMat: 0xffffff, halo: 0xffd700, glareOpacity: 1.00, sunScale: 1.45 }, // Siang
      { time: 15.5, sky: 0x38bdf8, fog: 0x38bdf8, fogDensity: 0.005, light: 0xfef08a, lightIntensity: 1.35, starOpacity: 0.00, sunMat: 0xfffaed, halo: 0xffc107, glareOpacity: 0.80, sunScale: 1.25 }, // Sore Mula
      { time: 17.5, sky: 0xf97316, fog: 0xeb5e28, fogDensity: 0.006, light: 0xf97316, lightIntensity: 0.90, starOpacity: 0.00, sunMat: 0xff5722, halo: 0xff3d00, glareOpacity: 0.55, sunScale: 1.0 },  // Senja Sunset
      { time: 19.5, sky: 0x4c1d95, fog: 0x3b0764, fogDensity: 0.007, light: 0x8b5cf6, lightIntensity: 0.40, starOpacity: 0.00, sunMat: 0xd97706, halo: 0x991b1b, glareOpacity: 0.20, sunScale: 0.75 }, // Senja Ungu
      { time: 21.5, sky: 0x08132b, fog: 0x08132b, fogDensity: 0.007, light: 0x2c3e50, lightIntensity: 0.25, starOpacity: 0.85, sunMat: 0xff4500, halo: 0xaa1100, glareOpacity: 0.0,  sunScale: 0.5 },  // Malam Gelap
      { time: 24.0, sky: 0x060c1c, fog: 0x060c1c, fogDensity: 0.007, light: 0x2c3e50, lightIntensity: 0.28, starOpacity: 0.95, sunMat: 0xff4500, halo: 0xaa1100, glareOpacity: 0.0,  sunScale: 0.5 }
    ];

    // Pre-create THREE.Color objects for keyframes to prevent GC
    this.keyframes.forEach(k => {
      k.cSky = new THREE.Color(k.sky);
      k.cFog = new THREE.Color(k.fog);
      k.cLight = new THREE.Color(k.light);
      k.cSunMat = new THREE.Color(k.sunMat);
      k.cHalo = new THREE.Color(k.halo);
    });
  }

  initCelestialOrbs() {
    this.sunGroup = new THREE.Group();

    // 1. Pure Smooth Core Sun Sphere (64x64 Subdivisions)
    const sunGeo = new THREE.SphereGeometry(14.0, 64, 64);
    this.sunMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      fog: false
    });
    this.sunMesh = new THREE.Mesh(sunGeo, this.sunMat);
    this.sunGroup.add(this.sunMesh);

    // 2. Pure Borderless Soft Radial Glow Halo (Fits snugly around 14.0 radius sun orb)
    const haloGeo = new THREE.PlaneGeometry(36.0, 36.0);
    const haloCanvas = document.createElement('canvas');
    haloCanvas.width = 256;
    haloCanvas.height = 256;
    const hCtx = haloCanvas.getContext('2d');
    
    // Smooth Gaussian Radial Gradient fading 100% seamlessly to 0 opacity at border
    const grad = hCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0.00, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.30, 'rgba(255, 245, 200, 0.7)');
    grad.addColorStop(0.65, 'rgba(255, 180, 60, 0.25)');
    grad.addColorStop(0.90, 'rgba(255, 120, 20, 0.04)');
    grad.addColorStop(1.00, 'rgba(255, 90, 0, 0.00)');
    hCtx.fillStyle = grad;
    hCtx.fillRect(0, 0, 256, 256);

    const haloTexture = new THREE.CanvasTexture(haloCanvas);
    this.haloMat = new THREE.MeshBasicMaterial({
      map: haloTexture,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    });
    this.haloMesh = new THREE.Mesh(haloGeo, this.haloMat);
    this.sunGroup.add(this.haloMesh);

    this.scene.add(this.sunGroup);

    // 5. Borderless Pure White Moon Orb (Polos Bulat Putih Tanpa Border, Layaknya Matahari)
    const moonGeo = new THREE.SphereGeometry(10.0, 64, 64);
    this.moonMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.0,
      fog: false
    });
    this.moonMesh = new THREE.Mesh(moonGeo, this.moonMat);
    this.scene.add(this.moonMesh);
  }

  initStarfield() {
    this.starCount = 1400;
    this.starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(this.starCount * 3);

    for (let i = 0; i < this.starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      // Elevation from horizon (0.02 rad ~ 1 deg up to 0.70 rad ~ 40 deg up)
      const phi = 0.02 + Math.pow(Math.random(), 1.4) * 0.68;
      const radius = 280 + Math.random() * 80;

      starPositions[i * 3] = radius * Math.cos(phi) * Math.sin(theta);
      starPositions[i * 3 + 1] = radius * Math.sin(phi) + 12.0; // Visible sky height above horizon
      starPositions[i * 3 + 2] = -radius * Math.cos(phi) * Math.cos(theta);
    }

    this.starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));

    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.4, 'rgba(220, 240, 255, 0.8)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    const starTex = new THREE.CanvasTexture(canvas);

    this.starMat = new THREE.PointsMaterial({
      size: 1.2,
      map: starTex,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending
    });

    this.starPoints = new THREE.Points(this.starGeo, this.starMat);
    this.scene.add(this.starPoints);
  }

  initLowPolyClouds() {
    this.cloudGroup = new THREE.Group();
    this.clouds = [];

    this.cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      flatShading: true,
      transparent: true,
      opacity: 0.85
    });

    const cloudCount = 28;
    const puffGeo = new THREE.DodecahedronGeometry(1.0, 1);

    for (let i = 0; i < cloudCount; i++) {
      const cloud = new THREE.Group();
      const puffCount = 5 + Math.floor(Math.random() * 4);

      for (let p = 0; p < puffCount; p++) {
        const mesh = new THREE.Mesh(puffGeo, this.cloudMat);
        const radius = 2.4 + Math.random() * 3.5;
        mesh.scale.set(radius, radius * (0.6 + Math.random() * 0.4), radius * 1.2);
        mesh.position.set(
          (p - puffCount / 2) * 2.8 + (Math.random() - 0.5) * 1.5,
          (Math.random() - 0.5) * 1.2,
          (Math.random() - 0.5) * 2.5
        );
        mesh.castShadow = true;
        cloud.add(mesh);
      }

      const initialX = (Math.random() - 0.5) * 360;
      const initialY = 58 + Math.random() * 32;
      const initialZ = -220 + Math.random() * 260;

      cloud.position.set(initialX, initialY, initialZ);
      cloud.userData = { speed: 1.2 + Math.random() * 2.2, relZ: initialZ };
      this.cloudGroup.add(cloud);
      this.clouds.push(cloud);
    }

    this.scene.add(this.cloudGroup);
  }

  update(playerPos, delta) {
    this.elapsedTime += delta;

    // Advance Time of Day (0.0 to 24.0 hours)
    this.timeOfDay = (this.timeOfDay + this.timeSpeed * delta) % 24.0;

    // Daytime sun trajectory (Sunrise 05:15 to Sunset 19:15)
    // Map timeOfDay in [5.25, 19.25] to daytime angle [-PI/2, +PI/2]
    const dayProgress = (this.timeOfDay - 5.25) / 14.0; // 0 at dawn, 0.5 at noon, 1 at sunset
    const sunAngle = (dayProgress - 0.5) * Math.PI; // -PI/2 to +PI/2

    // Sun stays ALWAYS far down the lake channel (-Z axis, 420m away in distant horizon)
    const sunX = playerPos.x + Math.sin(sunAngle * 0.25) * 15.0;
    const sunY = Math.max(5.0, Math.cos(sunAngle) * 110.0 + 8.0);
    const sunZ = playerPos.z - 420.0;

    this.sunGroup.position.set(sunX, sunY, sunZ);
    this.sunLight.position.set(sunX, Math.max(15.0, sunY), sunZ);

    const horizonFade = THREE.MathUtils.clamp((sunY - 4.0) / 22.0, 0.0, 1.0);

    if (this.haloMesh) {
      this.haloMesh.lookAt(this.camera.position);
    }

    // Distant High Moon (Fixed position far in distant sky)
    const moonX = playerPos.x + 35.0;
    const moonY = 92.0;
    const moonZ = playerPos.z - 380.0;
    this.moonMesh.position.set(moonX, moonY, moonZ);

    // Synchronized Night Opacity & Fade-In/Fade-Out for BOTH Moon and Stars
    let nightOpacity = 0.0;
    if (this.timeOfDay >= 20.5 && this.timeOfDay < 21.5) {
      nightOpacity = (this.timeOfDay - 20.5) / 1.0; // Smooth fade in at nightfall
    } else if (this.timeOfDay >= 21.5 || this.timeOfDay <= 4.0) {
      nightOpacity = 1.0; // Glowing moon & twinkling stars in deep night
    } else if (this.timeOfDay > 4.0 && this.timeOfDay <= 5.0) {
      nightOpacity = 1.0 - (this.timeOfDay - 4.0) / 1.0; // Smooth fade out at dawn
    }
    nightOpacity = THREE.MathUtils.clamp(nightOpacity, 0.0, 1.0);

    const isNightActive = (nightOpacity > 0.001);

    // Moon & Stars appear together and fade in/out together
    this.moonMesh.visible = isNightActive;
    this.moonMat.opacity = nightOpacity;

    this.starPoints.position.copy(playerPos);
    this.starPoints.visible = isNightActive;
    this.starMat.opacity = nightOpacity * 0.95;

    // 100% Smooth Continuous Keyframe Interpolation
    let kPrev = this.keyframes[0];
    let kNext = this.keyframes[this.keyframes.length - 1];

    for (let i = 0; i < this.keyframes.length - 1; i++) {
      if (this.timeOfDay >= this.keyframes[i].time && this.timeOfDay <= this.keyframes[i + 1].time) {
        kPrev = this.keyframes[i];
        kNext = this.keyframes[i + 1];
        break;
      }
    }

    const duration = kNext.time - kPrev.time;
    const alpha = duration > 0 ? (this.timeOfDay - kPrev.time) / duration : 0;
    const t = alpha * alpha * (3 - 2 * alpha);

    this.skyColorCurrent.copy(kPrev.cSky).lerp(kNext.cSky, t);
    this.fogColorCurrent.copy(kPrev.cFog).lerp(kNext.cFog, t);
    this.sunLightColorCurrent.copy(kPrev.cLight).lerp(kNext.cLight, t);
    this.sunMatColorCurrent.copy(kPrev.cSunMat).lerp(kNext.cSunMat, t);
    this.haloColorCurrent.copy(kPrev.cHalo).lerp(kNext.cHalo, t);

    const fogDensity = THREE.MathUtils.lerp(kPrev.fogDensity, kNext.fogDensity, t);
    const lightIntensity = THREE.MathUtils.lerp(kPrev.lightIntensity, kNext.lightIntensity, t) * horizonFade;
    const glareOpacity = THREE.MathUtils.lerp(kPrev.glareOpacity, kNext.glareOpacity, t) * horizonFade;
    const sunScale = THREE.MathUtils.lerp(kPrev.sunScale, kNext.sunScale, t);

    // Strict Celestial Visibility Control
    const isDaytime = (this.timeOfDay >= 5.25 && this.timeOfDay <= 19.25);
    this.sunGroup.visible = isDaytime;

    // Apply values to Three.js elements
    this.scene.background.copy(this.skyColorCurrent);
    if (this.scene.fog) {
      this.scene.fog.color.copy(this.fogColorCurrent);
      this.scene.fog.density = fogDensity;
    }

    this.sunLight.color.copy(this.sunLightColorCurrent);
    this.sunLight.intensity = lightIntensity;

    this.sunMat.color.copy(this.sunMatColorCurrent);
    this.sunMat.transparent = true;
    this.sunMat.opacity = horizonFade;

    this.haloMat.color.copy(this.haloColorCurrent);
    this.haloMat.opacity = Math.min(0.95, glareOpacity * 0.85);

    this.sunGroup.scale.setScalar(sunScale);

    // Update Low-Poly Drift Clouds
    if (this.clouds) {
      for (const cloud of this.clouds) {
        cloud.position.x += cloud.userData.speed * delta;
        cloud.position.z = playerPos.z + cloud.userData.relZ;

        if (cloud.position.x > playerPos.x + 180) {
          cloud.position.x = playerPos.x - 180;
        }
      }

      if (this.cloudMat) {
        if (this.timeOfDay >= 6.0 && this.timeOfDay < 16.0) {
          this.cloudMat.color.setHex(0xffffff); // Daytime crisp white
        } else if (this.timeOfDay >= 16.0 && this.timeOfDay < 19.2) {
          this.cloudMat.color.setHex(0xfb923c); // Sunset warm golden orange
        } else {
          this.cloudMat.color.setHex(0x334155); // Nighttime slate
        }
      }
    }

    // Update Water Material Specular Light Uniforms dynamically
    if (this.waterMaterial && this.waterMaterial.uniforms) {
      if (this.waterMaterial.uniforms.uSunColor) {
        this.waterMaterial.uniforms.uSunColor.value.copy(this.sunLightColorCurrent);
      }
      if (this.waterMaterial.uniforms.uSunDirection) {
        this.waterMaterial.uniforms.uSunDirection.value.set(sunX - playerPos.x, sunY, sunZ - playerPos.z).normalize();
      }
    }
  }

  getTimeFormatted() {
    const hours = Math.floor(this.timeOfDay);
    const mins = Math.floor((this.timeOfDay % 1) * 60);
    const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;

    if (this.timeOfDay >= 6.0 && this.timeOfDay < 11.0) return `🌅 ${timeStr}`;
    if (this.timeOfDay >= 11.0 && this.timeOfDay < 16.0) return `☀️ ${timeStr}`;
    if (this.timeOfDay >= 16.0 && this.timeOfDay < 19.2) return `🌇 ${timeStr}`;
    return `🌙 ${timeStr}`;
  }
}

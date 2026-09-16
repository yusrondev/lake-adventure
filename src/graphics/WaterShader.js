import * as THREE from 'three';

export class WaterSystem {
  constructor(scene) {
    this.scene = scene;
    this.time = 0;
    
    const normalMap = this.generateWaterNormalMap();

    // Advanced Water Shader with Smooth World-Space Waves and Seamless Color Gradient
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uNormalMap: { value: normalMap },
        uDeepColor: { value: new THREE.Color(0x04243a) },    // Deep crystal lake blue
        uShallowColor: { value: new THREE.Color(0x1382a3) }, // Clear turquoise
        uFoamColor: { value: new THREE.Color(0xe8f8ff) },    // Soft white foam
        uSunColor: { value: new THREE.Color(0xfffaea) },
        uSunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.5).normalize() },
        uSpotLightPos: { value: new THREE.Vector3(0, 2.0, -3.0) },
        uSpotLightDir: { value: new THREE.Vector3(0, -0.3, -1.0).normalize() },
        uSpotLightColor: { value: new THREE.Color(0xffb84d) },
        uSpotLightIntensity: { value: 0.0 },
        uSpotLightAngle: { value: Math.PI / 3.0 }
      },
      vertexShader: `
        uniform float uTime;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec2 vUv;
        varying float vWaveHeight;

        void main() {
          vUv = uv;
          vec3 pos = position;

          // Compute world position before displacement
          vec4 initialWorldPos = modelMatrix * vec4(pos, 1.0);
          float wx = initialWorldPos.x;
          float wz = initialWorldPos.z;
          float t = uTime * 0.8;

          // World-space seamless wave formula
          float wave1 = sin(wx * 0.14 + wz * 0.22 - t * 1.4) * 0.14;
          float wave2 = cos(wx * 0.22 - wz * 0.16 + t * 1.1) * 0.09;
          float wave3 = sin(wz * 0.38 - t * 1.8) * 0.05;

          float totalWave = wave1 + wave2 + wave3;

          // In PlaneGeometry with rotation.x = -PI/2, local Z points UP in world space
          pos.z += totalWave;

          vec4 finalWorldPos = modelMatrix * vec4(pos, 1.0);
          vWorldPosition = finalWorldPos.xyz;
          vWaveHeight = totalWave;
          vNormal = normalize(mat3(modelMatrix) * normal);
          
          gl_Position = projectionMatrix * viewMatrix * finalWorldPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform sampler2D uNormalMap;
        uniform vec3 uDeepColor;
        uniform vec3 uShallowColor;
        uniform vec3 uFoamColor;
        uniform vec3 uSunColor;
        uniform vec3 uSunDirection;

        uniform vec3 uSpotLightPos;
        uniform vec3 uSpotLightDir;
        uniform vec3 uSpotLightColor;
        uniform float uSpotLightIntensity;
        uniform float uSpotLightAngle;
        
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec2 vUv;
        varying float vWaveHeight;

        void main() {
          // Continuous world-space UV texture scrolling
          vec2 uv1 = vWorldPosition.xz * 0.04 + vec2(uTime * 0.015, uTime * 0.01);
          vec2 uv2 = vWorldPosition.xz * 0.07 - vec2(uTime * 0.01, uTime * 0.018);

          vec3 normal1 = texture2D(uNormalMap, uv1).rgb * 2.0 - 1.0;
          vec3 normal2 = texture2D(uNormalMap, uv2).rgb * 2.0 - 1.0;
          vec3 blendedNormal = normalize(normal1 + normal2);

          vec3 worldNormal = normalize(vNormal + blendedNormal * 0.08);
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);

          // Fresnel Factor (glassy reflections at glancing angles)
          float fresnel = pow(1.0 - max(0.0, dot(viewDir, worldNormal)), 3.0);
          fresnel = clamp(fresnel, 0.2, 0.85);

          // Rich crystal blue water gradient
          vec3 baseWater = mix(uDeepColor, uShallowColor, fresnel * 0.65);

          // Gentle wave crest sparkle
          float crestFoam = smoothstep(0.18, 0.26, vWaveHeight) * 0.15;
          vec3 waterCol = mix(baseWater, uFoamColor, crestFoam);

          // Soft Specular Sun Glint (No checkerboard artifacts)
          vec3 halfVector = normalize(uSunDirection + viewDir);
          float NdotH = max(0.0, dot(worldNormal, halfVector));
          float specular = pow(NdotH, 48.0) * 0.35;

          // Sky Glow
          vec3 skyGlow = vec3(0.45, 0.70, 0.90);
          vec3 finalColor = mix(waterCol, skyGlow, fresnel * 0.35) + uSunColor * specular;

          // Dynamic Searchlight Headlight Projection on Lake Water (Soft Warm Amber Glow, No Whiteout)
          if (uSpotLightIntensity > 0.01) {
            vec3 lightToSurf = vWorldPosition - uSpotLightPos;
            float dist = length(lightToSurf);
            vec3 lDir = normalize(-lightToSurf);
            
            float cosAngle = dot(lDir, normalize(-uSpotLightDir));
            float cosCutoff = cos(uSpotLightAngle);
            
            if (cosAngle > cosCutoff && dist < 65.0) {
              float coneAtten = smoothstep(cosCutoff, cosCutoff + 0.16, cosAngle);
              float normDist = clamp(dist / 65.0, 0.0, 1.0);
              float distAtten = pow(1.0 - normDist, 2.2); // Soft quadratic falloff
              
              vec3 spotHalfVec = normalize(lDir + viewDir);
              float spotNdotH = max(0.0, dot(worldNormal, spotHalfVec));
              float spotSpec = pow(spotNdotH, 30.0) * 0.45; // Soft wave glint
              
              float lightFactor = coneAtten * distAtten * uSpotLightIntensity;
              vec3 warmGlow = uSpotLightColor * (0.35 + spotSpec);
              finalColor = mix(finalColor, finalColor + warmGlow, clamp(lightFactor, 0.0, 0.50));
            }
          }

          gl_FragColor = vec4(finalColor, 0.94);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide
    });
  }

  generateWaterNormalMap() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    const imgData = ctx.createImageData(256, 256);
    const data = imgData.data;

    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        // Multi-frequency organic wave normal generation
        const waveA = Math.sin(x * 0.08 + y * 0.06);
        const waveB = Math.cos(x * 0.05 - y * 0.09);
        const waveC = Math.sin((x + y) * 0.04);
        
        const nx = (waveA + waveC) * 0.25 + 0.5;
        const ny = (waveB - waveC) * 0.25 + 0.5;
        const index = (y * 256 + x) * 4;

        data[index] = Math.floor(nx * 255);
        data[index + 1] = Math.floor(ny * 255);
        data[index + 2] = 255;
        data[index + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  // Exact match with vertex shader world coordinates for realistic buoyancy
  getWaveHeight(x, z) {
    const t = this.time * 0.8;
    const wave1 = Math.sin(x * 0.14 + z * 0.22 - t * 1.4) * 0.14;
    const wave2 = Math.cos(x * 0.22 - z * 0.16 + t * 1.1) * 0.09;
    const wave3 = Math.sin(z * 0.38 - t * 1.8) * 0.05;
    return wave1 + wave2 + wave3;
  }

  update(delta) {
    this.time += delta;
    this.material.uniforms.uTime.value = this.time;
  }
}

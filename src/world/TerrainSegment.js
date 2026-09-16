import * as THREE from 'three';

export class TerrainSegment {
  constructor(scene, waterMaterial, zOffset, length = 80, width = 70, channelWidth = 40) {
    this.scene = scene;
    this.waterMaterial = waterMaterial;
    this.zOffset = zOffset;
    this.length = length;
    this.width = width;
    this.channelWidth = channelWidth;

    this.group = new THREE.Group();
    this.group.position.z = zOffset;

    this.buildSegment();
  }

  buildSegment() {
    // Stylized Low-Poly Faceted Materials (flatShading: true)
    const lowPolyGrassMat = new THREE.MeshStandardMaterial({
      color: 0x2e7d32,
      roughness: 0.85,
      flatShading: true
    });

    const lowPolyRockMat = new THREE.MeshStandardMaterial({
      color: 0x546e7a,
      roughness: 0.9,
      flatShading: true
    });

    const lowPolyEarthMat = new THREE.MeshStandardMaterial({
      color: 0x4e342e,
      roughness: 0.95,
      flatShading: true
    });

    const lowPolyTrunkMat = new THREE.MeshStandardMaterial({
      color: 0x3e2723,
      roughness: 0.9,
      flatShading: true
    });

    const lowPolyPineMat1 = new THREE.MeshStandardMaterial({
      color: 0x1b5e20,
      roughness: 0.7,
      flatShading: true
    });

    const lowPolyPineMat2 = new THREE.MeshStandardMaterial({
      color: 0x2e7d32,
      roughness: 0.7,
      flatShading: true
    });

    // 1. Water Plane (Smooth 32x32 resolution)
    const waterGeo = new THREE.PlaneGeometry(this.channelWidth + 8, this.length, 32, 32);
    const waterMesh = new THREE.Mesh(waterGeo, this.waterMaterial);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.y = 0;
    waterMesh.receiveShadow = true;
    this.group.add(waterMesh);

    // 2. Stylized Low-Poly Mountainous Cliffs (Left & Right Banks)
    const cliffBouldersCount = 14;

    for (let i = 0; i < cliffBouldersCount; i++) {
      const zPos = -this.length / 2 + (i / (cliffBouldersCount - 1)) * this.length;

      // Left Bank Low-Poly Mountain Boulders
      const leftRadius = 6.0 + Math.random() * 4.0;
      const leftCliffGeo = new THREE.IcosahedronGeometry(leftRadius, 1);
      const leftCliff = new THREE.Mesh(leftCliffGeo, (i % 2 === 0 ? lowPolyGrassMat : lowPolyRockMat));
      
      const leftX = -(this.channelWidth / 2 + 8 + Math.random() * 4);
      leftCliff.position.set(leftX, 2.5 + Math.random() * 2.0, zPos);
      leftCliff.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, Math.random() * 0.5);
      leftCliff.castShadow = true;
      leftCliff.receiveShadow = true;
      this.group.add(leftCliff);

      // Right Bank Low-Poly Mountain Boulders
      const rightRadius = 6.0 + Math.random() * 4.0;
      const rightCliffGeo = new THREE.IcosahedronGeometry(rightRadius, 1);
      const rightCliff = new THREE.Mesh(rightCliffGeo, (i % 2 === 1 ? lowPolyGrassMat : lowPolyEarthMat));

      const rightX = (this.channelWidth / 2 + 8 + Math.random() * 4);
      rightCliff.position.set(rightX, 2.5 + Math.random() * 2.0, zPos);
      rightCliff.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, Math.random() * 0.5);
      rightCliff.castShadow = true;
      rightCliff.receiveShadow = true;
      this.group.add(rightCliff);
    }

    // 3. Low-Poly Shoreline Rocks
    const rockCount = 8;
    for (let i = 0; i < rockCount; i++) {
      const isLeft = Math.random() > 0.5;
      const rockSize = 1.2 + Math.random() * 2.0;
      const rockGeo = new THREE.DodecahedronGeometry(rockSize, 1);
      const rock = new THREE.Mesh(rockGeo, lowPolyRockMat);
      
      const rockX = isLeft ? -(this.channelWidth / 2 + 1.2) : (this.channelWidth / 2 + 1.2);
      const zPos = (Math.random() - 0.5) * (this.length * 0.9);
      
      rock.position.set(rockX, 0.6, zPos);
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.group.add(rock);
    }

    // 4. Pure Procedural Low-Poly Pine Trees (Faceted 3-Tier Pine Cones)
    const treeCount = 12;
    for (let i = 0; i < treeCount; i++) {
      const isLeft = Math.random() > 0.5;
      const xSide = isLeft ? -(this.channelWidth / 2 + 6 + Math.random() * 9) : (this.channelWidth / 2 + 6 + Math.random() * 9);
      const zPos = (Math.random() - 0.5) * (this.length * 0.9);

      const treeGroup = new THREE.Group();

      // Faceted Trunk
      const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 3.5, 5);
      const trunk = new THREE.Mesh(trunkGeo, lowPolyTrunkMat);
      trunk.position.y = 1.75;
      trunk.castShadow = true;
      treeGroup.add(trunk);

      // Tier 1 (Bottom Foliage Cone)
      const pineMat = Math.random() > 0.5 ? lowPolyPineMat1 : lowPolyPineMat2;
      const tier1 = new THREE.Mesh(new THREE.ConeGeometry(2.5, 3.8, 5), pineMat);
      tier1.position.y = 4.2;
      tier1.castShadow = true;
      treeGroup.add(tier1);

      // Tier 2 (Middle Foliage Cone)
      const tier2 = new THREE.Mesh(new THREE.ConeGeometry(1.9, 3.2, 5), pineMat);
      tier2.position.y = 6.0;
      tier2.castShadow = true;
      treeGroup.add(tier2);

      // Tier 3 (Top Foliage Cone)
      const tier3 = new THREE.Mesh(new THREE.ConeGeometry(1.3, 2.6, 5), pineMat);
      tier3.position.y = 7.6;
      tier3.castShadow = true;
      treeGroup.add(tier3);

      // Scale & Rotation Variations
      const scaleVar = 0.8 + Math.random() * 0.45;
      treeGroup.scale.set(scaleVar, scaleVar, scaleVar);
      treeGroup.rotation.y = Math.random() * Math.PI * 2;
      treeGroup.position.set(xSide, 5.5, zPos);

      this.group.add(treeGroup);
    }

    this.scene.add(this.group);
  }

  destroy() {
    this.scene.remove(this.group);
    this.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
    });
  }
}

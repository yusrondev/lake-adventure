import { TerrainSegment } from './TerrainSegment.js';

export class ChunkManager {
  constructor(scene, waterMaterial, rockManager = null) {
    this.scene = scene;
    this.waterMaterial = waterMaterial;
    this.rockManager = rockManager;

    this.segmentLength = 80;
    this.visibleSegmentsAhead = 4;
    this.segmentsBehind = 2;
    this.channelWidth = 40;

    this.activeSegments = new Map();
    this.currentChunkIndex = 0;
  }

  setRockManager(rockManager) {
    this.rockManager = rockManager;
  }

  update(playerZ) {
    const playerSegmentIndex = Math.floor(-playerZ / this.segmentLength);

    const minIndex = playerSegmentIndex - this.segmentsBehind;
    const maxIndex = playerSegmentIndex + this.visibleSegmentsAhead;

    // 1. Spawn new chunks ahead
    for (let idx = minIndex; idx <= maxIndex; idx++) {
      if (!this.activeSegments.has(idx)) {
        const zPos = -idx * this.segmentLength;
        const segment = new TerrainSegment(
          this.scene,
          this.waterMaterial,
          zPos,
          this.segmentLength,
          70,
          this.channelWidth
        );
        this.activeSegments.set(idx, segment);

        if (this.rockManager) {
          this.rockManager.onSegmentCreated(idx, zPos, this.segmentLength);
        }
      }
    }

    // 2. Despawn old chunks behind
    for (const [idx, segment] of this.activeSegments.entries()) {
      if (idx < minIndex || idx > maxIndex) {
        segment.destroy();
        this.activeSegments.delete(idx);

        if (this.rockManager) {
          this.rockManager.onSegmentDestroyed(idx);
        }
      }
    }
  }

  checkBankCollision(playerX) {
    const safeLimit = 16.5;
    if (playerX < -safeLimit) {
      return { collided: true, bounceDir: 1, penetration: -safeLimit - playerX };
    }
    if (playerX > safeLimit) {
      return { collided: true, bounceDir: -1, penetration: playerX - safeLimit };
    }
    return { collided: false, bounceDir: 0, penetration: 0 };
  }
}

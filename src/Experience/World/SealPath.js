import * as THREE from "three";
import Experience from "../Experience";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "./LineMaterial.js";
import { Path } from "../brahma/Brahma.js";
import Papa from "papaparse";

export default class SealPath {
  constructor() {
    this.experience = new Experience();
    this.name = "penguin_combined";

    this.loadPenguinData();
  }

  async loadPenguinData() {
    const chunkCount = 16; // Load all 16 pg_chunk files
    console.log(`Loading ${chunkCount} penguin data chunks...`);

    try {
      // Load all chunks in parallel for better performance
      const chunkPromises = [];
      for (let i = 1; i <= chunkCount; i++) {
        chunkPromises.push(this.loadChunk(i));
      }

      const chunks = await Promise.all(chunkPromises);

      // Combine all data from chunks
      let allData = [];
      chunks.forEach((chunk, index) => {
        if (chunk && chunk.length > 0) {
          allData.push(...chunk);
          console.log(`Chunk ${index + 1}: ${chunk.length} rows`);
        }
      });

      console.log(`Total data points loaded: ${allData.length}`);

      // Filter valid lat/lon points
      const points = [];
      const latitudes = [];
      const longitudes = [];
      const depths = [];

      allData.forEach((entry) => {
        const lat = entry.Lat1Hz;
        const lon = entry.Lon1Hz;
        const depth = entry.depth || 0;

        // Check if lat/lon are valid
        if (isFinite(lat) && isFinite(lon) && lat !== null && lon !== null) {
          // Use topobath projection to convert lat/lon/depth to 3D coordinates
          const [x, y, z] = this.experience.world.topobath.projection(
            lat,
            lon,
            depth
          );

          points.push(new THREE.Vector3(x, y, z));
          latitudes.push(lat);
          longitudes.push(lon);
          depths.push(depth);
        }
      });

      console.log(`Valid points: ${points.length}`);

      if (points.length === 0) {
        console.warn("No valid points to plot");
        return;
      }

      // Store data
      this.points = points;
      this.latitudes = latitudes;
      this.longitudes = longitudes;
      this.depths = depths;

      // Build line geometry
      const positions = [];
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        positions.push(p.x, p.y, p.z);
      }

      const geometry = new LineGeometry();
      geometry.setPositions(positions);

      // Create material with a distinctive color for penguin
      const material = new LineMaterial({
        color: 0xff6b35, // Orange color for penguin
        linewidth: 4,
        dashed: false,
      });

      this.material = material;

      // Set initial resolution
      this.updateResolution();

      // Add resize listener
      this.resizeHandler = () => this.updateResolution();
      window.addEventListener("resize", this.resizeHandler);

      // Create and add path to scene
      this.path = new Path(geometry, material, this.name);
      this.path.sealPath = this;
      this.experience.world.scene.add(this.path);

      console.log("Penguin path created and added to scene");

    } catch (error) {
      console.error("Error loading penguin data:", error);
    }
  }

  updateResolution() {
    if (!this.material) return;

    const renderer = this.experience.renderer;
    const canvas = renderer?.domElement;

    if (canvas) {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      this.material.resolution.set(width, height);
    } else {
      this.material.resolution.set(window.innerWidth, window.innerHeight);
    }
  }

  findNearestPoint(position) {
    if (!this.points || this.points.length === 0) {
      return null;
    }

    let minDistance = Infinity;
    let nearestIndex = 0;

    for (let i = 0; i < this.points.length; i++) {
      const distSq = position.distanceToSquared(this.points[i]);
      if (distSq < minDistance) {
        minDistance = distSq;
        nearestIndex = i;
        if (distSq < 0.0001) break;
      }
    }

    return {
      index: nearestIndex,
      position: this.points[nearestIndex],
      lat: this.latitudes[nearestIndex],
      lng: this.longitudes[nearestIndex],
      depth: this.depths[nearestIndex],
    };
  }

  async loadChunk(chunkNum) {
    try {
      const filename = `./pg_chunk_${chunkNum}.csv`;
      const response = await fetch(filename);

      if (!response.ok) {
        console.warn(`Failed to load ${filename}: ${response.status}`);
        return [];
      }

      const csvText = await response.text();
      const parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
      });

      return parsed.data;
    } catch (error) {
      console.error(`Error loading chunk ${chunkNum}:`, error);
      return [];
    }
  }

  dispose() {
    if (this.resizeHandler) {
      window.removeEventListener("resize", this.resizeHandler);
    }

    if (this.path) {
      if (this.path.geometry) this.path.geometry.dispose();
      if (this.material) this.material.dispose();
      if (this.path.parent) this.path.parent.remove(this.path);
    }
  }
}

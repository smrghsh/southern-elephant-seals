import * as THREE from "three";
import Experience from "../Experience.js";
import Papa from "papaparse";

export default class ProxemicsVizualizer {
  constructor() {
    this.experience = new Experience();
    this.scene = this.experience.scene;
    this.geometry = new THREE.SphereGeometry(0.05, 16, 16);
    this.material = new THREE.MeshBasicMaterial({ color: 0xff0000 });

    // Load the interlocutor tracking CSV
    this.loadInterlocutorData();
  }

  async loadInterlocutorData() {
    const data = await this.csvToJson("./interlocutor_tracking_01-08-2026.csv");
    var slice = data.slice(0, 30000);
    console.log(slice);

    // Use InstancedMesh for better performance
    const count = slice.length;
    this.instancedMesh = new THREE.InstancedMesh(
      this.geometry,
      this.material,
      count
    );

    // Set matrix for each instance
    slice.forEach((entry, index) => {
      const mat4 = new THREE.Matrix4();
      mat4.set(
        entry.HMD_m0,
        entry.HMD_m4,
        entry.HMD_m8,
        entry.HMD_m12,
        entry.HMD_m1,
        entry.HMD_m5,
        entry.HMD_m9,
        entry.HMD_m13,
        entry.HMD_m2,
        entry.HMD_m6,
        entry.HMD_m10,
        entry.HMD_m14,
        entry.HMD_m3,
        entry.HMD_m7,
        entry.HMD_m11,
        entry.HMD_m15
      );
      this.instancedMesh.setMatrixAt(index, mat4);
    });

    // Important: update the instance matrix
    this.instancedMesh.instanceMatrix.needsUpdate = true;

    this.scene.add(this.instancedMesh);
  }

  async csvToJson(filename) {
    const response = await fetch(filename);
    const csvText = await response.text();
    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    });
    return parsed.data;
  }
}

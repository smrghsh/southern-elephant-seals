import * as THREE from "three";
import Experience from "../Experience";

export default class SeaLevelPlane {
  constructor() {
    this.experience = new Experience();
    this.scene = this.experience.scene;
    this.debug = this.experience.debug;
    this.debugFolder = this.debug.ui.addFolder("Sea Level Marker");
    this.geometry = new THREE.PlaneGeometry(0.8, 1.3, 100, 100);
    this.material = new THREE.MeshBasicMaterial({
      color: 0x0077b6,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    this.plane = new THREE.Mesh(this.geometry, this.material);
    this.plane.rotation.x = -Math.PI / 2;
    this.plane.position.y = 0.001;
    this.plane.position.x = -2;
    this.plane.scale.x = 50;
    this.plane.scale.y = 50;

    this.material2 = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      wireframe: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
    });
    // second plane with same as first
    this.plane2 = new THREE.Mesh(this.geometry, this.material2);
    this.plane2.rotation.x = -Math.PI / 2;

    this.plane2.position.y = 0.002;
    this.plane2.position.x = -2;
    this.plane2.scale.x = 50;
    this.plane2.scale.y = 50;

    this.seaLevelPlaneGroup = new THREE.Group();
    this.seaLevelPlaneGroup.add(this.plane);
    this.seaLevelPlaneGroup.add(this.plane2);
    this.scene.add(this.seaLevelPlaneGroup);
    // this.scene.add(this.plane);
    // this.plane.visible = false;
    this.debugFolder.add(this.seaLevelPlaneGroup, "visible");
  }
}

import * as THREE from "three";
import Experience from "../Experience";

export default class Legend {
  constructor() {
    this.experience = new Experience();
    this.scene = this.experience.scene;

    this.setupLegend();
  }

  setupLegend() {
    // Define legend items with colors and descriptions
    const legendItems = this.experience.legendItems;

    // Create canvas texture for the legend
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 300;

    const ctx = canvas.getContext("2d");

    // Draw background
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw border
    ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
    ctx.lineWidth = 2;
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

    // Draw title
    ctx.fillStyle = "#333";
    ctx.font = "bold 40px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Legend", canvas.width / 2, 45);

    // Draw legend items
    const boxSize = 25;
    const startY = 80;
    const rowHeight = 45;
    const boxX = 30;
    const textX = boxX + boxSize + 20;

    legendItems.forEach((item, index) => {
      const y = startY + index * rowHeight;

      // Draw colored box
      ctx.fillStyle = item.color;
      ctx.fillRect(boxX, y, boxSize, boxSize);

      // Draw box border
      ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
      ctx.lineWidth = 1;
      ctx.strokeRect(boxX, y, boxSize, boxSize);

      // Draw label text
      ctx.fillStyle = "#333";
      ctx.font = "30px Arial";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(item.label, textX, y + boxSize / 2);
    });

    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;

    // Create plane geometry and material
    const geometry = new THREE.PlaneGeometry(2, 1);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
    });

    // Create mesh and add to scene
    this.plane = new THREE.Mesh(geometry, material);
    this.plane.position.set(20, 3, -11);
    this.plane.scale.set(2, 2, 2);
    this.plane.rotation.y = -90 * (Math.PI / 180);
    this.scene.add(this.plane);
  }
}

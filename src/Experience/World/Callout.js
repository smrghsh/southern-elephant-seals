import * as THREE from "three";
import Experience from "../Experience";

export default class Callout extends THREE.Group {
  constructor() {
    super();
    this.experience = new Experience();
    this.scene = this.experience.scene;

    this.debug = this.experience.debug;

    this.debugFolder = this.debug.ui.addFolder("Callout");

    // Parameterized dimensions
    this.stemHeight = 0.18;
    this.displayWidth = 0.28; // Compact 3-column layout
    this.displayHeight = 0.12; // Compact height

    // Data properties with defaults
    this.lat = 0;
    this.lng = 0;
    this.depth = 0;
    this.resp = 0;
    this.seconds = 0;
    this.sleep = 0;
    this.stroke = 0;
    this.heading = 0;
    this.pitch = 0;
    this.roll = 0;
    this.rTime = "";

    // Add rTime display controller
    this.debugFolder.add(this, "rTime").name("Current Time").listen();
    // Add rTime display controller
    this.debugFolder.add(this, "copyTime").name("Copy Time to Clipboard");
    // Navigation tracking
    this.currentSealPath = null;
    this.currentPointIndex = 0;

    // Clone the seal model for orientation representation
    this.orientationRepresentation =
      this.experience.resources.items.sealModel.scene;
    this.orientationRepresentation.scale.set(0.05, 0.05, 0.05); // Smaller scale for marker
    this.add(this.orientationRepresentation);

    // Enhanced glass stem with taper (thinner at top, slightly thicker at bottom)
    const stemGeometry = new THREE.CylinderGeometry(
      0.0015, // Top radius - thinner
      0.003, // Bottom radius - slightly thicker
      this.stemHeight,
      8 // Optimized segment count
    );

    // VR-optimized glass material (MeshBasicMaterial instead of MeshPhysicalMaterial)
    const stemMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });

    this.stem = new THREE.Mesh(stemGeometry, stemMaterial);
    this.stem.position.y = this.stemHeight / 2;
    this.add(this.stem);

    // Add subtle outer glow cylinder for rim lighting effect
    const glowGeometry = new THREE.CylinderGeometry(
      0.002,
      0.0035,
      this.stemHeight,
      8
    );
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide,
    });
    const glowStem = new THREE.Mesh(glowGeometry, glowMaterial);
    glowStem.position.y = this.stemHeight / 2;
    this.add(glowStem);

    // Create canvas once and reuse it (performance optimization)
    this.canvas = document.createElement("canvas");
    this.canvas.width = 800;
    this.canvas.height = 180;
    this.ctx = this.canvas.getContext("2d", {
      alpha: true,
      willReadFrequently: true,
    });

    // Draw initial glass background
    this.drawGlassBackground();

    const texture = new THREE.CanvasTexture(this.canvas);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthTest: false, // Prevent clipping through geometry
      depthWrite: false, // Don't write to depth buffer
    });
    this.informationDisplay = new THREE.Mesh(
      new THREE.PlaneGeometry(this.displayWidth, this.displayHeight),
      material
    );

    // Set high render order to ensure it renders on top
    this.informationDisplay.renderOrder = 999;

    // Position bottom edge of display at top of stem
    this.informationDisplay.position.y =
      this.stemHeight + this.displayHeight / 2;
    this.add(this.informationDisplay);

    this.scene.add(this);

    // Initially hide callout until clicked
    this.visible = false;
  }
  updateInformationDisplay(
    lat,
    lng,
    depth,
    resp,
    seconds,
    rTime,
    sleep,
    stroke,
    heartRate,
    heading,
    pitch,
    roll
  ) {
    // Store parameters as instance properties
    this.lat = lat;
    this.lng = lng;
    this.depth = depth;
    this.resp = resp;
    this.seconds = seconds;
    this.rTime = rTime;
    this.sleep = sleep;
    this.stroke = stroke;
    this.heartRate = heartRate;
    this.heading = heading;
    this.pitch = pitch;
    this.roll = roll;

    // callout sleep text
    // Active Waking,1
    // Quiet Waking,2
    // Drowsiness, 3
    // LV Slow Wave Sleep,4
    // HV Slow Wave Sleep,5
    // REM,6
    // REM,7

    // Update orientation seal to match heading, pitch, roll
    this.orientationRepresentation.rotation.set(0, Math.PI, 0);
    this.orientationRepresentation.rotateY(-1 * this.heading); // Heading third (yaw)
    this.orientationRepresentation.rotateX(-1 * this.pitch); // Pitch second
    this.orientationRepresentation.rotateZ(this.roll); // Roll first

    // Reuse existing canvas and context
    const canvas = this.canvas;
    const ctx = this.ctx;

    // Clear and redraw background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.drawGlassBackground();

    // Reset shadow for text rendering
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;

    // Convert radians to degrees
    const headingDeg = this.heading * (180 / Math.PI);
    const pitchDeg = this.pitch * (180 / Math.PI);
    const rollDeg = this.roll * (180 / Math.PI);

    // Map sleep state number to label
    const sleepStates = {
      1: "Active Waking",
      2: "Quiet Waking",
      3: "Drowsiness",
      4: "LV Slow Wave Sleep",
      5: "HV Slow Wave Sleep",
      6: "REM",
      7: "REM",
    };
    const sleepLabel = sleepStates[this.sleep] || `State ${this.sleep}`;

    // Use system font stack for best rendering
    ctx.font =
      "600 18px -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

    // Add subtle text shadow for better readability on glass
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;

    // Use slightly darker white for better contrast
    ctx.fillStyle = "#f5f5f7";

    const centerX = canvas.width / 2;
    const col1X = 180;
    const col2X = 480;
    const lineHeight = 32;

    // Top center: Time (R_Time)
    ctx.textAlign = "center";
    let y = 35;
    ctx.fillText(`Time: ${this.rTime || "N/A"}`, centerX, y);

    // Below that: Depth
    ctx.fillText(
      `Depth: ${this.depth.toFixed(2)} m`,
      centerX,
      (y += lineHeight)
    );

    // Two columns below
    ctx.textAlign = "left";
    y += lineHeight + 5; // Add a bit of spacing before columns

    // Left column: Heading, Pitch, Roll
    let leftY = y;
    ctx.fillText(`Heading: ${headingDeg.toFixed(2)}°`, col1X, leftY);
    ctx.fillText(
      `Pitch: ${pitchDeg.toFixed(2)}°`,
      col1X,
      (leftY += lineHeight)
    );
    ctx.fillText(`Roll: ${rollDeg.toFixed(2)}°`, col1X, (leftY += lineHeight));

    // Right column: Heart Rate, Sleep, Stroke
    let rightY = y;
    ctx.fillText(`Heart Rate: ${this.heartRate.toFixed(1)} bpm`, col2X, rightY);
    ctx.fillText(`Sleep: ${sleepLabel}`, col2X, (rightY += lineHeight));
    ctx.fillText(
      `Stroke: ${this.stroke.toFixed(2)} spm`,
      col2X,
      (rightY += lineHeight)
    );

    // Update existing texture instead of creating new one
    this.informationDisplay.material.map.needsUpdate = true;
  }

  // Helper method to draw glass background (cached for performance)
  drawGlassBackground() {
    const ctx = this.ctx;
    const canvas = this.canvas;
    const radius = 20;

    ctx.beginPath();
    ctx.roundRect(0, 0, canvas.width, canvas.height, radius);
    ctx.fillStyle = "rgba(128, 128, 128, 0.6)";
    ctx.fill();

    // Add glass border effect
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Add subtle inner shadow for depth
    ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;
  }

  // Navigate to next point in the seal path
  advancePoint() {
    if (!this.currentSealPath || !this.currentSealPath.points) return;

    this.currentPointIndex++;
    if (this.currentPointIndex >= this.currentSealPath.points.length) {
      this.currentPointIndex = this.currentSealPath.points.length - 1;
      return; // At end
    }

    this.updateFromPointIndex();
  }

  // Navigate to previous point in the seal path
  decrementPoint() {
    if (!this.currentSealPath || !this.currentSealPath.points) return;

    this.currentPointIndex--;
    if (this.currentPointIndex < 0) {
      this.currentPointIndex = 0;
      return; // At start
    }

    this.updateFromPointIndex();
  }

  // Update callout from current point index
  updateFromPointIndex() {
    if (!this.currentSealPath) return;

    const idx = this.currentPointIndex;
    const sealPath = this.currentSealPath;

    // Update position
    this.position.copy(sealPath.points[idx]);

    // Update data display
    this.updateInformationDisplay(
      sealPath.latitudes[idx],
      sealPath.longitudes[idx],
      sealPath.depths[idx],
      sealPath.respiratory[idx],
      sealPath.secondsArray[idx],
      sealPath.rTimeArray[idx],
      sealPath.sleepStates[idx],
      sealPath.strokeRates[idx],
      sealPath.heartRates[idx],
      sealPath.orientation[idx].x,
      sealPath.orientation[idx].y,
      sealPath.orientation[idx].z
    );

    // Update graphs asynchronously
    if (this.experience.world.graphs) {
      setTimeout(() => {
        this.experience.world.graphs.updateGraphs(sealPath, idx);
      }, 0);
    }

    // Send callout update to server if networking is available
    if (this.experience.networking) {
      this.experience.networking.sendCalloutUpdate(
        true,
        this.position,
        sealPath.name,
        idx
      );
    }
  }

  // Set the seal path and point index for navigation
  setSealPath(sealPath, pointIndex) {
    this.currentSealPath = sealPath;
    this.currentPointIndex = pointIndex;
  }

  copyTime() {
    // copy rTime to clipboard
    navigator.clipboard.writeText(this.rTime).then(() => {
      console.log("rTime copied to clipboard:", this.rTime);
    });
  }
}

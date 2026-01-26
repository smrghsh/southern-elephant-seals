import * as THREE from "three";
import Experience from "../Experience.js";

export default class Graphs extends THREE.Group {
  constructor() {
    super();
    this.experience = new Experience();
    this.scene = this.experience.scene;

    // Graph dimensions
    this.graphWidth = 6;
    this.graphHeight = 3;
    this.spacing = 0.6;

    // Position to the right of legend (legend is at x:20, z:-11)
    this.position.set(20, 10, -5);
    this.rotation.y = -90 * (Math.PI / 180);

    // Get HTML canvas elements
    this.htmlCanvases = [
      document.getElementById("graph-depth"),
      document.getElementById("graph-heartrate"),
      document.getElementById("graph-stroke"),
    ];

    this.setupGraphs();
    this.scene.add(this);
  }

  setupGraphs() {
    // Create three graph planes
    this.graphs = [];

    for (let i = 0; i < 3; i++) {
      const canvas = this.createGraphCanvas(i);
      const texture = new THREE.CanvasTexture(canvas);
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearFilter;

      const geometry = new THREE.PlaneGeometry(
        this.graphWidth,
        this.graphHeight
      );
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
      });

      const plane = new THREE.Mesh(geometry, material);

      // Stack graphs vertically
      plane.position.y = -i * (this.graphHeight + this.spacing);

      this.graphs.push({
        plane: plane,
        canvas: canvas,
        texture: texture,
        ctx: canvas.getContext("2d"),
      });

      this.add(plane);
    }
  }

  createGraphCanvas(index) {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 600;

    const ctx = canvas.getContext("2d");

    // Draw background
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw border
    ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
    ctx.lineWidth = 3;
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

    // Graph-specific titles and configurations
    const graphConfigs = [
      {
        title: "Depth (Next 1000 Points)",
        yLabel: "Depth (m)",
        yMin: 0,
        yMax: 500,
        yStep: 100,
        color: "#2563eb",
        reverseY: true,
      },
      {
        title: "Heart Rate (Next 1000 Points)",
        yLabel: "HR (bpm)",
        yMin: 0,
        yMax: 120,
        yStep: 20,
        color: "#dc2626",
      },
      {
        title: "Stroke Rate (Next 1000 Points)",
        yLabel: "Stroke (spm)",
        yMin: 0,
        yMax: 60,
        yStep: 10,
        color: "#16a34a",
      },
    ];

    const config = graphConfigs[index];

    // Draw title
    ctx.fillStyle = "#333";
    ctx.font = "bold 36px Arial";
    ctx.textAlign = "center";
    ctx.fillText(config.title, canvas.width / 2, 45);

    // Define plot area
    const plotLeft = 100;
    const plotRight = canvas.width - 50;
    const plotTop = 90;
    const plotBottom = canvas.height - 80;
    const plotWidth = plotRight - plotLeft;
    const plotHeight = plotBottom - plotTop;

    // Draw axes
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(plotLeft, plotTop);
    ctx.lineTo(plotLeft, plotBottom);
    ctx.lineTo(plotRight, plotBottom);
    ctx.stroke();

    // Y-axis labels
    ctx.fillStyle = "#333";
    ctx.font = "20px Arial";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    const yRange = config.yMax - config.yMin;
    const numYTicks = yRange / config.yStep;

    for (let i = 0; i <= numYTicks; i++) {
      const value = config.yMin + i * config.yStep;
      const y = plotBottom - (i / numYTicks) * plotHeight;

      // Draw tick mark
      ctx.beginPath();
      ctx.moveTo(plotLeft - 5, y);
      ctx.lineTo(plotLeft, y);
      ctx.stroke();

      // Draw label
      ctx.fillText(value.toString(), plotLeft - 10, y);

      // Draw grid line
      ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plotLeft, y);
      ctx.lineTo(plotRight, y);
      ctx.stroke();
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 2;
    }

    // X-axis labels (0 to 1000 points)
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    for (let i = 0; i <= 4; i++) {
      const value = i * 250; // 0, 250, 500, 750, 1000
      const x = plotLeft + (i / 4) * plotWidth;

      // Draw tick mark
      ctx.beginPath();
      ctx.moveTo(x, plotBottom);
      ctx.lineTo(x, plotBottom + 5);
      ctx.stroke();

      // Draw label
      ctx.fillText(value.toString(), x, plotBottom + 10);
    }

    // Y-axis label
    ctx.save();
    ctx.translate(30, canvas.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    ctx.fillText(config.yLabel, 0, 0);
    ctx.restore();

    // X-axis label
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Point Index", canvas.width / 2, canvas.height - 20);

    return canvas;
  }

  updateGraphs(sealPath, startIndex) {
    if (!sealPath || startIndex === undefined) return;

    // Update each graph with next 1000 points
    this.graphs.forEach((graph, graphIndex) => {
      this.redrawGraph(graph, graphIndex, sealPath, startIndex);

      // Also update the HTML canvas
      if (this.htmlCanvases[graphIndex]) {
        this.redrawHTMLGraph(
          this.htmlCanvases[graphIndex],
          graphIndex,
          sealPath,
          startIndex
        );
      }
    });
  }

  redrawGraph(graph, graphIndex, sealPath, startIndex) {
    const canvas = graph.canvas;
    const ctx = graph.ctx;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Redraw base graph (background, axes, labels)
    this.drawGraphBase(ctx, canvas, graphIndex);

    // Define plot area (must match createGraphCanvas)
    const plotLeft = 100;
    const plotRight = canvas.width - 50;
    const plotTop = 90;
    const plotBottom = canvas.height - 80;
    const plotWidth = plotRight - plotLeft;
    const plotHeight = plotBottom - plotTop;

    // Get data arrays based on graph type
    let dataArray, yMin, yMax, color, reverseY;
    if (graphIndex === 0) {
      dataArray = sealPath.depths;
      yMin = 0;
      yMax = 500;
      color = "#2563eb";
      reverseY = true;
    } else if (graphIndex === 1) {
      dataArray = sealPath.heartRates;
      yMin = 0;
      yMax = 120;
      color = "#dc2626";
      reverseY = false;
    } else {
      dataArray = sealPath.strokeRates;
      yMin = 0;
      yMax = 60;
      color = "#16a34a";
      reverseY = false;
    }

    // Extract next 1000 points (or fewer if at end)
    const endIndex = Math.min(startIndex + 1000, dataArray.length);
    const numPoints = endIndex - startIndex;

    if (numPoints < 2) return; // Need at least 2 points to draw

    // Draw line graph
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < numPoints; i++) {
      const dataIndex = startIndex + i;
      const value = dataArray[dataIndex];

      // Skip if invalid value
      if (value === undefined || value === null || isNaN(value)) continue;

      // Calculate position
      const x = plotLeft + (i / 999) * plotWidth; // Use 999 for 1000 points (0-999)
      let normalizedValue = (value - yMin) / (yMax - yMin);
      if (reverseY) normalizedValue = 1 - normalizedValue; // Reverse for depth
      const y = plotBottom - normalizedValue * plotHeight;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();

    // Mark current position (first point) with a circle
    if (numPoints > 0) {
      const value = dataArray[startIndex];
      if (value !== undefined && value !== null && !isNaN(value)) {
        let normalizedValue = (value - yMin) / (yMax - yMin);
        if (reverseY) normalizedValue = 1 - normalizedValue; // Reverse for depth
        const y = plotBottom - normalizedValue * plotHeight;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(plotLeft, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Update texture
    graph.texture.needsUpdate = true;
  }

  drawGraphBase(ctx, canvas, graphIndex) {
    // Draw background
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw border
    ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
    ctx.lineWidth = 3;
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

    // Graph-specific titles and configurations
    const graphConfigs = [
      {
        title: "Depth (Next 1000 Points)",
        yLabel: "Depth (m)",
        yMin: 0,
        yMax: 500,
        yStep: 100,
        reverseY: true,
      },
      {
        title: "Heart Rate (Next 1000 Points)",
        yLabel: "HR (bpm)",
        yMin: 0,
        yMax: 120,
        yStep: 20,
      },
      {
        title: "Stroke Rate (Next 1000 Points)",
        yLabel: "Stroke (spm)",
        yMin: 0,
        yMax: 60,
        yStep: 10,
      },
    ];

    const config = graphConfigs[graphIndex];

    // Draw title
    ctx.fillStyle = "#333";
    ctx.font = "bold 36px Arial";
    ctx.textAlign = "center";
    ctx.fillText(config.title, canvas.width / 2, 45);

    // Define plot area
    const plotLeft = 100;
    const plotRight = canvas.width - 50;
    const plotTop = 90;
    const plotBottom = canvas.height - 80;
    const plotWidth = plotRight - plotLeft;
    const plotHeight = plotBottom - plotTop;

    // Draw axes
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(plotLeft, plotTop);
    ctx.lineTo(plotLeft, plotBottom);
    ctx.lineTo(plotRight, plotBottom);
    ctx.stroke();

    // Y-axis labels
    ctx.fillStyle = "#333";
    ctx.font = "20px Arial";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    const yRange = config.yMax - config.yMin;
    const numYTicks = yRange / config.yStep;

    for (let i = 0; i <= numYTicks; i++) {
      const value = config.reverseY
        ? config.yMax - i * config.yStep
        : config.yMin + i * config.yStep;
      const y = plotBottom - (i / numYTicks) * plotHeight;

      // Draw tick mark
      ctx.beginPath();
      ctx.moveTo(plotLeft - 5, y);
      ctx.lineTo(plotLeft, y);
      ctx.stroke();

      // Draw label
      ctx.fillText(value.toString(), plotLeft - 10, y);

      // Draw grid line
      ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plotLeft, y);
      ctx.lineTo(plotRight, y);
      ctx.stroke();
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 2;
    }

    // X-axis labels (0 to 1000 points)
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    for (let i = 0; i <= 4; i++) {
      const value = i * 250; // 0, 250, 500, 750, 1000
      const x = plotLeft + (i / 4) * plotWidth;

      // Draw tick mark
      ctx.beginPath();
      ctx.moveTo(x, plotBottom);
      ctx.lineTo(x, plotBottom + 5);
      ctx.stroke();

      // Draw label
      ctx.fillText(value.toString(), x, plotBottom + 10);
    }

    // Y-axis label
    ctx.save();
    ctx.translate(30, canvas.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    ctx.fillText(config.yLabel, 0, 0);
    ctx.restore();

    // X-axis label
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Point Index", canvas.width / 2, canvas.height - 20);
  }

  redrawHTMLGraph(htmlCanvas, graphIndex, sealPath, startIndex) {
    if (!htmlCanvas) return;

    const ctx = htmlCanvas.getContext("2d");
    const canvas = htmlCanvas;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw base graph with smaller dimensions
    this.drawHTMLGraphBase(ctx, canvas, graphIndex);

    // Define plot area (scaled down for HTML canvas)
    const plotLeft = 50;
    const plotRight = canvas.width - 20;
    const plotTop = 40;
    const plotBottom = canvas.height - 40;
    const plotWidth = plotRight - plotLeft;
    const plotHeight = plotBottom - plotTop;

    // Get data arrays based on graph type
    let dataArray, yMin, yMax, color, reverseY;
    if (graphIndex === 0) {
      dataArray = sealPath.depths;
      yMin = 0;
      yMax = 500;
      color = "#2563eb";
      reverseY = true;
    } else if (graphIndex === 1) {
      dataArray = sealPath.heartRates;
      yMin = 0;
      yMax = 120;
      color = "#dc2626";
      reverseY = false;
    } else {
      dataArray = sealPath.strokeRates;
      yMin = 0;
      yMax = 60;
      color = "#16a34a";
      reverseY = false;
    }

    // Extract next 1000 points (or fewer if at end)
    const endIndex = Math.min(startIndex + 1000, dataArray.length);
    const numPoints = endIndex - startIndex;

    if (numPoints < 2) return;

    // Draw line graph
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let i = 0; i < numPoints; i++) {
      const dataIndex = startIndex + i;
      const value = dataArray[dataIndex];

      if (value === undefined || value === null || isNaN(value)) continue;

      const x = plotLeft + (i / 999) * plotWidth;
      let normalizedValue = (value - yMin) / (yMax - yMin);
      if (reverseY) normalizedValue = 1 - normalizedValue; // Reverse for depth
      const y = plotBottom - normalizedValue * plotHeight;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();

    // Mark current position with a circle
    if (numPoints > 0) {
      const value = dataArray[startIndex];
      if (value !== undefined && value !== null && !isNaN(value)) {
        let normalizedValue = (value - yMin) / (yMax - yMin);
        if (reverseY) normalizedValue = 1 - normalizedValue; // Reverse for depth
        const y = plotBottom - normalizedValue * plotHeight;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(plotLeft, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawHTMLGraphBase(ctx, canvas, graphIndex) {
    // Draw background
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Graph-specific titles and configurations
    const graphConfigs = [
      {
        title: "Depth",
        yLabel: "m",
        yMin: 0,
        yMax: 500,
        yStep: 100,
        reverseY: true,
      },
      {
        title: "Heart Rate",
        yLabel: "bpm",
        yMin: 0,
        yMax: 120,
        yStep: 60,
      },
      {
        title: "Stroke Rate",
        yLabel: "spm",
        yMin: 0,
        yMax: 60,
        yStep: 30,
      },
    ];

    const config = graphConfigs[graphIndex];

    // Draw title
    ctx.fillStyle = "#333";
    ctx.font = "bold 8px Arial";
    ctx.textAlign = "left";
    ctx.fillText(config.title, 5, 10);

    // Define plot area
    const plotLeft = 28;
    const plotRight = canvas.width - 8;
    const plotTop = 18;
    const plotBottom = canvas.height - 15;
    const plotWidth = plotRight - plotLeft;
    const plotHeight = plotBottom - plotTop;

    // Draw axes
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(plotLeft, plotTop);
    ctx.lineTo(plotLeft, plotBottom);
    ctx.lineTo(plotRight, plotBottom);
    ctx.stroke();

    // Y-axis labels
    ctx.fillStyle = "#333";
    ctx.font = "6px Arial";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    const yRange = config.yMax - config.yMin;
    const numYTicks = yRange / config.yStep;

    for (let i = 0; i <= numYTicks; i++) {
      const value = config.reverseY
        ? config.yMax - i * config.yStep
        : config.yMin + i * config.yStep;
      const y = plotBottom - (i / numYTicks) * plotHeight;

      // Draw tick mark
      ctx.beginPath();
      ctx.moveTo(plotLeft - 2, y);
      ctx.lineTo(plotLeft, y);
      ctx.stroke();

      // Draw label
      ctx.fillText(value.toString(), plotLeft - 3, y);

      // Draw grid line
      ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(plotLeft, y);
      ctx.lineTo(plotRight, y);
      ctx.stroke();
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 0.8;
    }

    // X-axis labels
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = "5px Arial";

    for (let i = 0; i <= 2; i++) {
      const value = i * 500; // 0, 500, 1000
      const x = plotLeft + (i / 2) * plotWidth;

      // Draw tick mark
      ctx.beginPath();
      ctx.moveTo(x, plotBottom);
      ctx.lineTo(x, plotBottom + 2);
      ctx.stroke();

      // Draw label
      ctx.fillText(value.toString(), x, plotBottom + 3);
    }

    // Y-axis label
    ctx.font = "bold 6px Arial";
    ctx.textAlign = "right";
    ctx.fillText(config.yLabel, plotLeft - 3, 13);
  }
}

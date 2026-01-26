import * as THREE from "three";
import * as tilebelt from "@mapbox/tilebelt";
import Experience from "../Experience";
import bathyVertexShader from "../../shaders/bathy/vertex.glsl";
import bathyFragmentShader from "../../shaders/bathy/fragment.glsl";

export default class Topobath {
  constructor() {
    this.experience = new Experience();
    this.scene = this.experience.scene;

    this.zoom = 8;
    this.heightScalar = 0.0012;
    this.XZScalar = 50;
    this.initialTileX = 82;
    this.initialTileY = 159;

    this.ready = this.loadBathy();
  }
  async loadBathy() {
    // console.log("loading bathy (tiled)…");

    const tilesNoaa = [];
    const tilesCog = [];
    const promises = [];
    let i = 0;

    const loadImage = (url) =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });

    for (let x = this.initialTileX; x <= this.initialTileX + 14; x++) {
      let j = 0;
      tilesNoaa[i] = [];
      tilesCog[i] = [];
      for (let y = this.initialTileY; y <= this.initialTileY + 12; y++) {
        const ii = i;
        const jj = j;

        const urlNoaa = `./tiles/noaa_penguin/NOAA-${x}-${y}.png`;
        const urlCog = `./tiles/cog_penguin/Cogserver-${x}-${y}.png`;

        // console.log("loading tiles:", urlNoaa, urlCog);

        const p1 = loadImage(urlNoaa).then((img) => {
          tilesNoaa[ii][jj] = img;
        });
        const p2 = loadImage(urlCog).then((img) => {
          tilesCog[ii][jj] = img;
        });

        promises.push(p1, p2);
        j++;
      }
      i++;
    }

    await Promise.all(promises);
    console.log("all tiles loaded");

    const numCols = tilesNoaa.length;
    const numRows = tilesNoaa[0].length;

    // NOAA sizes
    const tileWidthNoaa = tilesNoaa[0][0].width;
    const tileHeightNoaa = tilesNoaa[0][0].height;
    const totalWidthNoaa = numCols * tileWidthNoaa;
    const totalHeightNoaa = numRows * tileHeightNoaa;

    // COG sizes (can be different)
    const tileWidthCog = tilesCog[0][0].width;
    const tileHeightCog = tilesCog[0][0].height;
    const totalWidthCog = numCols * tileWidthCog;
    const totalHeightCog = numRows * tileHeightCog;

    console.log("NOAA total:", totalWidthNoaa, totalHeightNoaa);
    console.log("COG  total:", totalWidthCog, totalHeightCog);

    // --- canvas 1: NOAA, native NOAA size ---
    const canvasNoaa = document.createElement("canvas");
    canvasNoaa.width = totalWidthNoaa;
    canvasNoaa.height = totalHeightNoaa;
    const ctxNoaa = canvasNoaa.getContext("2d");

    // --- canvas 2: COG, native COG size ---
    const canvasCog = document.createElement("canvas");
    canvasCog.width = totalWidthCog;
    canvasCog.height = totalHeightCog;
    const ctxCog = canvasCog.getContext("2d");

    for (let col = 0; col < numCols; col++) {
      for (let row = 0; row < numRows; row++) {
        // NOAA: laid out on NOAA grid
        ctxNoaa.drawImage(
          tilesNoaa[col][row],
          col * tileWidthNoaa,
          row * tileHeightNoaa
        );

        // COG: laid out on COG grid
        ctxCog.drawImage(
          tilesCog[col][row],
          col * tileWidthCog,
          row * tileHeightCog
        );
      }
    }

    const textureNoaa = new THREE.CanvasTexture(canvasNoaa);
    const textureCog = new THREE.CanvasTexture(canvasCog);
    textureNoaa.needsUpdate = true;
    textureCog.needsUpdate = true;

    // Plane geometry based on ONE dataset’s world size.
    // Here: use NOAA to define geometry/world footprint.
    const planeWorldWidth = totalWidthNoaa / this.XZScalar;
    const planeWorldHeight = totalHeightNoaa / this.XZScalar;

    const geometry = new THREE.PlaneGeometry(
      planeWorldWidth,
      planeWorldHeight,
      numCols * 8,
      numRows * 8
    );

    // ShaderMaterial using height (COG) and color (NOAA)
    const material = new THREE.ShaderMaterial({
      vertexShader: bathyVertexShader,
      fragmentShader: bathyFragmentShader,
      uniforms: {
        uTexture: { value: textureCog }, // height for displacement
        uTexture2: { value: textureNoaa }, // color for fragment
        uHeightScalar: { value: this.heightScalar },
      },
      // side: THREE.DoubleSide,
    });

    this.plane = new THREE.Mesh(geometry, material);
    this.plane.rotation.x = -Math.PI / 2;
    this.plane.position.y = 0;
    this.scene.add(this.plane);

    // keep references around if you want runtime switching
    this.textureNoaa = textureNoaa;
    this.textureCog = textureCog;
  }
  projection(lat, lng, depth) {
    // Standard Web Mercator tile size (matches your loaded tiles)
    const tileSize = 512;

    // Calculate pixel position in the full Web Mercator space at zoom 11
    const scale = Math.pow(2, this.zoom);
    const worldCoordX = ((lng + 180) / 360) * scale;
    const worldCoordY =
      ((1 -
        Math.log(
          Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)
        ) /
        Math.PI) /
        2) *
      scale;

    // Convert tile coordinates to pixels
    const pixelX = worldCoordX * tileSize;
    const pixelY = worldCoordY * tileSize;

    // Calculate the origin (top-left corner) of our tile grid in pixel space
    const originTileX = this.initialTileX - 3; // 327
    const originTileY = this.initialTileY - 3; // 796
    const originPixelX = originTileX * tileSize;
    const originPixelY = originTileY * tileSize;

    // Get position relative to our tile grid origin
    const relativePixelX = pixelX - originPixelX;
    const relativePixelY = pixelY - originPixelY;

    // Convert to world units using the same /60 scaling factor from loadBathy
    const x = relativePixelX / this.XZScalar;
    const z = relativePixelY / this.XZScalar;

    // Calculate plane dimensions (same as in loadBathy)
    // numCols = 5, numRows = 7, tileSize = 512
    const planeWidth = (5 * 512) / this.XZScalar; // 42.67
    const planeHeight = (7 * 512) / this.XZScalar; // 59.73

    // Center the coordinates (plane is centered at origin)
    const centeredX = x - planeWidth / 2;
    const centeredZ = z - planeHeight / 2;

    // Calculate Y from depth
    const y = -1 * this.heightScalar * depth;

    return [centeredX, y, centeredZ];
  }

  // Convert world Y position back to depth in meters
  worldYToDepth(worldY) {
    // Reverse the calculation: y = -1 * this.heightScalar * depth
    // Therefore: depth = -worldY / this.heightScalar
    return -worldY / this.heightScalar;
  }

  scaling() {
    console.log("scaling");
  }
}

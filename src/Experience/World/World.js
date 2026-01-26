import * as THREE from "three";
import { Environment, Floor, Stars } from "../brahma/Brahma.js";
import Experience from "../Experience.js";
import Topobath from "./Topobath.js";
import SealPath from "./SealPath.js";
import SeaLevelPlane from "./SeaLevelPlane.js";
import Sky from "./Sky.js";
import { Selectable } from "../brahma/Brahma.js";
import Papa from "papaparse";
import Legend from "./Legend.js";
import Graphs from "./Graphs.js";
import Callout from "./Callout.js";

export default class World {
  constructor() {
    this.experience = new Experience();
    this.sizes = this.experience.sizes;
    this.scene = this.experience.scene;
    this.resources = this.experience.resources;
    this.debug = this.experience.debug;
    this.debugFolder = this.debug.ui.addFolder("world");
    this.ready = false;
    // this.axesHelper = new THREE.AxesHelper(5);
    // this.scene.add(this.axesHelper);
    // this.floor = new Floor();
    // this.depthMarker = new DepthMarker();
    // Wait for resources

    this.resources.on("ready", () => {
      // this.stars = new Stars();
      this.topobath = new Topobath();
      this.topobath.ready.then(() => {
        console.log("topobath promise resolved");
        this.loadSealPaths();
      });
      this.environment = new Environment();
      this.seaLevelPlane = new SeaLevelPlane();
      this.skyBox = new Sky();
      this.legend = new Legend();
      this.graphs = new Graphs();
      this.callout = new Callout();
      this.callout.updateInformationDisplay(
        0,
        0,
        0,
        0,
        0,
        "",
        0,
        0,
        0,
        2,
        1,
        1
      );
    });
    this.ready = true;
  }
  loadSealPaths() {
    // Load penguin data only (simplified SealPath for pg_chunk_1.csv)
    this.penguin = [];
    this.sealPaths = [];

    const penguinPath = new SealPath();
    this.penguin.push(penguinPath);
    this.sealPaths.push(penguinPath);

    console.log("Loaded penguin path");
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

  update() {
    if (this.ready) {
      // this.depthReference?.update();
    }
  }
}

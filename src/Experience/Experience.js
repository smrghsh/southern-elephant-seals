import * as THREE from "three";
import {
  Debug,
  Sizes,
  Time,
  Resources,
  Camera,
  Renderer,
  Networking,
  User,
  Controller,
} from "./brahma/Brahma.js";
import EventEmitter from "./brahma/utilities/EventEmitter.js";
import Pointer from "./Utils/Pointer.js";
import World from "./World/World.js";
import sources from "./sources.js";
import { VRButton } from "three/examples/jsm/webxr/VRButton.js";

let instance = null;

export default class Experience extends EventEmitter {
  constructor(canvas) {
    super();

    // Singleton pattern
    if (instance) {
      return instance;
    }
    instance = this;
    window.experience = this;

    this.canvas = canvas;
    this.debug = new Debug();
    this.user = new User();
    /* Selectable Objects */
    this.selectableObjects = [];

    /**
     * Visualization Constants
     */
    this.sleepStateColors = [
      new THREE.Color(0x0000ff), //0 invalid
      new THREE.Color(84 / 255, 97 / 255, 169 / 255), // 1
      new THREE.Color(81 / 255, 140 / 255, 200 / 255), // 2
      new THREE.Color(146 / 255, 195 / 255, 103 / 255), //3
      new THREE.Color(90 / 255, 185 / 255, 182 / 255), // 4
      new THREE.Color(246 / 255, 202 / 255, 113 / 255), // 5
    ];
    this.legendItems = [
      // { color: "#0000ff", label: "Invalid Data" },
      { color: "#5461A9", label: "Active Waking" },
      { color: "#518CC8", label: "Quiet Waking" },
      { color: "#92C367", label: "Light SWS" },
      { color: "#5AB9B6", label: "Deep SWS" },
      { color: "#F6CA71", label: "REM" },
    ];

    /*
      Pointer Section
    */
    this.pointer = new Pointer();

    const sizes = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    window.addEventListener("mousemove", (event) => {
      if (!this.camera) return; // Wait for camera to be initialized
      const mouse = new THREE.Vector2();
      mouse.x = (event.clientX / sizes.width) * 2 - 1;
      mouse.y = -(event.clientY / sizes.height) * 2 + 1;
      this.pointer.setSource("camera", { camera: this.camera.instance, mouse });
    });

    window.addEventListener("click", () => {
      this.pointer.select();
    });

    // Arrow key navigation for callout (similar to joystick scrubbing)
    this.arrowKeyLastScrubTime = 0;
    this.arrowKeyScrubDelay = 100; // Same throttle delay as joystick (100ms)

    window.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        const now = Date.now();
        if (now - this.arrowKeyLastScrubTime > this.arrowKeyScrubDelay) {
          if (event.key === "ArrowRight") {
            this.world?.callout?.advancePoint();
          } else if (event.key === "ArrowLeft") {
            this.world?.callout?.decrementPoint();
          }
          this.arrowKeyLastScrubTime = now;
        }
      }
    });

    if (this.debug.active) {
      // this.debugFolder = this.debug.ui.addFolder("experience");
      this.debug.ui
        .add(
          {
            initNetworking: () => {
              window.experience.networking = new Networking();

              // hides Join Session after it's clicked
              this.debug.ui.domElement.style.display = "none";
            },
          },
          "initNetworking"
        )
        .name("Join Session");
      // add a button that does     this.networking = new Networking();
    }

    this.sizes = new Sizes();
    this.time = new Time();
    this.scene = new THREE.Scene();
    // console.log("sources", sources);
    this.resources = new Resources(sources);
    this.world = new World();
    this.cameraGroup = new THREE.Group();

    this.camera = new Camera();
    this.renderer = new Renderer();

    // if (this.debug.active) {
    //   this.setCameraDebug();
    // }

    // Initialize pointer with camera source now that camera exists
    const initialMouse = new THREE.Vector2(0, 0);
    this.pointer.setSource("camera", {
      camera: this.camera.instance,
      mouse: initialMouse,
    });
    console.log("Pointer initialized with camera source");

    /** XR/Immersive Code */
    this.scene.add(this.cameraGroup);
    this.controller = new Controller();
    this.renderer.instance.xr.enabled = true;
    document.body.appendChild(VRButton.createButton(this.renderer.instance));
    // samir believes this gets hit when we're in XR
    this.renderer.instance.setAnimationLoop(() => {
      this.controller.update();
      if (this.networking?.canSendEmbodiment) {
        this.networking.sendEmbodiment(
          this.camera.instance.matrixWorld,
          this.controller.controller1.matrixWorld,
          this.controller.controller2.matrixWorld
        );
      }

      this.renderer.instance.render(this.scene, this.camera.instance);
    });

    this.sizes.on("resize", () => {
      this.resize();
      this.camera.resize();
      this.renderer.resize();
    });
    this.time.on("tick", () => {
      this.update();
    });

    // this.setupLoginPanel();
  }

  // setCameraDebug() {
  //   this.cameraDebugPosition = new THREE.Vector3();
  //   this.cameraDebugDirection = new THREE.Vector3();
  //   this.cameraDebugData = {
  //     positionX: 0,
  //     positionY: 0,
  //     positionZ: 0,
  //     directionX: 0,
  //     directionY: 0,
  //     directionZ: 0,
  //   };

  //   this.cameraDebugFolder = this.debug.ui.addFolder("Camera");
  //   this.cameraDebugFolder
  //     .add(this.cameraDebugData, "positionX")
  //     .name("Position X")
  //     .listen();
  //   this.cameraDebugFolder
  //     .add(this.cameraDebugData, "positionY")
  //     .name("Position Y")
  //     .listen();
  //   this.cameraDebugFolder
  //     .add(this.cameraDebugData, "positionZ")
  //     .name("Position Z")
  //     .listen();
  //   this.cameraDebugFolder
  //     .add(this.cameraDebugData, "directionX")
  //     .name("Direction X")
  //     .listen();
  //   this.cameraDebugFolder
  //     .add(this.cameraDebugData, "directionY")
  //     .name("Direction Y")
  //     .listen();
  //   this.cameraDebugFolder
  //     .add(this.cameraDebugData, "directionZ")
  //     .name("Direction Z")
  //     .listen();

  //   this.updateCameraDebug();
  // }

  // updateCameraDebug() {
  //   this.camera.instance.getWorldPosition(this.cameraDebugPosition);
  //   this.camera.instance.getWorldDirection(this.cameraDebugDirection);

  //   this.cameraDebugData.positionX = Number(
  //     this.cameraDebugPosition.x.toFixed(3)
  //   );
  //   this.cameraDebugData.positionY = Number(
  //     this.cameraDebugPosition.y.toFixed(3)
  //   );
  //   this.cameraDebugData.positionZ = Number(
  //     this.cameraDebugPosition.z.toFixed(3)
  //   );
  //   this.cameraDebugData.directionX = Number(
  //     this.cameraDebugDirection.x.toFixed(3)
  //   );
  //   this.cameraDebugData.directionY = Number(
  //     this.cameraDebugDirection.y.toFixed(3)
  //   );
  //   this.cameraDebugData.directionZ = Number(
  //     this.cameraDebugDirection.z.toFixed(3)
  //   );
  // }

  resize() {
    console.log("resized occured");
    this.camera.resize();
  }

  update() {
    this.camera.update();
    if (!this.isXRActive()) {
      // this is executed when out of XR i.e. desktop
      this.cameraGroup.updateMatrixWorld();
      this.camera.instance.updateMatrixWorld();
      this.pointer.hover();
    } else {
      console.log("im in headset");
    }

    // if (this.debug.active) {
    //   this.updateCameraDebug();
    // }

    this.world.update();
  }
  isXRActive() {
    return this.renderer.instance.xr.isPresenting;
  }
  destroy() {
    this.sizes.off("resize");
    this.time.off("tick");

    this.scene.traverse((child) => {
      // Test if it's a mesh
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        // Loop through the material properties
        for (const key in child.material) {
          const value = child.material[key];

          // Test if there is a dispose function
          if (value && typeof value.dispose === "function") {
            value.dispose();
          }
        }
      }
    });
    this.camera.controls.dispose();
    this.renderer.instance.dispose();
    if (this.debug.active) {
      this.debug.ui.destroy();
    }
  }
}

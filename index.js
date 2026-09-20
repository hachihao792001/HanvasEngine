import { Vector3, Mat4x4, Quaternion, Plane } from "./math.js";
import { Cube, Quad, ObjMesh } from "./mesh.js";
import { Color, Texture } from "./graphics.js";
import { Camera, GameObject, DirectionalLight, Rasterizer } from "./engine.js";
import { Portal } from "./portal.js";

/** @typedef {import("./mesh.js").Triangle} Triangle */
/** @typedef {import("./portal.js").RenderSettings} RenderSettings */

const gameCanvas = /** @type {HTMLCanvasElement} */ (document.getElementById("gameCanvas"));
const ctx = /** @type {CanvasRenderingContext2D} */ (gameCanvas.getContext("2d"));
const asciiParagraph = /** @type {HTMLParagraphElement} */ (document.getElementById("asciiParagraph"));
const rasterizer = new Rasterizer(gameCanvas.width, gameCanvas.height, ctx, asciiParagraph);
const fov = 60;
let znear = 0.01,
    zfar = 1000;
let portalCrossMargin = znear * 2;
let projectionMatrix = Mat4x4.Projection(fov, gameCanvas.height, gameCanvas.width, znear, zfar);
let camera = new Camera(new Vector3(0, 1, -10), new Vector3(0, 0, 0), 6, 0.2);
let nearPlane = new Plane(Vector3.forward, new Vector3(0, 0, znear));
/** @type {Record<string, boolean>} */
let keyStates = {};

const asciiCheckBox = /** @type {HTMLInputElement} */ (document.getElementById("useASCII"));
const asciiResRow = /** @type {HTMLElement} */ (document.getElementById("asciiResRow"));
const canvasResRow = /** @type {HTMLElement} */ (document.getElementById("canvasResRow"));
const renderDiv = /** @type {HTMLElement} */ (document.getElementById("render"));
const mouseLookButton = /** @type {HTMLInputElement} */ (document.getElementById("mouseLookButton"));

const canvasResWidthInput = /** @type {HTMLInputElement} */ (document.getElementById("canvasResWidth"));
const canvasResHeightInput = /** @type {HTMLInputElement} */ (document.getElementById("canvasResHeight"));
const asciiResWidthInput = /** @type {HTMLInputElement} */ (document.getElementById("asciiResWidth"));
const asciiResHeightInput = /** @type {HTMLInputElement} */ (document.getElementById("asciiResHeight"));

let useASCII = false;
let asciiWidth = 260;
let asciiHeight = 195;
let canvasRenderWidth = 800;
let canvasRenderHeight = 600;

canvasResWidthInput.value = canvasRenderWidth.toString();
canvasResHeightInput.value = canvasRenderHeight.toString();

const fpsInfo = /** @type {HTMLElement} */ (document.getElementById("fps"));
let frames = 0,
    fpsTimeCounter = 0;

const mobileControls = /** @type {HTMLElement} */ (document.getElementById("mobileControls"));
const mobileControlsButton = /** @type {HTMLInputElement} */ (document.getElementById("mobileControlsButton"));

const helpButton = /** @type {HTMLInputElement} */ (document.getElementById("helpButton"));
const helpPopup = /** @type {HTMLElement} */ (document.getElementById("helpPopup"));
const helpCloseButton = /** @type {HTMLInputElement} */ (document.getElementById("helpCloseButton"));

let lookInput = { x: 0, y: 0 };
let lookSpeed = 450;

const lightDirIntensitySlider = /** @type {HTMLInputElement} */ (document.getElementById("dirIntensity"));
const lightDirIntensityText = /** @type {HTMLElement} */ (document.getElementById("dirIntensityText"));
let dirLightDefaultDir = new Vector3(-0.4, -1, -0.4);
let dirLight = new DirectionalLight(dirLightDefaultDir, parseFloat(lightDirIntensitySlider.value));

const pointLightIntensitySlider = /** @type {HTMLInputElement} */ (document.getElementById("pointIntensity"));
const pointLightIntensityText = /** @type {HTMLElement} */ (document.getElementById("pointIntensityText"));
let pointLightIntensity = parseFloat(pointLightIntensitySlider.value);
const pointLightRangeSlider = /** @type {HTMLInputElement} */ (document.getElementById("pointRange"));
const pointLightRangeText = /** @type {HTMLElement} */ (document.getElementById("pointRangeText"));
let pointLightRange = parseFloat(pointLightRangeSlider.value);

const portalLimitInput = /** @type {HTMLInputElement} */ (document.getElementById("portalLimit"));
let portalLimit = parseInt(portalLimitInput.value);

let playerCubeTexture = new Texture(
    "https://raw.githubusercontent.com/hachihao792001/hachihao792001.github.io/refs/heads/main/blogs/graphics3D/images/textures/wheatly.png",
);
let companionCubeTexture = new Texture(
    "https://raw.githubusercontent.com/hachihao792001/hachihao792001.github.io/refs/heads/main/blogs/graphics3D/images/textures/companion_cube.png",
);
let wallTexture = new Texture(
    "https://raw.githubusercontent.com/hachihao792001/hachihao792001.github.io/refs/heads/main/blogs/graphics3D/images/textures/concrete_modular_wall001a.png",
);
let floorTexture = new Texture(
    "https://raw.githubusercontent.com/hachihao792001/hachihao792001.github.io/refs/heads/main/blogs/graphics3D/images/textures/concrete_modular_floor001a.png",
);

let cubeMesh = new Cube();
let quadMesh = new Quad();

/** @type {GameObject[]} */
let pointLights = [
    new GameObject(new Vector3(0.43, 3.53, -8.69), new Vector3(0, -90, 0), new Vector3(0.2, 0.2, 0.2), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(0.43, 1.625, -3.37), new Vector3(0, -90, 0), new Vector3(0.2, 0.2, 0.2), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(0.43, 8.875, 0.71), new Vector3(0, -90, 0), new Vector3(0.2, 0.2, 0.2), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-9.2, 8.875, 0.7), new Vector3(0, -90, 0), new Vector3(0.2, 0.2, 0.2), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-9.2, 8.875, 6.2), new Vector3(0, -90, 0), new Vector3(0.2, 0.2, 0.2), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-9.2, 8.875, 16.4), new Vector3(0, -90, 0), new Vector3(0.2, 0.2, 0.2), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-9.2, -5.38, 16.4), new Vector3(0, -90, 0), new Vector3(0.2, 0.2, 0.2), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-9.2, 8.875, 27.5), new Vector3(0, -90, 0), new Vector3(0.2, 0.2, 0.2), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-19.9, 8.875, 27.5), new Vector3(0, -90, 0), new Vector3(0.2, 0.2, 0.2), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-30.2, 8.875, 27.5), new Vector3(0, -90, 0), new Vector3(0.2, 0.2, 0.2), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-39.225, 1.625, 27.5), new Vector3(0, -90, 0), new Vector3(0.2, 0.2, 0.2), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-30.49, -5.49, 27.5), new Vector3(0, -90, 0), new Vector3(0.2, 0.2, 0.2), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-44.54, 3.531, 27.5), new Vector3(0, -90, 0), new Vector3(0.2, 0.2, 0.2), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-70.95, 15.26, 27.5), new Vector3(0, -90, 0), new Vector3(0.2, 0.2, 0.2), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-88.17, 0.72, 27.5), new Vector3(0, -90, 0), new Vector3(0.2, 0.2, 0.2), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-70.89, 12.27, 6.8), new Vector3(0, -90, 0), new Vector3(0.2, 0.2, 0.2), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-96.7, 12.27, 45.8), new Vector3(0, -90, 0), new Vector3(0.2, 0.2, 0.2), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-58.06, 7.79, 48.29), new Vector3(0, -90, 0), new Vector3(0.2, 0.2, 0.2), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-49.45, 9.8, 27.28), new Vector3(0, -90, 0), new Vector3(0.2, 0.2, 0.2), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-96.27, 7.79, 4.11), new Vector3(0, -90, 0), new Vector3(0.2, 0.2, 0.2), new Color(0, 255, 0), cubeMesh, floorTexture),
];

/** @type {GameObject[]} */
let sceneObjects = [
    new GameObject(new Vector3(0.125, 3.75, -7.75), new Vector3(-90, 0, 0), new Vector3(7.75, 11, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(0.25, 1.75, -3.25), new Vector3(-90, 0, 0), new Vector3(4, 2, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-2.5, 2, -5.25), new Vector3(180, -45, 180), new Vector3(2.121, 15, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-3.25, 2, -9), new Vector3(0, -90, 0), new Vector3(6, 15, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-2.5, 2, -12.75), new Vector3(0, -45, 0), new Vector3(2.121, 15, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(3.125, 2, -12.625), new Vector3(0, 45, 0), new Vector3(2.475, 15, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(3.125, 2, -5.125), new Vector3(180, 45, 180), new Vector3(2.475, 15, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(0.25, 2.75, -4.25), new Vector3(180, 0, 180), new Vector3(4, 2, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(0.25, 2, -13.5), new Vector3(0, 0, 0), new Vector3(4, 15, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(4, 2, -8.875), new Vector3(0, 90, 0), new Vector3(5.75, 15, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(2.25, 2, -3.25), new Vector3(0, 90, 0), new Vector3(2, 15, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-1.75, 2, -3.375), new Vector3(0, -90, 0), new Vector3(2.25, 15, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-43.75, 3.75, 27.375), new Vector3(-90, 0, 90), new Vector3(7.75, 11, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-39.25, 1.75, 27.25), new Vector3(-90, 0, 90), new Vector3(4, 2, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-41.25, 2, 30), new Vector3(180, 45, 180), new Vector3(2.121, 15, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-44.875, 2, 30.75), new Vector3(180, 0, 180), new Vector3(5.75, 15, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-48.5, 2, 30), new Vector3(180, -45, 180), new Vector3(2.121, 15, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-48.5, 2, 24.5), new Vector3(0, -45, 0), new Vector3(2.121, 15, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-41, 2, 24.5), new Vector3(0, 45, 0), new Vector3(2.121, 15, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-40.25, 2.75, 27.25), new Vector3(0, 90, 0), new Vector3(4, 2, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-49.25, 5.625, 27.25), new Vector3(0, -90, 0), new Vector3(4, 7.75, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-44.75, 2, 23.75), new Vector3(0, 0, 0), new Vector3(6, 15, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-39.25, 2, 25.25), new Vector3(0, 0, 0), new Vector3(2, 15, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-39.375, 2, 29.25), new Vector3(180, 0, 180), new Vector3(2.25, 15, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-4.375, -1.75, -1.25), new Vector3(90, 0, 0), new Vector3(16.75, 24, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-22, 9, 17), new Vector3(-90, 0, 0), new Vector3(53.5, 60.5, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-9, -3.625, 10.75), new Vector3(0, 0, 0), new Vector3(7.5, 3.75, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-9, -3.625, 21.75), new Vector3(180, 0, 180), new Vector3(7.5, 3.75, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-9, -5.5, 16.25), new Vector3(90, 0, 0), new Vector3(7.5, 11, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-16.6919, -2.4297, 27.296), new Vector3(-90.0198, 0, -180), new Vector3(0.9132, 10.931, 0.2007), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-15.5588, -1.9487, 27.296), new Vector3(-90.0198, 0, -180), new Vector3(0.9132, 10.931, 0.2007), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-17.6009, -2.9107, 27.296), new Vector3(-90.0198, 0, -180), new Vector3(0.9132, 10.931, 0.2007), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-18.5316, -3.36, 27.296), new Vector3(-90.0198, 0, -180), new Vector3(0.9132, 10.931, 0.2007), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-19.4616, -3.8198, 27.296), new Vector3(-90.0198, 0, -180), new Vector3(0.9132, 10.931, 0.2007), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-20.3816, -4.2903, 27.296), new Vector3(-90.0198, 0, -180), new Vector3(0.9132, 10.931, 0.2007), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-21.3116, -4.7607, 27.296), new Vector3(-90.0198, 0, -180), new Vector3(0.9132, 10.931, 0.2007), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-22.1996, -5.1994, 27.296), new Vector3(-90.0198, 0, -180), new Vector3(0.9132, 10.931, 0.2007), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-10.625, -1.75, 27.25), new Vector3(90, 0, 0), new Vector3(10.75, 11, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-27, -5.5, 27.25), new Vector3(90, 0, 0), new Vector3(8.5, 11, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-40.1308, -1.75, 27.25), new Vector3(90, 0, 0), new Vector3(18.262, 11, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-31, -3.625, 27.25), new Vector3(0, -90, 0), new Vector3(11, 3.75, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-12.75, 2, 9.75), new Vector3(0, -90, 0), new Vector3(24, 15, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-5.25, 2, 18), new Vector3(0, 90, 0), new Vector3(29.5, 15, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-21.75, 2, 32.75), new Vector3(180, 0, 180), new Vector3(33, 15, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-38.25, 5.625, 27.25), new Vector3(0, -90, 0), new Vector3(11, 7.75, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-38.25, 0, 23.5), new Vector3(0, -90, 0), new Vector3(3.5, 3.5, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-38.25, 0, 31), new Vector3(0, -90, 0), new Vector3(3.5, 3.5, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-25.5, 2, 21.75), new Vector3(0, 0, 0), new Vector3(25.5, 15, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-0.625, 2, 3.25), new Vector3(180, 0, 180), new Vector3(9.25, 15, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-7.25, 2, -2.25), new Vector3(0, 0, 0), new Vector3(11, 15, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(1.125, 5.625, -2.25), new Vector3(0, 0, 0), new Vector3(5.75, 7.75, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(3.125, 0, -2.25), new Vector3(0, 0, 0), new Vector3(1.75, 3.5, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(4, 2, 0.625), new Vector3(0, 90, 0), new Vector3(5.75, 15, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-93, -1.75, 8.5), new Vector3(90, 0, 0), new Vector3(12.5, 12.5, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-93, -1.75, 21), new Vector3(90, 0, 0), new Vector3(12.5, 12.5, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-93, -1.75, 33.5), new Vector3(90, 0, 0), new Vector3(12.5, 12.5, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-93, -1.75, 46), new Vector3(90, 0, 0), new Vector3(12.5, 12.5, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-80.5, -1.75, 8.5), new Vector3(90, 0, 0), new Vector3(12.5, 12.5, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-80.5, -1.75, 21), new Vector3(90, 0, 0), new Vector3(12.5, 12.5, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-80.5, -1.75, 33.5), new Vector3(90, 0, 0), new Vector3(12.5, 12.5, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-80.5, -1.75, 46), new Vector3(90, 0, 0), new Vector3(12.5, 12.5, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-68, -1.75, 8.5), new Vector3(90, 0, 0), new Vector3(12.5, 12.5, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-68, -1.75, 21), new Vector3(90, 0, 0), new Vector3(12.5, 12.5, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-68, -1.75, 33.5), new Vector3(90, 0, 0), new Vector3(12.5, 12.5, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-68, -1.75, 46), new Vector3(90, 0, 0), new Vector3(12.5, 12.5, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-55.5, -1.75, 8.5), new Vector3(90, 0, 0), new Vector3(12.5, 12.5, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-55.5, -1.75, 21), new Vector3(90, 0, 0), new Vector3(12.5, 12.5, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-55.5, -1.75, 33.5), new Vector3(90, 0, 0), new Vector3(12.5, 12.5, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-55.5, -1.75, 46), new Vector3(90, 0, 0), new Vector3(12.5, 12.5, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-93, 22.25, 8.5), new Vector3(-90, 0, 0), new Vector3(12.5, 12.5, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-93, 22.25, 21), new Vector3(-90, 0, 0), new Vector3(12.5, 12.5, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-93, 22.25, 33.5), new Vector3(-90, 0, 0), new Vector3(12.5, 12.5, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-93, 22.25, 46), new Vector3(-90, 0, 0), new Vector3(12.5, 12.5, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-80.5, 22.25, 8.5), new Vector3(-90, 0, 0), new Vector3(12.5, 12.5, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-80.5, 22.25, 21), new Vector3(-90, 0, 0), new Vector3(12.5, 12.5, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-80.5, 22.25, 33.5), new Vector3(-90, 0, 0), new Vector3(12.5, 12.5, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-80.5, 22.25, 46), new Vector3(-90, 0, 0), new Vector3(12.5, 12.5, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-68, 22.25, 8.5), new Vector3(-90, 0, 0), new Vector3(12.5, 12.5, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-68, 22.25, 21), new Vector3(-90, 0, 0), new Vector3(12.5, 12.5, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-68, 22.25, 33.5), new Vector3(-90, 0, 0), new Vector3(12.5, 12.5, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-68, 22.25, 46), new Vector3(-90, 0, 0), new Vector3(12.5, 12.5, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-55.5, 22.25, 8.5), new Vector3(-90, 0, 0), new Vector3(12.5, 12.5, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-55.5, 22.25, 21), new Vector3(-90, 0, 0), new Vector3(12.5, 12.5, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-55.5, 22.25, 33.5), new Vector3(-90, 0, 0), new Vector3(12.5, 12.5, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-55.5, 22.25, 46), new Vector3(-90, 0, 0), new Vector3(12.5, 12.5, 1), new Color(0, 255, 0), quadMesh, floorTexture),
    new GameObject(new Vector3(-99.25, 4.25, 8.5), new Vector3(0, -90, 0), new Vector3(12.5, 12, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-99.25, 16.25, 8.5), new Vector3(0, -90, 0), new Vector3(12.5, 12, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-99.25, 4.25, 21), new Vector3(0, -90, 0), new Vector3(12.5, 12, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-99.25, 16.25, 21), new Vector3(0, -90, 0), new Vector3(12.5, 12, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-99.25, 4.25, 33.5), new Vector3(0, -90, 0), new Vector3(12.5, 12, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-99.25, 16.25, 33.5), new Vector3(0, -90, 0), new Vector3(12.5, 12, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-99.25, 4.25, 46), new Vector3(0, -90, 0), new Vector3(12.5, 12, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-99.25, 16.25, 46), new Vector3(0, -90, 0), new Vector3(12.5, 12, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-93, 4.25, 2.25), new Vector3(0, 0, 0), new Vector3(12.5, 12, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-93, 16.25, 2.25), new Vector3(0, 0, 0), new Vector3(12.5, 12, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-80.5, 4.25, 2.25), new Vector3(0, 0, 0), new Vector3(12.5, 12, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-80.5, 16.25, 2.25), new Vector3(0, 0, 0), new Vector3(12.5, 12, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-68, 4.25, 2.25), new Vector3(0, 0, 0), new Vector3(12.5, 12, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-68, 16.25, 2.25), new Vector3(0, 0, 0), new Vector3(12.5, 12, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-55.5, 4.25, 2.25), new Vector3(0, 0, 0), new Vector3(12.5, 12, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-55.5, 16.25, 2.25), new Vector3(0, 0, 0), new Vector3(12.5, 12, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-93, 4.25, 52.25), new Vector3(180, 0, 180), new Vector3(12.5, 12, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-93, 16.25, 52.25), new Vector3(180, 0, 180), new Vector3(12.5, 12, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-80.5, 4.25, 52.25), new Vector3(180, 0, 180), new Vector3(12.5, 12, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-80.5, 16.25, 52.25), new Vector3(180, 0, 180), new Vector3(12.5, 12, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-68, 4.25, 52.25), new Vector3(180, 0, 180), new Vector3(12.5, 12, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-68, 16.25, 52.25), new Vector3(180, 0, 180), new Vector3(12.5, 12, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-55.5, 4.25, 52.25), new Vector3(180, 0, 180), new Vector3(12.5, 12, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-55.5, 16.25, 52.25), new Vector3(180, 0, 180), new Vector3(12.5, 12, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-49.25, 4.25, 8), new Vector3(0, 90, 0), new Vector3(11.5, 12, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-49.25, 16.25, 8), new Vector3(0, 90, 0), new Vector3(11.5, 12, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-49.25, 4.25, 19.5), new Vector3(0, 90, 0), new Vector3(11.5, 12, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-49.25, 16.25, 19.5), new Vector3(0, 90, 0), new Vector3(11.5, 12, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-49.25, 4.25, 35), new Vector3(0, 90, 0), new Vector3(11.5, 12, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-49.25, 16.25, 35), new Vector3(0, 90, 0), new Vector3(11.5, 12, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-49.25, 4.25, 46.5), new Vector3(0, 90, 0), new Vector3(11.5, 12, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-49.25, 16.25, 46.5), new Vector3(0, 90, 0), new Vector3(11.5, 12, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-49.25, 6.875, 27.25), new Vector3(0, 90, 0), new Vector3(4, 10.25, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-49.25, 17.125, 27.25), new Vector3(0, 90, 0), new Vector3(4, 10.25, 1), new Color(0, 255, 0), quadMesh, wallTexture),
    new GameObject(new Vector3(-57, 0.6, 27.25), new Vector3(0, 0, 18), new Vector3(14, 0.7, 12), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-68.77, 2.8, 27.25), new Vector3(0, 0, 0), new Vector3(10, 0.7, 12), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-70, 1.6, 35), new Vector3(35, 0, 0), new Vector3(14, 0.7, 12), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-70, 1.6, 47), new Vector3(-35, 0, 0), new Vector3(14, 0.7, 12), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-91, 0.5, 8), new Vector3(0, 0, 15), new Vector3(9, 0.6, 7), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-91, 1, 17), new Vector3(0, 0, 30), new Vector3(9, 0.6, 7), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-91, 1.5, 26), new Vector3(0, 0, 45), new Vector3(9, 0.6, 7), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-91, 2.2, 35), new Vector3(0, 0, 60), new Vector3(9, 0.6, 7), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-91, 2.7, 44), new Vector3(0, 0, 75), new Vector3(9, 0.6, 7), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-68.16, 7.87, 18.16), new Vector3(25, 34.9999, 0), new Vector3(10, 0.6, 10), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-71.71, 9.17, 42.48), new Vector3(-20, -50, 15), new Vector3(10, 0.6, 10), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-84, 9, 30), new Vector3(40, 20, -25), new Vector3(9, 0.6, 9), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-56, 9.5, 9), new Vector3(0, 0, 0), new Vector3(10, 0.8, 10), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-96, 13, 27.25), new Vector3(0, 0, 0), new Vector3(5, 0.8, 14), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-71, 16.5, 27.25), new Vector3(0, 0, 0), new Vector3(9, 0.8, 9), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-74, 6.5, 8.21), new Vector3(0, 0, 80), new Vector3(16, 0.9, 11), new Color(0, 255, 0), cubeMesh, floorTexture),
    new GameObject(new Vector3(-57, 8, 49), new Vector3(72, 0, 0), new Vector3(11, 0.9, 15), new Color(0, 255, 0), cubeMesh, floorTexture),
];

let playerCube = new GameObject(
    camera.pos,
    Vector3.zero,
    new Vector3(0.5, 0.5, 0.5),
    new Color(255, 255, 255),
    new ObjMesh("https://raw.githubusercontent.com/hachihao792001/hachihao792001.github.io/refs/heads/main/blogs/graphics3D/models/grass_block.obj"),
    playerCubeTexture,
    "Player",
);
playerCube.rotation = camera.rotation;

let companionCube = new GameObject(
    new Vector3(2, -0.7, 1.2),
    Vector3.zero,
    new Vector3(1, 1, 1),
    new Color(0, 255, 0),
    cubeMesh,
    companionCubeTexture,
    "Companion cube",
);
companionCube.isHoldable = true;

let portal1 = new Portal(
    "Orange portal",
    new Vector3(-10, 1.5, 32),
    new Vector3(0, 180, 0),
    new Vector3(2, 4, 1),
    new Color(255, 201, 94),
    gameCanvas.width,
    gameCanvas.height,
    ctx,
);
let portal2 = new Portal(
    "Blue portal",
    new Vector3(-12, 1.5, 2),
    new Vector3(0, -90, 0),
    new Vector3(2, 4, 1),
    new Color(17, 155, 255),
    gameCanvas.width,
    gameCanvas.height,
    ctx,
);
portal1.setOtherPortal(portal2);
portal2.setOtherPortal(portal1);
let portals = [portal1, portal2];

let canInteractWithPortalGameObjects = [playerCube, companionCube];

/**
 * @typedef {Object} ControllableObject
 * @property {string} name
 * @property {() => Vector3} getPos
 * @property {(pos: Vector3) => void} setPos
 * @property {(x: number, y: number, z: number) => void} rotate
 */

/** @type {ControllableObject[]} */
let controllableObjects = [
    ...portals.map((portal) => ({
        name: portal.name,
        getPos: () => portal.pos,
        setPos: (/** @type {Vector3} */ pos) => portal.setPos(pos),
        rotate: (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ z) => portal.rotate(x, y, z),
    })),
    {
        name: companionCube.name,
        getPos: () => companionCube.pos,
        setPos: (/** @type {Vector3} */ pos) => (companionCube.pos = pos),
        rotate: (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ z) => companionCube.rotate(x, y, z),
    },
];

/** @type {GameObject | null} */
let holdingObject = null;
let holdingDistance = 5;
let throwSpeed = 10;

const controllingObjectText = /** @type {HTMLElement} */ (document.getElementById("controllingObject"));
let controllingObject = 0;
let controllingMoveSpeed = 6;
let controllingRotateSpeed = 60;
setControllingObject(0);

/** @param {number} index */
function setControllingObject(index) {
    controllingObject = index % controllableObjects.length;
    controllingObjectText.innerText = controllableObjects[controllingObject].name;
}

let lastTime = performance.now();
let dt = 0;

function updateControllingObject() {
    let controlling = controllableObjects[controllingObject];

    let posDelta = Vector3.zero;
    if (keyStates["i"]) {
        posDelta = Vector3.add(posDelta, Vector3.forward);
    }
    if (keyStates["k"]) {
        posDelta = Vector3.add(posDelta, Vector3.back);
    }
    if (keyStates["j"]) {
        posDelta = Vector3.add(posDelta, Vector3.left);
    }
    if (keyStates["l"]) {
        posDelta = Vector3.add(posDelta, Vector3.right);
    }
    if (keyStates["u"]) {
        posDelta = Vector3.add(posDelta, Vector3.up);
    }
    if (keyStates["o"]) {
        posDelta = Vector3.add(posDelta, Vector3.down);
    }
    if (!posDelta.equal(Vector3.zero)) {
        posDelta = Vector3.mul(posDelta.normalize(), dt * controllingMoveSpeed);
        controlling.setPos(Vector3.add(controlling.getPos(), posDelta));
    }

    let rotateEuler = Vector3.zero.clone();
    if (keyStates["b"]) {
        rotateEuler.x = dt * controllingRotateSpeed;
    }
    if (keyStates["n"]) {
        rotateEuler.y = dt * controllingRotateSpeed;
    }
    if (keyStates["m"]) {
        rotateEuler.z = dt * controllingRotateSpeed;
    }
    if (!rotateEuler.equal(Vector3.zero)) {
        controlling.rotate(rotateEuler.x, rotateEuler.y, rotateEuler.z);
    }
}

function updatePortalTeleports() {
    for (let portal of portals) {
        portal.updatePortalCameraBaseOnPlayer(camera.pos, camera.rotation);
    }

    for (let portal of portals) {
        let teleported = portal.getPlayerTeleportedTransformIfGoThroughPortal(camera.pos, camera.rotation, portalCrossMargin);
        if (teleported == null) continue;

        camera.updateTransformAndCorrectRoll(teleported[0], teleported[1]);
        for (let other of portals) {
            other.refreshLastFramePlayerInFrontOfPortal(camera.pos, portalCrossMargin);
        }
        break;
    }

    for (let gameObject of canInteractWithPortalGameObjects) {
        for (let portal of portals) {
            let teleported = portal.getGameObjectTeleportedTransformIfGoThroughPortal(gameObject);
            if (teleported == null) continue;

            gameObject.pos = teleported[0];
            let oldLocalVelocity = gameObject.rotation.inverseRotateVector(gameObject.velocity);
            gameObject.velocity = teleported[1].rotateVector(oldLocalVelocity);
            gameObject.rotation = teleported[1];
            break;
        }
    }
}

function updateGameObjectTransforms() {
    updateControllingObject();

    camera.updateMovement(dt, keyStates);
    if ((lookInput.x != 0 || lookInput.y != 0) && !camera.isCorrectingRoll()) {
        camera.updateRotation(lookInput.x * dt * lookSpeed, lookInput.y * dt * lookSpeed);
    }
    camera.updateRollCorrection(dt);

    if (holdingObject != null) {
        holdingObject.pos = Vector3.add(camera.pos, Vector3.mul(camera.getForward(), holdingDistance));
    }
    companionCube.updatePhysics(dt);

    playerCube.pos = camera.pos;
    playerCube.rotation = camera.rotation;

    updatePortalTeleports();
}

/** @returns {Triangle[]} */
function gameObjectToWorldSpaceTriangles() {
    /** @type {Triangle[]} */
    let objectTris = [];
    for (let light of pointLights) {
        objectTris.push(...light.getTransformedTriangles());
    }
    for (let portal of portals) {
        objectTris.push(...portal.getAllTransformedTriangles());
    }
    for (let gameObject of sceneObjects) {
        objectTris.push(...gameObject.getTransformedTriangles());
    }

    let portal1Plane = portal1.getPlane();
    let portal2Plane = portal2.getPlane();

    for (let gameObject of canInteractWithPortalGameObjects) {
        let gameObjectTransformedTris = gameObject.getTransformedTriangles();

        if (portal1.isPointDirectlyInFrontOrBackOfPortal(gameObject.pos) && portal1Plane.isIntersectingWithTris(gameObjectTransformedTris)) {
            let clonedGameObject = portal1.createCloneObjectOnOtherPortal(gameObject);
            objectTris.push(...portal1Plane.clipWithTris(gameObjectTransformedTris));
            objectTris.push(...portal2Plane.clipWithTris(clonedGameObject.getTransformedTriangles()));
        } else if (portal2.isPointDirectlyInFrontOrBackOfPortal(gameObject.pos) && portal2Plane.isIntersectingWithTris(gameObjectTransformedTris)) {
            let clonedGameObject = portal2.createCloneObjectOnOtherPortal(gameObject);
            objectTris.push(...portal2Plane.clipWithTris(gameObjectTransformedTris));
            objectTris.push(...portal1Plane.clipWithTris(clonedGameObject.getTransformedTriangles()));
        } else {
            objectTris.push(...gameObjectTransformedTris);
        }
    }

    return objectTris;
}

/** @returns {RenderSettings} */
function getRenderSettings() {
    return {
        canvasWidth: gameCanvas.width,
        canvasHeight: gameCanvas.height,
        projectionMatrix: projectionMatrix,
        nearPlane: nearPlane,
        portalLimit: portalLimit,
        dirLight: dirLight,
        pointLightIntensity: pointLightIntensity,
        pointLights: pointLights,
        pointLightRange: pointLightRange,
    };
}

/** @param {Triangle[]} objectTris */
function portalRenderOperations(objectTris) {
    const settings = getRenderSettings();
    for (let portal of portals) {
        portal.recursivePortalOperation(camera, objectTris, settings);
    }
}

/**
 * @param {Triangle[]} objectTris
 * @returns {Triangle[]}
 */
function worldSpaceToViewSpace(objectTris) {
    const viewMat = camera.getViewMatrix();

    /** @type {Triangle[]} */
    let visibleTris = [];
    for (let tri of objectTris) {
        if (Vector3.dot(tri.getNormal(), Vector3.sub(tri.getCenter(), camera.pos)) < 0) {
            tri.mulMat4x4(viewMat);
            visibleTris.push(...tri.clipAgainstPlane(nearPlane));
        }
    }

    return visibleTris;
}

/**
 * @param {Triangle[]} visibleTris
 */
function sortNearestFirst(visibleTris) {
    visibleTris.sort((a, b) => (a.vertices[0].z + a.vertices[1].z + a.vertices[2].z) / 3 - (b.vertices[0].z + b.vertices[1].z + b.vertices[2].z) / 3);
}

/** @param {Triangle[]} visibleTris */
function viewSpaceToClipSpace(visibleTris) {
    for (let tri of visibleTris) {
        tri.mulMat4x4(projectionMatrix);
        tri.perspectiveDivide();
    }
}

/** @param {Triangle[]} visibleTris */
function rasterize(visibleTris) {
    rasterizer.clearScreen();
    rasterizer.rasterizeClipSpaceTriangles(visibleTris, dirLight, pointLightIntensity, pointLights, pointLightRange);
    rasterizer.drawCall(useASCII);

    let x = rasterizer.screenCenterX,
        y = rasterizer.screenCenterY;
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(x - 2, y - 2, 5, 5);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - 1, y - 1, 3, 3);
}

/** @param {number} [time] */
function update(time = performance.now()) {
    dt = (time - lastTime) / 1000;
    lastTime = time;

    fpsTimeCounter += dt;
    frames++;
    if (fpsTimeCounter >= 1) {
        fpsInfo.textContent = `FPS: ${frames}`;
        frames = 0;
        fpsTimeCounter = 0;
    }

    updateGameObjectTransforms();
    let objectTris = gameObjectToWorldSpaceTriangles();
    portalRenderOperations(objectTris);
    let visibleTris = worldSpaceToViewSpace(objectTris);
    sortNearestFirst(visibleTris);
    viewSpaceToClipSpace(visibleTris);
    rasterize(visibleTris);

    requestAnimationFrame(update);
}

update();

/** @param {number} index */
function shootPortal(index) {
    if (rasterizer.pointingTri == null) return;

    let normal = rasterizer.pointingPosNormal;
    let surfacePos = Vector3.add(rasterizer.pointingPos, Vector3.mul(normal, 0.1));
    let upReference = Math.abs(Vector3.dot(normal, Vector3.up)) >= 0.9 ? camera.getForward() : Vector3.up;

    let portal = portals[index];
    portal.setRotation(Quaternion.lookRotation(normal, upReference));
    portal.setPos(surfacePos);
}

/** @param {string} key */
function doKeyAction(key) {
    if (key == "p") {
        setControllingObject(controllingObject + 1);
    } else if (key == "g") {
        companionCube.useGravity = !companionCube.useGravity;
        if (!companionCube.useGravity) companionCube.velocity = Vector3.zero.clone();
    } else if (key == "f") {
        if (holdingObject != null) {
            holdingObject.useGravity = false;
            holdingObject.velocity = Vector3.zero.clone();
            holdingObject = null;
        } else {
            companionCube.useGravity = false;
            companionCube.velocity = Vector3.zero.clone();
            companionCube.pos = Vector3.add(camera.pos, Vector3.mul(camera.getForward(), holdingDistance));
        }
    } else if (key == "e") {
        if (holdingObject != null) {
            holdingObject.velocity = Vector3.mul(camera.getForward(), throwSpeed);
            holdingObject = null;
            return;
        }

        let pointingTri = rasterizer.pointingTri;
        if (pointingTri == null || pointingTri.gameObject == null) return;
        if (!pointingTri.gameObject.isHoldable) return;

        holdingObject = pointingTri.gameObject;
        holdingObject.velocity = Vector3.zero.clone();
        holdingObject.useGravity = false;
    }
}

lightDirIntensitySlider.addEventListener("input", () => {
    dirLight.intensity = parseFloat(lightDirIntensitySlider.value);
    lightDirIntensityText.textContent = dirLight.intensity.toFixed(2);
});

pointLightIntensitySlider.addEventListener("input", () => {
    pointLightIntensity = parseFloat(pointLightIntensitySlider.value);
    pointLightIntensityText.textContent = pointLightIntensity.toFixed(2);
});

pointLightRangeSlider.addEventListener("input", () => {
    pointLightRange = parseFloat(pointLightRangeSlider.value);
    pointLightRangeText.textContent = pointLightRange.toFixed(0);
});

portalLimitInput.addEventListener("input", () => {
    let value = parseInt(portalLimitInput.value);
    if (!isNaN(value)) portalLimit = Math.max(0, Math.min(50, value));
});

/**
 *
 * @param {HTMLInputElement} input
 * @param {Number} min
 * @param {Number} max
 * @param {Number} current
 * @returns
 */
function readResolution(input, min, max, current) {
    let value = parseInt(input.value);
    if (isNaN(value)) return current;
    return Math.max(min, Math.min(max, value));
}

function applyRenderResolution() {
    gameCanvas.width = useASCII ? asciiWidth : canvasRenderWidth;
    gameCanvas.height = useASCII ? asciiHeight : canvasRenderHeight;

    projectionMatrix = Mat4x4.Projection(fov, gameCanvas.height, gameCanvas.width, znear, zfar);
    rasterizer.resize(gameCanvas.width, gameCanvas.height);
    for (let portal of portals) {
        portal.resize(gameCanvas.width, gameCanvas.height);
    }
}

function applyCanvasResolution() {
    canvasRenderWidth = readResolution(canvasResWidthInput, 16, 1920, canvasRenderWidth);
    canvasRenderHeight = readResolution(canvasResHeightInput, 16, 1440, canvasRenderHeight);
    canvasResWidthInput.value = canvasRenderWidth.toString();
    canvasResHeightInput.value = canvasRenderHeight.toString();
    if (!useASCII) applyRenderResolution();
}
canvasResWidthInput.addEventListener("change", applyCanvasResolution);
canvasResHeightInput.addEventListener("change", applyCanvasResolution);

function applyAsciiResolution() {
    asciiWidth = readResolution(asciiResWidthInput, 8, 500, asciiWidth);
    asciiHeight = readResolution(asciiResHeightInput, 8, 400, asciiHeight);
    asciiResWidthInput.value = asciiWidth.toString();
    asciiResHeightInput.value = asciiHeight.toString();
    if (useASCII) applyRenderResolution();
}
asciiResWidthInput.addEventListener("change", applyAsciiResolution);
asciiResHeightInput.addEventListener("change", applyAsciiResolution);

async function requestMouseLook() {
    try {
        await renderDiv.requestPointerLock({
            unadjustedMovement: true,
        });
    } catch (e) {
        // mobile
    }
}

mouseLookButton.addEventListener("click", requestMouseLook);

gameCanvas.addEventListener("mousedown", () => {
    if (document.pointerLockElement !== renderDiv) requestMouseLook();
});

document.addEventListener("mousedown", (e) => {
    if (document.pointerLockElement !== renderDiv) return;
    if (e.button == 0) {
        shootPortal(0);
    } else if (e.button == 2) {
        shootPortal(1);
    }
});

document.addEventListener("contextmenu", (e) => {
    if (document.pointerLockElement === renderDiv) e.preventDefault();
});

document.addEventListener("mousemove", (e) => {
    if (document.pointerLockElement === renderDiv && !camera.isCorrectingRoll()) {
        camera.updateRotation(e.movementX, e.movementY);
    }
});

document.addEventListener("pointerlockchange", () => {
    mouseLookButton.textContent = document.pointerLockElement === renderDiv ? "Mouse look on - Esc to release" : "Press here to look around (ASCII)";
});

asciiCheckBox.addEventListener("change", () => {
    useASCII = asciiCheckBox.checked;
    applyRenderResolution();
    asciiParagraph.style.display = useASCII ? "" : "none";
    gameCanvas.style.display = useASCII ? "none" : "";
    mouseLookButton.style.display = useASCII ? "" : "none";
    asciiResRow.style.display = useASCII ? "" : "none";
    canvasResRow.style.display = useASCII ? "none" : "";
    if (document.pointerLockElement != null) document.exitPointerLock();
});

window.addEventListener("keydown", (e) => {
    keyStates[e.key] = true;
});
window.addEventListener("keyup", (e) => {
    keyStates[e.key] = false;
});
window.addEventListener("keypress", (e) => {
    doKeyAction(e.key);
});

mobileControlsButton.addEventListener("click", () => {
    mobileControls.style.display = mobileControls.style.display == "none" ? "" : "none";
    mobileControlsButton.blur();
});

helpButton.addEventListener("click", () => {
    helpPopup.style.display = helpPopup.style.display == "none" ? "" : "none";
    helpButton.blur();
});

helpCloseButton.addEventListener("click", () => {
    helpPopup.style.display = "none";
    helpCloseButton.blur();
});

/** @type {NodeListOf<HTMLButtonElement>} */
const keyButtons = mobileControls.querySelectorAll("button[data-key]");
keyButtons.forEach((button) => {
    const key = /** @type {string} */ (button.getAttribute("data-key"));
    button.addEventListener("pointerdown", (/** @type {PointerEvent}*/ e) => {
        e.preventDefault();
        keyStates[key] = true;
        button.setPointerCapture(e.pointerId);
    });
    const release = () => {
        keyStates[key] = false;
    };
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
});

/** @type {NodeListOf<HTMLButtonElement>} */
const tapButtons = mobileControls.querySelectorAll("button[data-tap]");
tapButtons.forEach((button) => {
    if (!button.dataset.tap) return;
    const key = button.dataset.tap;
    button.addEventListener("click", () => {
        doKeyAction(key);
        button.blur();
    });
});

/** @type {NodeListOf<HTMLButtonElement>} */
const portalButtons = mobileControls.querySelectorAll("button[data-portal]");
portalButtons.forEach((button) => {
    if (!button.dataset.portal) return;
    const index = parseInt(button.dataset.portal);
    button.addEventListener("click", () => {
        shootPortal(index);
        button.blur();
    });
});

/** @type {NodeListOf<HTMLButtonElement>} */
const lookButtons = mobileControls.querySelectorAll("button[data-look]");
lookButtons.forEach((button) => {
    if (!button.dataset.look) return;
    const dir = button.dataset.look.split(",");
    const x = parseInt(dir[0]),
        y = parseInt(dir[1]);
    let pressed = false;
    button.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (pressed) return;
        pressed = true;
        lookInput.x += x;
        lookInput.y += y;
        button.setPointerCapture(e.pointerId);
    });
    const release = () => {
        if (!pressed) return;
        pressed = false;
        lookInput.x -= x;
        lookInput.y -= y;
    };
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
});

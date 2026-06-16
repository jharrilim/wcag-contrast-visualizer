import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import {
  contrastRatio,
  contrastToHeight,
  findContrastPeaks,
  hexToRgb,
  rgbToHex,
  wcagContrastDescription,
  wcagContrastLevel,
  wheelColorAt,
} from "./contrast.js";

const ANGULAR_SEGMENTS = 120;
const RADIAL_SEGMENTS = 40;
const DISK_RADIUS = 2;
const HEIGHT_SCALE = 0.15;

/** @typedef {"fail" | "aa" | "aaa" | "max"} WcagAxisLevel */

/** @type {{ ratio: number, label: string, level: WcagAxisLevel }[]} */
const HEIGHT_AXIS_LABELS = [
  { ratio: 1, label: "1:1 · Fails WCAG", level: "fail" },
  { ratio: 3, label: "3:1 · AA large text / UI", level: "aa" },
  { ratio: 4.5, label: "4.5:1 · AA normal text", level: "aa" },
  { ratio: 7, label: "7:1 · AAA normal text", level: "aaa" },
  { ratio: 21, label: "21:1 · Max contrast", level: "max" },
];

/**
 * @param {WcagAxisLevel} level
 * @returns {string}
 */
function axisLabelClass(level) {
  switch (level) {
    case "fail":
      return "axis-label axis-label--wcag-fail";
    case "aa":
      return "axis-label axis-label--wcag-aa";
    case "aaa":
      return "axis-label axis-label--wcag-aaa";
    case "max":
      return "axis-label axis-label--wcag-max";
    default: {
      const unhandledLevel = level;
      throw new Error(`Unhandled WCAG axis level: ${unhandledLevel}`);
    }
  }
}

/**
 * @param {WcagAxisLevel} level
 * @returns {number}
 */
function axisTickColor(level) {
  switch (level) {
    case "fail":
      return 0xc97b7b;
    case "aa":
      return 0x6dd97a;
    case "aaa":
      return 0x9fe8b0;
    case "max":
      return 0x8a909c;
    default: {
      const unhandledLevel = level;
      throw new Error(`Unhandled WCAG axis level: ${unhandledLevel}`);
    }
  }
}

/**
 * @param {WcagAxisLevel} level
 * @returns {number}
 */
function axisTickLength(level) {
  switch (level) {
    case "fail":
    case "max":
      return 0.25;
    case "aa":
    case "aaa":
      return 0.35;
    default: {
      const unhandledLevel = level;
      throw new Error(`Unhandled WCAG axis level: ${unhandledLevel}`);
    }
  }
}

/** @typedef {{ h: number, s: number, l: number, contrast: number, hex: string }} VertexMeta */

export class ContrastTopologyScene {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {HTMLElement} tooltipEl
   */
  constructor(canvas, tooltipEl) {
    this.canvas = canvas;
    this.tooltipEl = tooltipEl;
    this.referenceRgb = hexToRgb("#808080");
    this.wheelLightness = 0.5;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x111318, 1);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.className = "scene-label-layer";
    this.labelRenderer.domElement.style.position = "absolute";
    this.labelRenderer.domElement.style.inset = "0";
    this.labelRenderer.domElement.style.pointerEvents = "none";
    this.labelRenderer.domElement.style.zIndex = "1";
    const sceneContainer = canvas.parentElement;
    if (sceneContainer) {
      const insertBefore = canvas.nextElementSibling;
      sceneContainer.insertBefore(this.labelRenderer.domElement, insertBefore);
    }

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.camera.position.set(3.5, 3.2, 3.5);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 1.2, 0);

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.85);
    this.directionalLight.position.set(4, 8, 2);
    this.scene.add(this.ambientLight, this.directionalLight);

    this.gridHelper = new THREE.GridHelper(5, 20, 0x3a3f4a, 0x252830);
    this.scene.add(this.gridHelper);

    this.circleOutline = this.createCircleOutline();
    this.scene.add(this.circleOutline);

    this.heightLegend = this.createHeightLegend();
    this.scene.add(this.heightLegend);

    /** @type {VertexMeta[]} */
    this.vertexMeta = [];
    this.wheelMesh = this.buildWheelMesh();
    this.scene.add(this.wheelMesh);

    this.peakMarkers = new THREE.Group();
    this.scene.add(this.peakMarkers);
    this.peakMarkersEnabled = true;
    this.updatePeakMarkers();

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.hoveredFaceIndex = -1;

    this.onResize = this.onResize.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerLeave = this.onPointerLeave.bind(this);

    window.addEventListener("resize", this.onResize);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerleave", this.onPointerLeave);

    this.onResize();
    this.animate = this.animate.bind(this);
    this.animationFrame = requestAnimationFrame(this.animate);
  }

  createCircleOutline() {
    const points = [];
    const segments = 128;
    for (let i = 0; i <= segments; i += 1) {
      const theta = (i / segments) * Math.PI * 2;
      points.push(
        new THREE.Vector3(
          Math.cos(theta) * DISK_RADIUS,
          0,
          Math.sin(theta) * DISK_RADIUS,
        ),
      );
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x5a6070 });
    return new THREE.LineLoop(geometry, material);
  }

  createHeightLegend() {
    const group = new THREE.Group();
    group.position.set(-3.2, 0, 0);

    const maxHeight = contrastToHeight(21, HEIGHT_SCALE);
    const spineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, maxHeight, 0),
    ]);
    const spine = new THREE.Line(
      spineGeometry,
      new THREE.LineBasicMaterial({ color: 0x5a6070 }),
    );
    group.add(spine);

    const titleElement = document.createElement("div");
    titleElement.className = "axis-label axis-label--title";
    titleElement.textContent = "Contrast";
    const titleLabel = new CSS2DObject(titleElement);
    titleLabel.position.set(0, maxHeight + 0.18, 0);
    group.add(titleLabel);

    for (const entry of HEIGHT_AXIS_LABELS) {
      const y = contrastToHeight(entry.ratio, HEIGHT_SCALE);
      const tickLength = axisTickLength(entry.level);
      const tickGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, y, 0),
        new THREE.Vector3(tickLength, y, 0),
      ]);
      const tick = new THREE.Line(
        tickGeometry,
        new THREE.LineBasicMaterial({ color: axisTickColor(entry.level) }),
      );
      group.add(tick);

      const labelElement = document.createElement("div");
      labelElement.className = axisLabelClass(entry.level);
      labelElement.textContent = entry.label;
      const label = new CSS2DObject(labelElement);
      label.position.set(tickLength + 0.07, y, 0);
      group.add(label);
    }

    return group;
  }

  buildWheelMesh() {
    const radialCount = RADIAL_SEGMENTS + 1;
    const angularCount = ANGULAR_SEGMENTS + 1;
    const vertexCount = radialCount * angularCount;

    const positions = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const indices = [];

    this.vertexMeta = [];

    let vertexIndex = 0;
    for (let rIdx = 0; rIdx <= RADIAL_SEGMENTS; rIdx += 1) {
      const radius = rIdx / RADIAL_SEGMENTS;
      for (let aIdx = 0; aIdx <= ANGULAR_SEGMENTS; aIdx += 1) {
        const theta = (aIdx / ANGULAR_SEGMENTS) * Math.PI * 2;
        const color = wheelColorAt(theta, radius, this.wheelLightness);
        const contrast = contrastRatio(this.referenceRgb, color);
        const x = Math.cos(theta) * radius * DISK_RADIUS;
        const z = Math.sin(theta) * radius * DISK_RADIUS;
        const y = contrastToHeight(contrast, HEIGHT_SCALE);

        positions[vertexIndex * 3] = x;
        positions[vertexIndex * 3 + 1] = y;
        positions[vertexIndex * 3 + 2] = z;

        colors[vertexIndex * 3] = color.r;
        colors[vertexIndex * 3 + 1] = color.g;
        colors[vertexIndex * 3 + 2] = color.b;

        this.vertexMeta.push({
          h: color.h,
          s: color.s,
          l: color.l,
          contrast,
          hex: rgbToHex(color),
        });

        vertexIndex += 1;
      }
    }

    for (let rIdx = 0; rIdx < RADIAL_SEGMENTS; rIdx += 1) {
      for (let aIdx = 0; aIdx < ANGULAR_SEGMENTS; aIdx += 1) {
        const a = rIdx * angularCount + aIdx;
        const b = a + angularCount;
        const c = b + 1;
        const d = a + 1;

        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const surfaceMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      metalness: 0,
      roughness: 0.8,
    });

    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      wireframe: true,
      transparent: true,
      opacity: 0.12,
    });

    const group = new THREE.Group();
    const surface = new THREE.Mesh(geometry, surfaceMaterial);
    surface.name = "wheelSurface";
    const wireframe = new THREE.Mesh(geometry, wireframeMaterial);
    group.add(surface, wireframe);

    return group;
  }

  createPeakMarker() {
    const group = new THREE.Group();
    const markerRadius = 0.09;
    const lift = 0.12;

    const stemGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, lift, 0),
    ]);
    const stem = new THREE.Line(
      stemGeometry,
      new THREE.LineBasicMaterial({ color: 0xffffff }),
    );
    group.add(stem);

    const sphereGeometry = new THREE.SphereGeometry(markerRadius, 20, 20);
    const sphereMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfff4d6,
      emissiveIntensity: 0.85,
      metalness: 0.15,
      roughness: 0.35,
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.position.y = lift;
    group.add(sphere);

    const ringGeometry = new THREE.RingGeometry(
      markerRadius * 1.35,
      markerRadius * 1.7,
      32,
    );
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.y = lift + 0.01;
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);

    return group;
  }

  clearPeakMarkers() {
    while (this.peakMarkers.children.length > 0) {
      const child = this.peakMarkers.children[0];
      this.peakMarkers.remove(child);
      child.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    }
  }

  /**
   * @param {boolean} enabled
   */
  setPeakMarkersEnabled(enabled) {
    this.peakMarkersEnabled = enabled;
    if (enabled) {
      this.updatePeakMarkers();
      return;
    }

    this.clearPeakMarkers();
  }

  updatePeakMarkers() {
    this.clearPeakMarkers();

    if (!this.peakMarkersEnabled) {
      return;
    }

    const surface = this.wheelMesh.getObjectByName("wheelSurface");
    if (!(surface instanceof THREE.Mesh)) {
      return;
    }

    const radialCount = RADIAL_SEGMENTS + 1;
    const angularCount = ANGULAR_SEGMENTS + 1;
    const peakIndices = findContrastPeaks(
      this.vertexMeta,
      radialCount,
      angularCount,
    );
    const positions = surface.geometry.attributes.position;

    for (const vertexIndex of peakIndices) {
      const marker = this.createPeakMarker();
      marker.position.set(
        positions.getX(vertexIndex),
        positions.getY(vertexIndex),
        positions.getZ(vertexIndex),
      );
      this.peakMarkers.add(marker);
    }
  }

  /**
   * @param {string} referenceHex
   * @param {number} wheelLightness - 0–1
   */
  updateMesh(referenceHex, wheelLightness) {
    this.referenceRgb = hexToRgb(referenceHex);
    this.wheelLightness = wheelLightness;

    const surface = this.wheelMesh.getObjectByName("wheelSurface");
    if (!(surface instanceof THREE.Mesh)) {
      return;
    }

    const geometry = surface.geometry;
    const positions = geometry.attributes.position;
    const colors = geometry.attributes.color;

    for (let i = 0; i < this.vertexMeta.length; i += 1) {
      const meta = this.vertexMeta[i];
      const radius =
        Math.hypot(positions.getX(i), positions.getZ(i)) / DISK_RADIUS;
      const theta = Math.atan2(positions.getZ(i), positions.getX(i));
      const normalizedTheta = theta < 0 ? theta + Math.PI * 2 : theta;

      const color = wheelColorAt(normalizedTheta, radius, this.wheelLightness);
      const contrast = contrastRatio(this.referenceRgb, color);
      const y = contrastToHeight(contrast, HEIGHT_SCALE);

      positions.setY(i, y);
      colors.setXYZ(i, color.r, color.g, color.b);

      meta.h = color.h;
      meta.s = color.s;
      meta.l = color.l;
      meta.contrast = contrast;
      meta.hex = rgbToHex(color);
    }

    positions.needsUpdate = true;
    colors.needsUpdate = true;
    geometry.computeVertexNormals();
    this.updatePeakMarkers();
  }

  onResize() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width === 0 || height === 0) {
      return;
    }
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.labelRenderer.setSize(width, height);
  }

  /**
   * @param {PointerEvent} event
   */
  onPointerMove(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const surface = this.wheelMesh.getObjectByName("wheelSurface");
    const hits =
      surface instanceof THREE.Mesh
        ? this.raycaster.intersectObject(surface)
        : [];

    if (hits.length === 0) {
      this.hideTooltip();
      return;
    }

    const faceIndex = hits[0].faceIndex;
    if (faceIndex === undefined || faceIndex === null) {
      this.hideTooltip();
      return;
    }

    const geometry = surface.geometry;
    const indexAttr = geometry.index;
    if (!indexAttr) {
      this.hideTooltip();
      return;
    }

    const vertexIndex = indexAttr.getX(faceIndex * 3);
    const meta = this.vertexMeta[vertexIndex];
    if (!meta) {
      this.hideTooltip();
      return;
    }

    this.showTooltip(event.clientX, event.clientY, meta);
  }

  onPointerLeave() {
    this.hideTooltip();
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {VertexMeta} meta
   */
  showTooltip(x, y, meta) {
    const satPercent = Math.round(meta.s * 100);
    const lightPercent = Math.round(meta.l * 100);
    const wcagLevel = wcagContrastLevel(meta.contrast);
    const wcagDescription = wcagContrastDescription(meta.contrast);
    const contrastText = `${meta.contrast.toFixed(2)}:1`;

    this.tooltipEl.hidden = false;
    this.tooltipEl.style.left = `${x + 14}px`;
    this.tooltipEl.style.top = `${y + 14}px`;
    this.tooltipEl.innerHTML = `
      <strong>${meta.hex.toUpperCase()}</strong><br />
      H ${Math.round(meta.h)}° · S ${satPercent}% · L ${lightPercent}%<br />
      Contrast <span class="tooltip-contrast tooltip-contrast--${wcagLevel}" title="${wcagDescription}">${contrastText}</span>
    `;
  }

  hideTooltip() {
    this.tooltipEl.hidden = true;
  }

  animate() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
    this.animationFrame = requestAnimationFrame(this.animate);
  }

  dispose() {
    cancelAnimationFrame(this.animationFrame);
    window.removeEventListener("resize", this.onResize);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
    this.labelRenderer.domElement.remove();
    this.renderer.dispose();
  }
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLElement} tooltipEl
 * @param {{ referenceColorInput: HTMLInputElement, lightnessInput: HTMLInputElement, lightnessValue: HTMLElement, referenceHex: HTMLElement, showPeaksInput: HTMLInputElement }} controls
 */
export function initContrastTopology(canvas, tooltipEl, controls) {
  const scene = new ContrastTopologyScene(canvas, tooltipEl);

  const syncMeshFromControls = () => {
    const lightness = Number(controls.lightnessInput.value) / 100;
    controls.lightnessValue.textContent = `${controls.lightnessInput.value}%`;
    controls.referenceHex.textContent =
      controls.referenceColorInput.value.toUpperCase();
    scene.updateMesh(controls.referenceColorInput.value, lightness);
  };

  controls.referenceColorInput.addEventListener("input", syncMeshFromControls);
  controls.lightnessInput.addEventListener("input", syncMeshFromControls);
  controls.showPeaksInput.addEventListener("change", () => {
    scene.setPeakMarkersEnabled(controls.showPeaksInput.checked);
  });
  scene.setPeakMarkersEnabled(controls.showPeaksInput.checked);
  syncMeshFromControls();

  return scene;
}

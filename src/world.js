import * as THREE from "three";
import { LAYERS, layerById } from "./records.js";
import { hashString, layoutEntries } from "./layout.js";

function textSprite(text, options = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = options.width ?? 512;
  canvas.height = options.height ?? 128;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = options.color ?? "#f4efe6";
  context.font = options.font ?? "500 68px Georgia, serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(options.scaleX ?? 16, options.scaleY ?? 4, 1);
  return sprite;
}

function layerGeometry(id) {
  if (id === "academic") return new THREE.BoxGeometry(0.2, 0.74, 0.2);
  if (id === "literary") return new THREE.OctahedronGeometry(0.34, 0);
  if (id === "faint-concept") return new THREE.SphereGeometry(0.15, 8, 6);
  if (id === "private-symbol") return new THREE.TetrahedronGeometry(0.36, 0);
  if (id === "unspoken-framework") return new THREE.BoxGeometry(0.14, 1.2, 0.14);
  return new THREE.SphereGeometry(0.22, 10, 8);
}

export class EnglishWorld {
  constructor(canvas, labelRoot) {
    this.canvas = canvas;
    this.labelRoot = labelRoot;
    this.entries = [];
    this.positions = new Map();
    this.visible = new Map(LAYERS.map((layer) => [layer.id, true]));
    this.meshes = [];
    this.sprites = [];
    this.keys = new Set();
    this.dragging = false;
    this.moved = 0;
    this.intro = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.reduced = !this.intro;
    this.yaw = 0;
    this.pitch = -0.28;
    this.glide = null;
    this.onSelect = () => {};
    this.selectedId = null;
    this.pointer = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.project = new THREE.Vector3();
    this.labelPool = [];

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c0f12);
    this.scene.fog = new THREE.FogExp2(0x0c0f12, 0.0075);
    this.camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 600);
    this.camera.rotation.order = "YXZ";
    this.camera.position.set(8, 42, 132);
    this.clock = new THREE.Clock();
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();

    this.scene.add(new THREE.HemisphereLight(0xc5d0dc, 0x1a140f, 0.55));
    const moon = new THREE.DirectionalLight(0xf2e6d0, 1.35);
    moon.position.set(-40, 80, 30);
    this.scene.add(moon);

    this.sea = new THREE.Mesh(
      new THREE.PlaneGeometry(520, 520, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x10161c, roughness: 1, metalness: 0 }),
    );
    this.sea.rotation.x = -Math.PI / 2;
    this.scene.add(this.sea);

    for (const layer of LAYERS) {
      const ground = new THREE.Mesh(
        new THREE.CircleGeometry(layer.radius, 64),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(layer.color).multiplyScalar(0.18),
          roughness: 1,
          metalness: 0,
        }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(layer.x, layer.raise, layer.z);
      this.scene.add(ground);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(layer.radius * 0.98, 0.08, 8, 80),
        new THREE.MeshBasicMaterial({ color: layer.color, transparent: true, opacity: 0.45 }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(layer.x, layer.raise + 0.08, layer.z);
      this.scene.add(ring);

      const title = textSprite(layer.name, { color: layer.color, scaleX: layer.radius * 0.7, scaleY: 3.2 });
      title.position.set(layer.x, layer.raise + 9, layer.z);
      this.scene.add(title);

      const lamp = new THREE.PointLight(layer.color, 8, layer.radius * 3.2, 2);
      lamp.position.set(layer.x, layer.raise + 6, layer.z);
      this.scene.add(lamp);
    }

    this.frameGroup = this.makeFramework();
    this.scene.add(this.frameGroup);

    this.dust = this.makeDust();
    this.scene.add(this.dust);

    this.marker = new THREE.Mesh(
      new THREE.TorusGeometry(0.72, 0.045, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xf4efe6 }),
    );
    this.marker.rotation.x = Math.PI / 2;
    this.marker.visible = false;
    this.scene.add(this.marker);

    this.minimap = document.querySelector("#minimap");
    this.mapContext = this.minimap.getContext("2d");
    this.bind();
    this.syncLook();
    this.frame = requestAnimationFrame(() => this.animate());
  }

  makeFramework() {
    const group = new THREE.Group();
    const layer = layerById("unspoken-framework");
    const material = new THREE.MeshBasicMaterial({
      color: layer.color,
      transparent: true,
      opacity: 0.28,
    });
    for (let i = 0; i < 4; i += 1) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(6 + i * 3.2, 0.05, 8, 48, Math.PI), material);
      arch.position.set(layer.x, layer.raise, layer.z);
      arch.rotation.y = i * 0.4;
      group.add(arch);
    }
    return group;
  }

  makeDust() {
    const count = 500;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 280;
      positions[i * 3 + 1] = Math.random() * 40 + 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 280;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ color: 0xd9d3c6, size: 0.18, transparent: true, opacity: 0.45 }),
    );
  }

  bind() {
    this.onPointerDown = (event) => {
      if (event.button !== 0) return;
      this.dragging = true;
      this.moved = 0;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      this.intro = false;
      this.glide = null;
      this.canvas.classList.add("dragging");
    };
    this.onPointerMove = (event) => {
      if (!this.dragging) return;
      const dx = event.clientX - this.lastX;
      const dy = event.clientY - this.lastY;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      this.moved += Math.abs(dx) + Math.abs(dy);
      this.yaw -= dx * 0.005;
      this.pitch = Math.max(-1.15, Math.min(1.15, this.pitch - dy * 0.005));
      this.syncLook();
    };
    this.onPointerUp = (event) => {
      const wasDrag = this.moved > 5;
      this.dragging = false;
      this.canvas.classList.remove("dragging");
      if (!wasDrag) this.pick(event.clientX, event.clientY);
    };
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    this.onKeyDown = (event) => {
      if (this.typing()) return;
      this.keys.add(event.key.toLowerCase());
      if ([" ", "arrowup", "arrowdown"].includes(event.key.toLowerCase())) event.preventDefault();
      this.intro = false;
      this.glide = null;
    };
    this.onKeyUp = (event) => this.keys.delete(event.key.toLowerCase());
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.onResize = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", this.onResize);
    this.minimap.parentElement.addEventListener("click", (event) => {
      const rect = this.minimap.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 340 - 170;
      const z = ((event.clientY - rect.top) / rect.height) * 340 - 170;
      this.glideTo(new THREE.Vector3(x, 18, z), new THREE.Vector3(x, 2, z));
    });
  }

  typing() {
    const element = document.activeElement;
    return element && (element.tagName === "INPUT" || element.tagName === "TEXTAREA");
  }

  syncLook() {
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  setEntries(entries) {
    this.entries = entries;
    this.positions = layoutEntries(entries);
    this.rebuildWords();
    this.drawMap();
  }

  rebuildWords() {
    for (const mesh of this.meshes) {
      mesh.geometry.dispose();
      mesh.material.dispose();
      this.scene.remove(mesh);
    }
    for (const sprite of this.sprites) {
      sprite.material.map.dispose();
      sprite.material.dispose();
      this.scene.remove(sprite);
    }
    this.meshes = [];
    this.sprites = [];
    const grouped = new Map(LAYERS.map((layer) => [layer.id, []]));
    for (const entry of this.entries) grouped.get(entry.layer)?.push(entry);

    for (const layer of LAYERS) {
      const list = grouped.get(layer.id);
      if (!list.length) continue;
      const mesh = new THREE.InstancedMesh(
        layerGeometry(layer.id),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(layer.color).multiplyScalar(0.28),
          emissive: new THREE.Color(layer.color),
          emissiveIntensity: layer.id === "faint-concept" ? 0.35 : 0.85,
          roughness: 0.42,
          metalness: 0.04,
        }),
        list.length,
      );
      mesh.frustumCulled = false;
      mesh.userData = { entries: list, layerId: layer.id };
      list.forEach((entry, index) => {
        const position = this.positions.get(entry.id);
        const scale = entry.landmark ? 2.5 : 1;
        this.dummy.position.set(position.x, position.y, position.z);
        this.dummy.scale.setScalar(scale);
        this.dummy.rotation.set(0, (hashString(entry.word) % 628) / 100, 0);
        this.dummy.updateMatrix();
        mesh.setMatrixAt(index, this.dummy.matrix);
        this.color.set(layer.color);
        if (entry.landmark) this.color.offsetHSL(0, 0, 0.12);
        mesh.setColorAt(index, this.color);
        if (!entry.landmark) return;
        const sprite = textSprite(entry.word, {
          color: layer.color,
          width: 256,
          height: 64,
          font: "500 42px Georgia, serif",
          scaleX: 6.5,
          scaleY: 1.6,
        });
        sprite.position.set(position.x, position.y + 1.5, position.z);
        sprite.userData = { layerId: layer.id };
        sprite.visible = this.visible.get(layer.id);
        this.scene.add(sprite);
        this.sprites.push(sprite);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.visible = this.visible.get(layer.id);
      this.scene.add(mesh);
      this.meshes.push(mesh);
    }
  }

  setLayerVisible(id, visible) {
    this.visible.set(id, visible);
    for (const mesh of this.meshes) {
      if (mesh.userData.layerId === id) mesh.visible = visible;
    }
    for (const sprite of this.sprites) {
      if (sprite.userData.layerId === id) sprite.visible = visible;
    }
  }

  entryById(id) {
    return this.entries.find((entry) => entry.id === id);
  }

  focus(entry) {
    if (!entry) return;
    this.setLayerVisible(entry.layer, true);
    const position = this.positions.get(entry.id);
    if (!position) return;
    this.selectedId = entry.id;
    const target = new THREE.Vector3(position.x, position.y, position.z);
    const approach = this.camera.position.clone().sub(target);
    approach.y = 0;
    if (approach.lengthSq() < 1) approach.set(0, 0, 1);
    approach.normalize().multiplyScalar(8);
    const destination = target.clone().add(approach);
    destination.y = Math.max(position.y + 1.6, 2.2);
    this.glideTo(destination, target);
    this.marker.visible = true;
    this.marker.position.set(position.x, position.y, position.z);
    this.onSelect(entry);
  }

  glideTo(destination, target) {
    const look = this.camera.clone();
    look.position.copy(destination);
    look.lookAt(target);
    this.glide = {
      from: this.camera.position.clone(),
      to: destination.clone(),
      fromQ: this.camera.quaternion.clone(),
      toQ: look.quaternion.clone(),
      t: 0,
      duration: this.reduced ? 0.01 : 1.15,
    };
    this.intro = false;
  }

  pick(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.meshes.filter((mesh) => mesh.visible), false);
    const hit = hits[0];
    if (!hit || hit.instanceId == null) return;
    const entry = hit.object.userData.entries[hit.instanceId];
    this.focus(entry);
  }

  hold(key, down) {
    if (down) this.keys.add(key);
    else this.keys.delete(key);
    this.intro = false;
    this.glide = null;
  }

  regionName() {
    let best = null;
    let bestDistance = Infinity;
    for (const layer of LAYERS) {
      const dx = this.camera.position.x - layer.x;
      const dz = this.camera.position.z - layer.z;
      const distance = Math.hypot(dx, dz);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = layer;
      }
    }
    if (bestDistance <= best.radius) return best.name;
    return `Toward ${best.name}`;
  }

  animate() {
    this.frame = requestAnimationFrame(() => this.animate());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.sea.rotation.z = this.reduced ? 0 : this.clock.elapsedTime * 0.002;
    if (this.glide) {
      const glideStep = dt >= 1 / 240 ? dt : 1 / 60;
      this.glide.t += glideStep / this.glide.duration;
      const k = Math.min(1, this.glide.t);
      const eased = k * k * (3 - 2 * k);
      this.camera.position.lerpVectors(this.glide.from, this.glide.to, eased);
      this.camera.quaternion.slerpQuaternions(this.glide.fromQ, this.glide.toQ, eased);
      if (k >= 1) {
        this.yaw = this.camera.rotation.y;
        this.pitch = this.camera.rotation.x;
        this.glide = null;
      }
    } else {
      if (this.intro) this.yaw += dt * 0.045;
      this.syncLook();
      this.move(dt);
    }
    this.renderer.render(this.scene, this.camera);
    this.updateLabels();
    this.drawCamera();
  }

  move(dt) {
    const speed = (this.keys.has("shift") ? 38 : 18) * dt;
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const forward = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 2).multiplyScalar(-1);
    if (this.keys.has("w")) this.camera.position.addScaledVector(forward, speed);
    if (this.keys.has("s")) this.camera.position.addScaledVector(forward, -speed);
    if (this.keys.has("d")) this.camera.position.addScaledVector(right, speed);
    if (this.keys.has("a")) this.camera.position.addScaledVector(right, -speed);
    if (this.keys.has("e")) this.camera.position.y -= speed;
    if (this.keys.has("q") || this.keys.has(" ")) this.camera.position.y += speed;
    this.camera.position.y = Math.max(1.3, Math.min(96, this.camera.position.y));
    const limit = 230;
    this.camera.position.x = Math.max(-limit, Math.min(limit, this.camera.position.x));
    this.camera.position.z = Math.max(-limit, Math.min(limit, this.camera.position.z));
  }

  updateLabels() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const near = [];
    for (const entry of this.entries) {
      if (!this.visible.get(entry.layer) || entry.landmark) continue;
      const position = this.positions.get(entry.id);
      const dx = position.x - this.camera.position.x;
      const dy = position.y - this.camera.position.y;
      const dz = position.z - this.camera.position.z;
      const distance = dx * dx + dy * dy + dz * dz;
      if (distance < 38 * 38) near.push({ entry, distance });
    }
    near.sort((a, b) => a.distance - b.distance);
    const shown = near.slice(0, 18);
    while (this.labelPool.length < shown.length) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "label";
      button.addEventListener("click", () => {
        const entry = this.entryById(button.dataset.id);
        if (entry) this.focus(entry);
      });
      this.labelRoot.append(button);
      this.labelPool.push(button);
    }
    this.labelPool.forEach((button, index) => {
      const item = shown[index];
      if (!item) {
        button.hidden = true;
        return;
      }
      const position = this.positions.get(item.entry.id);
      this.project.set(position.x, position.y, position.z).project(this.camera);
      if (this.project.z > 1) {
        button.hidden = true;
        return;
      }
      button.hidden = false;
      button.dataset.id = item.entry.id;
      button.textContent = item.entry.word;
      button.style.color = layerById(item.entry.layer).color;
      button.style.left = `${(this.project.x * 0.5 + 0.5) * width}px`;
      button.style.top = `${(-this.project.y * 0.5 + 0.5) * height}px`;
    });
  }

  drawMap() {
    const ctx = this.mapContext;
    const size = this.minimap.width;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "#10141a";
    ctx.fillRect(0, 0, size, size);
    for (const layer of LAYERS) {
      const center = this.toMap(layer.x, layer.z, size);
      const radius = (layer.radius / 340) * size;
      ctx.beginPath();
      ctx.fillStyle = layer.color;
      ctx.globalAlpha = 0.85;
      ctx.arc(center.x, center.y, Math.max(4, radius), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawCamera() {
    if (!this.mapContext) return;
    this.drawMap();
    const ctx = this.mapContext;
    const spot = this.toMap(this.camera.position.x, this.camera.position.z, this.minimap.width);
    ctx.fillStyle = "#f4efe6";
    ctx.beginPath();
    ctx.arc(spot.x, spot.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  toMap(x, z, size) {
    return {
      x: ((x + 170) / 340) * size,
      y: ((z + 170) / 340) * size,
    };
  }
}

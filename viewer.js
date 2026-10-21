import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';

const OWNER = 'raphaelrichertg-png', REPO = 'SYNINC-500', BRANCH = 'main';
const MESH_DIR = 'meshes/';
const MESH_RE = /\.(obj|stl|ply)$/i;

const listEl = document.getElementById('list');
const countEl = document.getElementById('count');
const statusEl = document.getElementById('status');
const gridEl = document.getElementById('grid');
const opacityEl = document.getElementById('opacity');
const wireEl = document.getElementById('wireframe');
const linkEl = document.getElementById('linkCam');
const gridSel = document.getElementById('gridSize');

function usableColors(geo) {
  const col = geo.getAttribute('color');
  if (!col) return false;
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < col.count; i++) {
    const v = col.getX(i) + col.getY(i) + col.getZ(i);
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return (max - min) > 1e-6;
}

// drop invalid/zero/NaN normals and recompute
function fixNormals(geo) {
  const n = geo.getAttribute('normal');
  let bad = !n;
  if (!bad) {
    for (let i = 0; i < n.count; i++) {
      const l = n.getX(i) * n.getX(i) + n.getY(i) * n.getY(i) + n.getZ(i) * n.getZ(i);
      if (!(l > 0.01)) { bad = true; break; }  // catches zero and NaN
    }
  }
  if (bad) {
    geo.deleteAttribute('normal');
    geo.computeVertexNormals();
    return 'recomputed';
  }
  return 'ok';
}

class Cell {
  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'cell';
    this.label = document.createElement('div');
    this.label.className = 'label';
    this.close = document.createElement('div');
    this.close.className = 'close';
    this.close.textContent = '×';
    this.el.append(this.label, this.close);
    gridEl.appendChild(this.el);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.el.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x14171a);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.001, 10000);
    this.camera.position.set(0, 0, 2);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x555555, 1.0));
    const dir = new THREE.DirectionalLight(0xffffff, 1.5);
    dir.position.set(3, 5, 4);
    this.scene.add(dir);
    const dir2 = new THREE.DirectionalLight(0xffffff, 0.8);
    dir2.position.set(-3, -2, -4);
    this.scene.add(dir2);
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.name = null;

    this.controls.addEventListener('change', () => {
      if (linkEl.checked) syncCameras(this);
    });
    this.close.onclick = () => { this.el.remove(); this.renderer.dispose(); cells.delete(this); };
    new ResizeObserver(() => this.resize()).observe(this.el);
  }
  resize() {
    const w = this.el.clientWidth, h = this.el.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  clear() { while (this.group.children.length) this.group.remove(this.group.children[0]); }
  resetView() {
    const box = new THREE.Box3().setFromObject(this.group);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = Math.max(box.getSize(new THREE.Vector3()).length(), 1e-6);
    this.controls.target.copy(center);
    this.camera.position.copy(center).add(new THREE.Vector3(0, 0, size * 1.4));
    this.camera.near = size / 100;
    this.camera.far = size * 100;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }
  render() { this.renderer.render(this.scene, this.camera); }
}

const cells = new Set();

function syncCameras(source) {
  for (const c of cells) {
    if (c === source) continue;
    c.camera.position.copy(source.camera.position);
    c.camera.quaternion.copy(source.camera.quaternion);
    c.controls.target.copy(source.controls.target);
    c.camera.near = source.camera.near; c.camera.far = source.camera.far;
    c.camera.updateProjectionMatrix();
    c.controls.update();
  }
}

function animate() {
  for (const c of cells) c.render();
  requestAnimationFrame(animate);
}
animate();

function baseMaterial() {
  return new THREE.MeshPhongMaterial({
    color: 0xf2ead8, shininess: 30,
    transparent: true, opacity: opacityEl.value / 100,
    side: THREE.DoubleSide
  });
}

function applyStyle() {
  const op = opacityEl.value / 100, wire = wireEl.checked;
  for (const c of cells) c.group.traverse(o => {
    if (!o.isMesh && !o.isPoints) return;
    o.material.opacity = op;
    o.material.wireframe = wire;
  });
}
opacityEl.oninput = applyStyle;
wireEl.onchange = applyStyle;

async function loadInto(cell, name) {
  const url = MESH_DIR + encodeURIComponent(name);
  let object, normalsState = 'n/a';
  if (/\.stl$/i.test(name)) {
    const geo = await new Promise((ok, ko) => new STLLoader().load(url, ok, undefined, ko));
    normalsState = fixNormals(geo);
    object = new THREE.Mesh(geo, baseMaterial());
  } else if (/\.ply$/i.test(name)) {
    const geo = await new Promise((ok, ko) => new PLYLoader().load(url, ok, undefined, ko));
    normalsState = fixNormals(geo);
    const hasFaces = geo.index && geo.index.count > 0;
    const useColors = usableColors(geo);
    if (hasFaces) {
      const mat = baseMaterial();
      if (useColors) { mat.vertexColors = true; mat.color.set(0xffffff); }
      object = new THREE.Mesh(geo, mat);
    } else {
      const mat = new THREE.PointsMaterial({
        color: 0xf2ead8, size: 0.01, sizeAttenuation: true,
        transparent: true, opacity: opacityEl.value / 100
      });
      if (useColors) { mat.vertexColors = true; mat.color.set(0xffffff); }
      object = new THREE.Points(geo, mat);
    }
  } else {
    object = await new Promise((ok, ko) => new OBJLoader().load(url, ok, undefined, ko));
    object.traverse(o => { if (o.isMesh) o.material = baseMaterial(); });
  }
  cell.clear();
  cell.group.add(object);
  cell.name = name;
  cell.label.textContent = name;
  cell.resize();
  cell.resetView();
  cell.resize();
  applyStyle();

  const info = [];
  const geo = object.isPoints || object.isMesh ? object.geometry : null;
  if (geo) {
    const pos = geo.getAttribute('position');
    const box = new THREE.Box3().setFromBufferAttribute(pos);
    const s = box.getSize(new THREE.Vector3());
    info.push(object.isPoints ? 'point cloud' : 'mesh');
    info.push(pos.count + ' vertices');
    info.push(geo.index ? (geo.index.count / 3) + ' faces' : 'no faces');
    info.push('normals: ' + normalsState);
    info.push('size ' + s.x.toFixed(3) + 'x' + s.y.toFixed(3) + 'x' + s.z.toFixed(3));
  }
  return info.join(', ');
}

function pickCell() {
  for (const c of cells) if (c.name === null) return c;
  const c = new Cell();
  c.resize();
  return c;
}

let meshes = [];

async function listMeshes() {
  try {
    const r = await fetch('index.json');
    if (r.ok) {
      const j = await r.json();
      if (Array.isArray(j) && j.length)
        return j.map(e => typeof e === 'string' ? e : e.file || e.name);
    }
  } catch (e) {}
  let files = [];
  for (let page = 1; page <= 10; page++) {
    const r = await fetch('https://api.github.com/repos/' + OWNER + '/' + REPO + '/contents/meshes?ref=' + BRANCH + '&per_page=1000&page=' + page);
    if (!r.ok) throw new Error('Cannot list meshes/ (HTTP ' + r.status + ')');
    const part = await r.json();
    files = files.concat(part);
    if (part.length < 1000) break;
  }
  return files.filter(f => f.type === 'file' && MESH_RE.test(f.name)).map(f => f.name);
}

function renderList(filter) {
  listEl.innerHTML = '';
  const f = (filter || '').toLowerCase();
  const active = new Set([...cells].map(c => c.name));
  for (const name of meshes.filter(n => n.toLowerCase().includes(f))) {
    const li = document.createElement('li');
    li.textContent = name;
    li.classList.toggle('active', active.has(name));
    li.onclick = () => {
      statusEl.textContent = 'Loading ' + name + '…';
      loadInto(pickCell(), name)
        .then(info => statusEl.textContent = name + ' — ' + info)
        .catch(e => { statusEl.textContent = 'Load error: ' + e.message; console.error(e); });
    };
    listEl.appendChild(li);
  }
}
document.getElementById('search').oninput = e => renderList(e.target.value);

function setGrid(n) {
  gridEl.className = 'n' + n;
  setTimeout(() => { for (const c of cells) c.resize(); }, 50);
}
gridSel.onchange = () => setGrid(+gridSel.value);

document.getElementById('reset').onclick = () => {
  for (const c of cells) c.resetView();
  if (linkEl.checked) { const first = [...cells][0]; if (first) syncCameras(first); }
};

(async () => {
  try {
    meshes = await listMeshes();
    countEl.textContent = meshes.length + ' surfaces';
    renderList('');
    setGrid(1);
    if (meshes.length) {
      const c = pickCell();
      statusEl.textContent = 'Loading ' + meshes[0] + '…';
      const info = await loadInto(c, meshes[0]);
      statusEl.textContent = meshes[0] + ' — ' + info;
    } else statusEl.textContent = 'meshes/ folder is empty.';
  } catch (e) {
    statusEl.textContent = 'Error: ' + e.message;
    console.error(e);
    countEl.textContent = '—';
  }
})();

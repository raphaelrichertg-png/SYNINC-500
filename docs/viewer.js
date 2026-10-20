import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';

const OWNER = 'raphaelrichertg-png', REPO = 'SYNINC-500', BRANCH = 'main';
const MESH_DIR = '../meshes/';
const MESH_RE = /\.(obj|stl|ply)$/i;

const listEl = document.getElementById('list');
const countEl = document.getElementById('count');
const statusEl = document.getElementById('status');

class Viewport {
  constructor(el) {
    this.el = el;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    el.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1b1f23);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    this.camera.position.set(0, 0, 6);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x333333, 1.1));
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(3, 5, 4);
    this.scene.add(dir);
    this.group = new THREE.Group();
    this.scene.add(this.group);
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }
  resize() {
    const w = this.el.clientWidth, h = this.el.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  clear() { while (this.group.children.length) this.group.remove(this.group.children[0]); }
  add(obj) { this.group.add(obj); this.resetView(); }
  resetView() {
    const box = new THREE.Box3().setFromObject(this.group);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    this.controls.target.copy(center);
    this.camera.position.copy(center).add(new THREE.Vector3(0, 0, size));
    this.camera.near = size / 100; this.camera.far = size * 10;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }
  render() { this.renderer.render(this.scene, this.camera); }
}

const vp1 = new Viewport(document.getElementById('vp1'));
const vp2 = new Viewport(document.getElementById('vp2'));
const viewports = [vp1, vp2];

function animate() {
  for (const vp of viewports) vp.render();
  requestAnimationFrame(animate);
}
animate();

async function listMeshes() {
  // index.json first, GitHub API fallback
  try {
    const r = await fetch('../index.json');
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

async function loadMesh(vp, name) {
  const url = MESH_DIR + encodeURIComponent(name);
  let object;
  if (/\.stl$/i.test(name)) {
    const geo = await new Promise((ok, ko) => new STLLoader().load(url, ok, undefined, ko));
    object = new THREE.Mesh(geo, baseMaterial());
  } else if (/\.ply$/i.test(name)) {
    const geo = await new Promise((ok, ko) => new PLYLoader().load(url, ok, undefined, ko));
    geo.computeVertexNormals();
    const hasColor = !!geo.getAttribute('color');
    const mat = baseMaterial();
    if (hasColor) { mat.vertexColors = true; mat.color.set(0xffffff); }
    object = new THREE.Mesh(geo, mat);
  } else {
    object = await new Promise((ok, ko) => new OBJLoader().load(url, ok, undefined, ko));
    object.traverse(c => { if (c.isMesh) c.material = baseMaterial(); });
  }
  vp.clear();
  vp.add(object);
  applyStyle();
  statusEl.textContent = name;
}

function baseMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xe8e0d0, roughness: 0.45, metalness: 0.05,
    transparent: true, opacity: opacityEl.value / 100,
    side: THREE.DoubleSide
  });
}

function applyStyle() {
  const op = opacityEl.value / 100;
  const wire = wireEl.checked;
  for (const vp of viewports) {
    vp.group.traverse(c => {
      if (!c.isMesh) return;
      c.material.opacity = op;
      c.material.wireframe = wire;
    });
  }
}

let meshes = [], slots = [null, null];

function select(name, slot) {
  slots[slot] = name;
  for (const li of listEl.children) {
    const s = li.dataset.slot;
    li.classList.toggle('active', li.textContent === name && (s === undefined || +s === slot));
  }
  loadMesh(viewports[slot], name);
}

function renderList(filter) {
  listEl.innerHTML = '';
  const f = (filter || '').toLowerCase();
  for (const name of meshes.filter(n => n.toLowerCase().includes(f))) {
    const li = document.createElement('li');
    li.textContent = name;
    const slot = slots[1] !== null && !compareEl.checked ? 0 : (slots[0] === null ? 0 : 1);
    li.onclick = () => {
      if (compareEl.checked) {
        select(name, slots[0] === null || slots[0] === name ? 0 : (slots[1] === null ? 1 : 0));
      } else select(name, 0);
    };
    listEl.appendChild(li);
  }
}

const opacityEl = document.getElementById('opacity');
const wireEl = document.getElementById('wireframe');
const compareEl = document.getElementById('compare');
opacityEl.oninput = applyStyle;
wireEl.onchange = applyStyle;
compareEl.onchange = () => {
  document.getElementById('vp2').classList.toggle('hidden', !compareEl.checked);
  slots[1] = null;
  for (const vp of viewports) vp.resize();
};
document.getElementById('reset').onclick = () => viewports.forEach(vp => vp.resetView());
document.getElementById('search').oninput = e => renderList(e.target.value);

(async () => {
  try {
    meshes = await listMeshes();
    countEl.textContent = meshes.length + ' surfaces';
    renderList('');
    if (meshes.length) select(meshes[0], 0);
    else statusEl.textContent = 'meshes/ folder is empty — add your surface files.';
  } catch (e) {
    statusEl.textContent = 'Error: ' + e.message;
    countEl.textContent = '—';
  }
})();

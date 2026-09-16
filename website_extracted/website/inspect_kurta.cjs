const fs = require('fs');
const THREE = require('three');
const { GLTFLoader } = require('three/examples/jsm/loaders/GLTFLoader.js');

const buffer = fs.readFileSync('public/models/royal-elegance-kurta.glb');
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

const loader = new GLTFLoader();
loader.parse(arrayBuffer, '', (gltf) => {
  console.log('SUCCESS! Loaded Royal Elegance Kurta GLTF');
  let meshes = 0;
  gltf.scene.traverse(c => {
    if (c.isMesh) meshes++;
  });
  console.log(`Found ${meshes} meshes in Kurta!`);
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const size = new THREE.Vector3();
  box.getSize(size);
  console.log('Size:', size);
}, (err) => {
  console.error('ERROR:', err);
});

import * as THREE from './build/three.module.js'; // Adjust the path as needed
import { ARButton } from './jsm/webxr/ARButton.js';
import { OrbitControls } from './jsm/controls/OrbitControls.js';
import { GLTFLoader } from './jsm/loaders/GLTFLoader.js';
import { RGBELoader } from './jsm/loaders/RGBELoader.js';

let container;
let camera, scene, renderer;
let controller;
let reticle, pmremGenerator, current_object, controls;
let hitTestSource = null;
let hitTestSourceRequested = false;

init();
animate();

$(".ar-object").click(function(){
    loadModel($(this).attr("id"));
});

$("#ARButton").click(function(){

    current_object.visible=false;

})

//
function loadModel(buttonId) {
    let modelPath;
    // Check which button was clicked and set the corresponding model path
    switch(buttonId) {
        case "1":
            modelPath = "Burger.glb";
            break;
        case "2":
            modelPath = "steak_rice.glb";
            break;
        // Add cases for other buttons if needed
        default:
            return;
    }
    
    // Remove the current object if exists
    if (current_object) {
        scene.remove(current_object);
        current_object.visible=false;
        current_object = null;
    }
    
    // Load the model
    var loader = new GLTFLoader().setPath('3d/');
    loader.load(modelPath, function (glb) {
        current_object = glb.scene;
        scene.add(current_object);

        var box = new THREE.Box3();
        box.setFromObject(current_object);
        var center = new THREE.Vector3();
        box.getCenter(center);
        current_object.position.copy(center); // Set object's position to the center
        controls.target.copy(center); // Adjust controls target to center of the object
        controls.update(); // Update controls
        render();
    });
}


function init() {
    container = document.createElement('div');
    document.getElementById("container-canvas").appendChild(container);
    scene = new THREE.Scene();


    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 200);

    //

    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 3);
    //
    light.position.set(0.5, 1, 0.25);
    scene.add(light);




    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

    renderer.setPixelRatio(window.devicePixelRatio);

    renderer.setSize(window.innerWidth, window.innerHeight);

    renderer.xr.enabled = true;
    container.appendChild(renderer.domElement);

    pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    controls = new OrbitControls(camera, renderer.domElement);
    controls.addEventListener('change', render);
    controls.minDistance = 2;
    controls.maxDistance = 10;
    controls.target.set(0, 0, -0.2);
    controls.enableDamping=true;
    controls.dampingFactor=0.05;


    //

    document.body.appendChild(ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] }));

    const geometry = new THREE.CylinderGeometry(0.1, 0.1, 0.2, 32).translate(0, 0.1, 0);

    //
    function onSelect() {

        if (reticle.visible) {

            // const material = new THREE.MeshPhongMaterial({ color: 0xffffff * Math.random() });
            // const mesh = new THREE.Mesh(geometry, material);
            // reticle.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
            // mesh.scale.y = Math.random() * 2 + 1;
            // scene.add(mesh);
            current_object.position.setFromMatrixPosition(reticle.matrix);
            current_object.visible=true;
            
        }
    }


    controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect);
    scene.add(controller);
    reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial()
    );

    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);
    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    renderer.setAnimationLoop(render);
    requestAnimationFrame(animate); // Move this line inside the function
    controls.update();
}

function render(timestamp, frame) {
    if (frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const session = renderer.xr.getSession();
        if (hitTestSourceRequested === false) {
            session.requestReferenceSpace('viewer').then(function (referenceSpace) {
                session.requestHitTestSource({ space: referenceSpace }).then(function (source) {
                    hitTestSource = source;
                });
            });
            session.addEventListener('end', function () {
                hitTestSourceRequested = false;
                hitTestSource = null;

                reticle.visible=false;
                var box = new THREE.Box3(); // Use Box3 instead of BOX3
                box.setFromObject(current_object);
                box.getcenter(controls.target)
            });

            hitTestSourceRequested = true;
        }


        if (hitTestSource) {
            const hitTestResults = frame.getHitTestResults(hitTestSource);
            if (hitTestResults.length) {
                const hit = hitTestResults[0];
                reticle.visible = true;
                reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
            } else {
                reticle.visible = false;
            }
        }
    }
    renderer.render(scene, camera);
}

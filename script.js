import * as THREE from "./build/three.module.js";
import { ARButton } from "./jsm/webxr/ARButton.js";

import { OrbitControls } from "./jsm/controls/OrbitControls.js";
import { GLTFLoader } from "./jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "./jsm/loaders/RGBELoader.js";

var container;
var camera, scene, renderer;
var controller;

var reticle, pmremGenerator, current_object, controls, isAR, envmap;

var hitTestSource = null;
var hitTestSourceRequested = false;

init();
animate();

$(".ar-object").click(function () {
  var modelId = $(this).attr("id");
  if (current_object != null) {
    scene.remove(current_object);
  }
  loadModel(modelId);
  arPlace(); // Place the model when an item is clicked
});

$("#ARButton").click(function () {
  current_object.visible = false;
  isAR = true;
});



$("#place-button").click(function () {
  arPlace();
});

function arPlace() {
    // Remove any previously placed object
    if (current_object) {
        scene.remove(current_object);
        current_object = null;
    }

    if (reticle.visible) {
        // Check if reticle is visible
        current_object = new THREE.Mesh(/* Create your object geometry */);
        current_object.position.setFromMatrixPosition(reticle.matrix);
        scene.add(current_object);
    }
}

function loadModel(buttonId) {
    var modelPath;
  
    switch(buttonId) {
      case "1":
        modelPath = "1.glb";
        break;
  
      case "2":
        modelPath = "2.glb";
        break;
  
      default:
        return;
    }
  
    if (current_object) {
      scene.remove(current_object);
      current_object = null;
    }
  
    var loader = new GLTFLoader().setPath("3d/");
    loader.load(modelPath, function (glb) {
      current_object = glb.scene;
      scene.add(current_object);
  
      var box = new THREE.Box3();
      box.setFromObject(current_object);
      var center = new THREE.Vector3();
      box.getCenter(center);
      current_object.position.copy(center);
      controls.target.copy(center);
  
      controls.update();
      render();
    });
  }
  

function init() {
    container = document.createElement('div');
    document.getElementById('container').appendChild(container);

    scene = new THREE.Scene();
    window.scene = scene;

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.001, 200);

    var directionalLight = new THREE.DirectionalLight(0xdddddd, 1);
    directionalLight.position.set(0, 0, 1).normalize();
    scene.add(directionalLight);

    var ambientLight = new THREE.AmbientLight(0x222222);
    scene.add(ambientLight);

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
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

   

    // AR SETUP
    let options = {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay'],
    };

    options.domOverlay = { root: document.getElementById('content') };

    document.body.appendChild(ARButton.createButton(renderer, options));

    reticle = new THREE.Mesh(
        new THREE.CircleGeometry(0.1, 32), // Use CircleGeometry instead of RingBufferGeometry
        new THREE.MeshBasicMaterial()
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    window.addEventListener('resize', onWindowResize, false);

    renderer.domElement.addEventListener('touchstart', function (e) {
        e.preventDefault();
        touchDown = true;
        touchX = e.touches[0].pageX;
        touchY = e.touches[0].pageY;
    }, false);

    renderer.domElement.addEventListener('touchend', function (e) {
        e.preventDefault();
        touchDown = false;
    }, false);

    renderer.domElement.addEventListener('touchmove', function (e) {
        e.preventDefault();

        if (!touchDown) {
            return;
        }

        deltaX = e.touches[0].pageX - touchX;
        deltaY = e.touches[0].pageY - touchY;
        touchX = e.touches[0].pageX;
        touchY = e.touches[0].pageY;

        rotateObject();
    }, false);
}

  renderer.domElement.addEventListener(
    "touchmove",
    function (e) {
      e.preventDefault();

      if (!touchDown) {
        return;
      }

      deltaX = e.touches[0].pageX - touchX;
      deltaY = e.touches[0].pageY - touchY;
      touchX = e.touches[0].pageX;
      touchY = e.touches[0].pageY;

      rotateObject();
    },
    false
  );


var touchDown, touchX, touchY, deltaX, deltaY;

function rotateObject() {
  if (current_object && reticle.visible) {
    current_object.rotation.y += deltaX / 100;
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

//

function animate() {
  renderer.setAnimationLoop(render);
  requestAnimationFrame(animate);
  controls.update();
}

function render(timestamp, frame) {
  if (frame && isAR) {
    var referenceSpace = renderer.xr.getReferenceSpace();
    var session = renderer.xr.getSession();

    if (hitTestSourceRequested === false) {
      session
        .requestReferenceSpace("viewer")
        .then(function (referenceSpace) {
          session
            .requestHitTestSource({ space: referenceSpace })
            .then(function (source) {
              hitTestSource = source;
            });
        });

      session.addEventListener("end", function () {
        hitTestSourceRequested = false;
        hitTestSource = null;

        isAR = false;

        reticle.visible = false;

        document.getElementById("place-button").style.display = "none";
      });

      hitTestSourceRequested = true;
    }

    if (hitTestSource) {
      var hitTestResults = frame.getHitTestResults(hitTestSource);

      if (hitTestResults.length) {
        var hit = hitTestResults[0];

        document.getElementById("place-button").style.display = "block";

        reticle.visible = true;
        reticle.matrix.fromArray(
          hit.getPose(referenceSpace).transform.matrix
        );
      } else {
        reticle.visible = false;

        document.getElementById("place-button").style.display = "none";
      }
    }
  }

  renderer.render(scene, camera);
}

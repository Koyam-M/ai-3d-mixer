import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// --- グローバル変数 ---
const canvasContainer = document.getElementById("canvas-container");
let soundObjects = [];
let selectedObject = null;
let recordingState = "IDLE";
let isMotionPlaying = false;

// ## 1. シーンのセットアップ ##
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a2a3a);
const camera = new THREE.PerspectiveCamera(
  75,
  canvasContainer.clientWidth / canvasContainer.clientHeight,
  0.1,
  1000
);
camera.position.set(0, 10, 20);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
renderer.shadowMap.enabled = true;
canvasContainer.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = true;

// ## 2. ライトと地面 ##
const plane = new THREE.Mesh(
  new THREE.PlaneGeometry(50, 50),
  new THREE.MeshStandardMaterial({
    color: 0x888888,
    transparent: true,
    opacity: 0.5,
  })
);
plane.rotation.x = -Math.PI / 2;
plane.receiveShadow = true;
scene.add(plane);
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(5, 10, 7.5);
directionalLight.castShadow = true;
scene.add(directionalLight);

// ## 3. オーディオシステムの準備 ##
const listener = new THREE.AudioListener();
camera.add(listener);
const audioLoader = new THREE.AudioLoader();

// ## 4. 5つの音源オブジェクトを作成 ##
const sourcesSetup = [
  {
    name: "Drums",
    shape: "box",
    color: 0xff0000,
    position: new THREE.Vector3(-8, 0.5, 0),
  },
  {
    name: "Bass",
    shape: "sphere",
    color: 0x00ff00,
    position: new THREE.Vector3(-4, 0.5, 0),
  },
  {
    name: "Melody",
    shape: "cone",
    color: 0x0000ff,
    position: new THREE.Vector3(0, 0.5, 0),
  },
  {
    name: "Vocals",
    shape: "torus",
    color: 0xffff00,
    position: new THREE.Vector3(4, 0.5, 0),
  },
  {
    name: "Piano",
    shape: "cylinder",
    color: 0x800080,
    position: new THREE.Vector3(8, 0.5, 0),
  },
];
sourcesSetup.forEach((setup) => {
  let geometry;
  if (setup.shape === "box") geometry = new THREE.BoxGeometry(1, 1, 1);
  if (setup.shape === "sphere")
    geometry = new THREE.SphereGeometry(0.5, 32, 16);
  if (setup.shape === "cone") geometry = new THREE.ConeGeometry(0.5, 1, 32);
  if (setup.shape === "torus")
    geometry = new THREE.TorusGeometry(0.5, 0.2, 16, 100);
  if (setup.shape === "cylinder")
    geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: setup.color })
  );
  mesh.position.copy(setup.position);
  mesh.initialPosition = setup.position.clone();
  mesh.castShadow = true;
  mesh.name = setup.name;
  mesh.motionPath = [];
  mesh.playbackIndex = 0;
  const sound = new THREE.PositionalAudio(listener);
  mesh.add(sound);
  scene.add(mesh);
  soundObjects.push(mesh);
});

function selectObject(objectToSelect) {
  soundObjects.forEach((obj) => obj.material.emissive.setHex(0x000000));
  if (objectToSelect) {
    selectedObject = objectToSelect;
    selectedObject.material.emissive.setHex(0x555555);
  } else {
    selectedObject = null;
  }
}

// ## 5. UI要素とイベント処理 ##
const playBtn = document.getElementById("play-btn");
const stopBtn = document.getElementById("stop-btn");
const recordStartBtn = document.getElementById("record-start-btn");
const recordStopBtn = document.getElementById("record-stop-btn");
const playMotionBtn = document.getElementById("play-motion-btn");
const clearPathBtn = document.getElementById("clear-path-btn");
const rewindSelectedBtn = document.getElementById("rewind-selected-btn");
const rewindAllBtn = document.getElementById("rewind-all-btn");
const selectDrumsBtn = document.getElementById("select-drums-btn");
const selectBassBtn = document.getElementById("select-bass-btn");
const selectMelodyBtn = document.getElementById("select-melody-btn");
const selectVocalsBtn = document.getElementById("select-vocals-btn");
const selectPianoBtn = document.getElementById("select-piano-btn");
// ▼▼▼ 保存・読み込み用のUI要素を取得 ▼▼▼
const saveMotionBtn = document.getElementById("save-motion-btn");
const loadMotionBtn = document.getElementById("load-motion-btn");
const motionFileInput = document.getElementById("motion-file-input");

function handleFileUpload(event, targetObject, volumeSlider) {
  const file = event.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  const sound = targetObject.children[0];
  audioLoader.load(url, (buffer) => {
    sound.setBuffer(buffer);
    sound.setLoop(true);
    sound.setRefDistance(20);
    sound.setVolume(parseFloat(volumeSlider.value));
    URL.revokeObjectURL(url);
    playBtn.disabled = false;
    stopBtn.disabled = false;
    recordStartBtn.disabled = false;
  });
}
document
  .getElementById("drums-upload")
  .addEventListener("change", (event) =>
    handleFileUpload(
      event,
      soundObjects[0],
      document.getElementById("drums-volume")
    )
  );
document
  .getElementById("bass-upload")
  .addEventListener("change", (event) =>
    handleFileUpload(
      event,
      soundObjects[1],
      document.getElementById("bass-volume")
    )
  );
document
  .getElementById("melody-upload")
  .addEventListener("change", (event) =>
    handleFileUpload(
      event,
      soundObjects[2],
      document.getElementById("melody-volume")
    )
  );
document
  .getElementById("vocals-upload")
  .addEventListener("change", (event) =>
    handleFileUpload(
      event,
      soundObjects[3],
      document.getElementById("vocals-volume")
    )
  );
document
  .getElementById("piano-upload")
  .addEventListener("change", (event) =>
    handleFileUpload(
      event,
      soundObjects[4],
      document.getElementById("piano-volume")
    )
  );

playBtn.addEventListener("click", () => {
  listener.context.resume();
  soundObjects.forEach((obj) => {
    const sound = obj.children[0];
    if (sound.buffer && !sound.isPlaying) sound.play();
  });
});
stopBtn.addEventListener("click", () => {
  soundObjects.forEach((obj) => {
    const sound = obj.children[0];
    if (sound.buffer && sound.isPlaying) sound.stop();
  });
});
document.getElementById("drums-volume").addEventListener("input", () => {
  soundObjects[0].children[0].setVolume(
    parseFloat(document.getElementById("drums-volume").value)
  );
});
document.getElementById("bass-volume").addEventListener("input", () => {
  soundObjects[1].children[0].setVolume(
    parseFloat(document.getElementById("bass-volume").value)
  );
});
document.getElementById("melody-volume").addEventListener("input", () => {
  soundObjects[2].children[0].setVolume(
    parseFloat(document.getElementById("melody-volume").value)
  );
});
document.getElementById("vocals-volume").addEventListener("input", () => {
  soundObjects[3].children[0].setVolume(
    parseFloat(document.getElementById("vocals-volume").value)
  );
});
document.getElementById("piano-volume").addEventListener("input", () => {
  soundObjects[4].children[0].setVolume(
    parseFloat(document.getElementById("piano-volume").value)
  );
});

recordStartBtn.addEventListener("click", () => {
  if (!selectedObject) {
    alert("先に記録したいオブジェクトを選択してください。");
    return;
  }
  isMotionPlaying = false;
  playMotionBtn.textContent = "再生";
  recordingState = "ARMED";
  recordStartBtn.disabled = true;
  recordStopBtn.disabled = false;
  controls.enableRotate = false;
});
recordStopBtn.addEventListener("click", () => {
  recordingState = "IDLE";
  recordStartBtn.disabled = false;
  recordStopBtn.disabled = true;
  controls.enableRotate = true;
});
clearPathBtn.addEventListener("click", () => {
  if (selectedObject) {
    selectedObject.motionPath = [];
    selectedObject.playbackIndex = 0;
    selectedObject.position.copy(selectedObject.initialPosition);
    isMotionPlaying = false;
    playMotionBtn.textContent = "再生";
    alert(selectedObject.name + "の記録をクリアしました。");
  } else {
    alert("クリアしたいオブジェクトを選択してください。");
  }
});
playMotionBtn.addEventListener("click", () => {
  if (recordingState !== "IDLE") {
    alert("記録モード中は使用できません。");
    return;
  }
  isMotionPlaying = !isMotionPlaying;
  playMotionBtn.textContent = isMotionPlaying ? "一時停止" : "再生";
});
rewindSelectedBtn.addEventListener("click", () => {
  if (selectedObject) {
    selectedObject.position.copy(selectedObject.initialPosition);
    selectedObject.playbackIndex = 0;
    isMotionPlaying = false;
    playMotionBtn.textContent = "再生";
  } else {
    alert("初期位置に戻したいオブジェクトを選択してください。");
  }
});
rewindAllBtn.addEventListener("click", () => {
  soundObjects.forEach((obj) => {
    obj.position.copy(obj.initialPosition);
    obj.playbackIndex = 0;
  });
  isMotionPlaying = false;
  playMotionBtn.textContent = "再生";
});

selectDrumsBtn.addEventListener("click", () => selectObject(soundObjects[0]));
selectBassBtn.addEventListener("click", () => selectObject(soundObjects[1]));
selectMelodyBtn.addEventListener("click", () => selectObject(soundObjects[2]));
selectVocalsBtn.addEventListener("click", () => selectObject(soundObjects[3]));
selectPianoBtn.addEventListener("click", () => selectObject(soundObjects[4]));

// main.js の一番下にある「動きの保存・読み込みロジック」の部分を置き換える

// ▼▼▼ 動きの保存・読み込みロジック (カメラ対応版) ▼▼▼
saveMotionBtn.addEventListener("click", () => {
  if (!selectedObject || selectedObject.motionPath.length === 0) {
    alert("保存する動きが記録されているオブジェクトを選択してください。");
    return;
  }

  // ★★★ 保存データにカメラ位置を追加 ★★★
  const motionData = {
    cameraPosition: {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
    },
    motionPath: selectedObject.motionPath.map((p) => ({
      x: p.x,
      y: p.y,
      z: p.z,
    })),
  };

  const data = JSON.stringify(motionData, null, 2); // 読みやすいようにフォーマット
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${selectedObject.name}_scene.json`; // ファイル名を変更
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

loadMotionBtn.addEventListener("click", () => {
  // ★★★ オブジェクト未選択でも読み込めるように変更 ★★★
  motionFileInput.click();
});

motionFileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const sceneData = JSON.parse(e.target.result);

      // ★★★ カメラ位置を復元 ★★★
      if (sceneData.cameraPosition) {
        camera.position.set(
          sceneData.cameraPosition.x,
          sceneData.cameraPosition.y,
          sceneData.cameraPosition.z
        );
        controls.update(); // OrbitControlsにカメラの変更を通知
      }

      // ★★★ どのオブジェクトのデータかをファイル名から推測 ★★★
      const fileName = file.name.toLowerCase();
      const targetObject = soundObjects.find((obj) =>
        fileName.includes(obj.name.toLowerCase())
      );

      if (targetObject && sceneData.motionPath) {
        targetObject.motionPath = sceneData.motionPath.map(
          (p) => new THREE.Vector3(p.x, p.y, p.z)
        );
        targetObject.playbackIndex = 0;
        // 読み込んだら初期位置に移動
        targetObject.position.copy(targetObject.initialPosition);
        alert(`${targetObject.name}に動きのデータを読み込みました。`);
      } else {
        alert(
          "動きのデータは読み込みましたが、対応するオブジェクトが見つかりませんでした。"
        );
      }
    } catch (error) {
      alert(
        "ファイルの読み込みに失敗しました。有効なJSONファイルではありません。"
      );
      console.error(error);
    }
  };
  reader.readAsText(file);
  event.target.value = "";
});
// ▲▲▲ ここまで ▲▲▲

// ## 6. マウスとキーボードの操作ロジック ##
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const virtualPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
function onPointerMove(event) {
  const rect = canvasContainer.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}
canvasContainer.addEventListener("pointermove", onPointerMove);
canvasContainer.addEventListener("pointerdown", (event) => {
  onPointerMove(event);
  if (recordingState === "ARMED") {
    recordingState = "RECORDING";
    selectedObject.motionPath = [];
    selectedObject.playbackIndex = 0;
    return;
  }
  if (recordingState === "RECORDING") {
    recordingState = "ARMED";
    return;
  }
  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(soundObjects);
  if (intersects.length > 0) {
    selectObject(intersects[0].object);
  } else {
    selectObject(null);
  }
});
window.addEventListener("keydown", (event) => {
  const moveSpeed = 0.5;
  switch (event.key) {
    case "ArrowUp":
      camera.position.z -= moveSpeed;
      break;
    case "ArrowDown":
      camera.position.z += moveSpeed;
      break;
    case "ArrowLeft":
      camera.position.x -= moveSpeed;
      break;
    case "ArrowRight":
      camera.position.x += moveSpeed;
      break;
    case "q":
      camera.position.y -= moveSpeed;
      break;
    case "e":
      camera.position.y += moveSpeed;
      break;
  }
});

// ## 7. アニメーションループ ##
function animate() {
  requestAnimationFrame(animate);
  if (recordingState === "RECORDING" && selectedObject) {
    virtualPlane.setFromNormalAndCoplanarPoint(
      camera.getWorldDirection(virtualPlane.normal),
      selectedObject.position
    );
    raycaster.setFromCamera(pointer, camera);
    const targetPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(virtualPlane, targetPoint);
    if (targetPoint) {
      selectedObject.position.copy(targetPoint);
      selectedObject.motionPath.push(targetPoint.clone());
    }
    soundObjects.forEach((obj) => {
      if (obj !== selectedObject && obj.motionPath.length > 0) {
        obj.position.copy(obj.motionPath[obj.playbackIndex]);
        obj.playbackIndex = (obj.playbackIndex + 1) % obj.motionPath.length;
      }
    });
  }
  if (isMotionPlaying && recordingState === "IDLE") {
    soundObjects.forEach((obj) => {
      if (obj.motionPath.length > 0) {
        obj.position.copy(obj.motionPath[obj.playbackIndex]);
        obj.playbackIndex = (obj.playbackIndex + 1) % obj.motionPath.length;
      }
    });
  }
  controls.update();
  renderer.render(scene, camera);
}

// ## 8. リサイズ処理と開始 ##
window.addEventListener("resize", () => {
  camera.aspect = canvasContainer.clientWidth / canvasContainer.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
});
animate();

// main.js の一番下にあるAIサーバー連携部分を置き換える

// --- AIサーバー連携 (ローディング対応版) ---
const aiUploadInput = document.getElementById("ai-upload-input");
const aiUploadBtn = document.getElementById("ai-upload-btn");
const aiStatus = document.getElementById("ai-status");
const aiLoader = document.getElementById("ai-loader"); // ★ローダーを取得

aiUploadBtn.addEventListener("click", () => {
  const file = aiUploadInput.files[0];
  if (!file) {
    aiStatus.textContent = "ファイルが選択されていません。";
    return;
  }

  const formData = new FormData();
  formData.append("audioFile", file);

  // ★★★ 処理開始時にローダーを表示 ★★★
  aiStatus.textContent = "ファイルをアップロードし、分離処理を開始します...";
  aiLoader.style.display = "block"; // ローダーを表示
  aiUploadBtn.disabled = true; // ボタンを無効化

  fetch("http://localhost:3000/upload", {
    method: "POST",
    body: formData,
  })
    .then((response) => {
      if (!response.ok) {
        // サーバーがエラーを返した場合
        throw new Error(`サーバーエラー: ${response.statusText}`);
      }
      return response.json();
    })
    .then((data) => {
      console.log("サーバーからの返事:", data);

      if (data.files) {
        aiStatus.textContent = "分離成功！音源を読み込んでいます...";

        const partMapping = {
          drums: soundObjects[0],
          bass: soundObjects[1],
          other: soundObjects[2],
          vocals: soundObjects[3],
          piano: soundObjects[4],
        };

        const serverUrl = "http://localhost:3000/";
        const loadPromises = []; // ★読み込み完了を待つための仕組み

        Object.keys(partMapping).forEach((part) => {
          if (data.files[part]) {
            const targetObject = partMapping[part];
            const fileUrl = serverUrl + data.files[part];
            const sound = targetObject.children[0];

            // ★Promiseを使って非同期の読み込み処理を管理
            const promise = new Promise((resolve, reject) => {
              console.log(`${part}を ${fileUrl} から読み込みます`);
              audioLoader.load(
                fileUrl,
                (buffer) => {
                  sound.setBuffer(buffer);
                  console.log(`${targetObject.name} の音源をセットしました。`);
                  resolve(); // 成功を通知
                },
                undefined, // onProgressは使わない
                (error) => {
                  console.error(`${part}の読み込みに失敗`, error);
                  reject(error); // 失敗を通知
                }
              );
            });
            loadPromises.push(promise);
          }
        });

        // ★全ての音源の読み込みが終わったら実行
        Promise.all(loadPromises)
          .then(() => {
            playBtn.disabled = false;
            stopBtn.disabled = false;
            recordStartBtn.disabled = false;
            aiStatus.textContent = "音源の読み込み完了！再生ボタンで聴けます。";
          })
          .catch(() => {
            aiStatus.textContent = "いくつかの音源の読み込みに失敗しました。";
          })
          .finally(() => {
            // ★★★ 成功・失敗に関わらず最後にローダーを非表示 ★★★
            aiLoader.style.display = "none";
            aiUploadBtn.disabled = false;
          });
      } else {
        throw new Error("サーバーからファイル情報を受け取れませんでした。");
      }
    })
    .catch((error) => {
      console.error("エラー:", error);
      aiStatus.textContent = `エラーが発生しました: ${error.message}`;
      // ★★★ エラー時もローダーを非表示 ★★★
      aiLoader.style.display = "none";
      aiUploadBtn.disabled = false;
    });
});

import vision from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0"
import * as Webcam from "../EyeTracker2/webcam-capture.js"

const {FaceLandmarker, FilesetResolver} = vision;

let runningMode = "VIDEO";

let FaceMesh;
async function load() {
  // Read more `CopyWebpackPlugin`, copy wasm set from "https://cdn.skypack.dev/node_modules" to `/wasm`
  const filesetResolver = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
  );
  FaceMesh = await FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
      delegate: "GPU"
    },
    outputFaceBlendshapes: true,
    runningMode,
    numFaces: 1
  });
}
await load();

Webcam.setPredictor(async (i) => {
  let res = FaceMesh.detectForVideo(Webcam.Video, Date.now());
  return res;
})

export {FaceMesh, Webcam}

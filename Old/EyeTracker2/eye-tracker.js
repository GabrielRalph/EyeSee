import {copyFrame, setPredictor, addPredictionListener, startWebcam, stopWebcam, stopPredictions, startPredictions} from "./webcam-capture.js"

let lastEyePatches = null;

function clearCalibration(){
  FaceTracker.clear();
}

function addCalibrationPoint(screenX, screenY, type = "click") {
  if (lastEyePatches) {
    try {
      FaceTracker.addData(lastEyePatches, [screenX, screenY], type)
    } catch (e) {
      console.log(e);
    }
  }
}

async function predictEyes(input){
  let {FaceTracker} = window;
  let eyePos = null;
  // capture webcam frame into canvas
  let eyePatches = null;
  // get eye patches
  let faces = await FaceTracker.predictFaces(input.video);
  input.faces = faces;
  eyePatches = FaceTracker.getEyePatches(faces, input.canvas);
  lastEyePatches = eyePatches;

  // attempt to predict location of eyes
  eyePos = FaceTracker.predictIrises(eyePatches);


  return eyePos;
}

setPredictor(predictEyes);

export {copyFrame, addCalibrationPoint, clearCalibration, startWebcam, stopWebcam, startPredictions, stopPredictions, addPredictionListener}

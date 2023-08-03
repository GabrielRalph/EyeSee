import * as FaceMesh from "./FeatureExtraction/FaceMesh.js"
import {extractEyeFeatures} from "./FeatureExtraction/extractEyeFeatures.js"
import * as Webcam from "./Utilities/Webcam.js"
import {ridgereg, KalmanFilter} from "./RidgeReg/ridgereg.js"

const SampleMethods = {
  "steady": "head is kept still whilst calibrating",
  "moving": "head is moving whilst calibrating",
}

let MSteady = null;
let MMAdjust = null;

let SampleData = [];
let MethodID = null;
let is_sampling = false;
let GetScreenPosition = null;

function linspace(start, end, incs) {
  let range = end - start;
  let dx = range / (incs - 1);
  let space = [];
  for (let i = 0; i < incs; i ++) space.push(start + i * dx);
  return space;
}
function sampleSelect(points, percentsamp){
  let samples = [];
  let remainder = [];
  let num_samples = Math.round(points.length * percentsamp);
  let tps = linspace(0, points.length - 1, num_samples);
  for (let pi = 0, si = 0; pi < points.length; pi++) {
    if (pi == Math.round(tps[si])) {
      samples.push(points[pi]);
      si++;
    } else {
      remainder.push(points[pi]);
    }
  }
  return [samples, remainder];
}
function trainRidgeReg(train, k = 1e-5){
  let mx = ridgereg(train.map(u => [u.y.x]), train.map(u => u.X), k);
  let my = ridgereg(train.map(u => [u.y.y]), train.map(u => u.X), k);
  return {
    mx: mx,
    my: my,
    predict: (X) => {
      let v = new Vector(0)
      for (let i = 0; i < X.length; i++) {
        v.x += X[i] * mx[i];
        v.y += X[i] * my[i];
      }
      return v;
    }
  }
}
function getEyePixelFeature(X) {
  let newX = [...X.pixels.left, ...X.pixels.right];
}
function getEyeGeometryFeature(X, yp1) {
  let newX = [];
  for (let key of X.boxes)
  for (let i = 0; i < 3; i++) {
    for (let comp of "xyz") {
      newX.push(X.boxes[key][i].v3d[comp])
    }
  }
  newX.push(yp1.x);
  newX.push(yp1.y);
}
function predictScreenPosition(X) {
  let y2 = null;
  if (MSteady != null && MMAdjust != null) {
    let Xp = getEyePixelFeature(X);
    let yp1 = MSteady.predict(Xp);
    let Xg = getEyeGeometryFeature(X, yp1);
    y2 = MMAdjust.predict(Xg);
  }
  return y2;
}
function sample(features) {
  if (is_sampling && GetScreenPosition instanceof Function) {
    features.method = MethodID;
    SampleData.push({X: features, y: GetScreenPosition()})
  }
}
function processFrame(input) {
  let points = FaceMesh.getFacePointsFromVideo(input.video);
  if (!("left" in points)) throw 'No face detected'
  input.points = points;

  let features = extractEyeFeatures(points, input.canvas);
  input.features = features;

  sample(features);

  let position = predictScreenPosition(features);

  return position;
}

export function trainModel(sampleRate){
  Webcam.stopProcessing();
  let steady = [];
  for (let {X, y} of SampleData) {
    if (X.method === "steady") {
      X = getEyePixelFeature(X);
      steady.push({X, y});
    }
  }

  let [train1, validation1] = sampleSelect(steady, sampleRate);
  let MSteady = trainRidgeReg(train1);

  let moving = [];
  for (let {X, y} of SampleData) {
    let Xp = getEyePixelFeature(X);
    let yp1 = MSteady.predict(Xp);
    let Xg = getEyeGeometryFeature(X, yp1);
    moving.push({X: Xg, y: y});
  }

  let [train2, validation2] = sampleSelect(moving, sampleRate);
  let MMAdjust = trainRidgeReg(train2);
  Webcam.startProcessing();
}
export function startSampling(methodID){
  if (methodID in SampleMethods) {
    MethodID = methodID;
    is_sampling = true;
  } else {
    throw "not a valid sampling method"
  }
}
export function stopSampling(){
  is_sampling = false;
}
export function setCalibrationPositionGetter(posGetter) {
  if (posGetter instanceof Function) {
    GetPosition = posGetter;
  }
}

Webcam.setProcess((input) => processFrame(input));

import * as FaceMesh from "./FeatureExtraction/FaceMesh.js"
import {extractEyeFeatures} from "./FeatureExtraction/extractEyeFeatures.js"
import * as Webcam from "./Webcam.js"
import {ridgereg, KalmanFilter} from "./RidgeReg/ridgereg.js"
import {Vector} from "../../SvgPlus/vector.js"
import {linspace} from "../../Utilities/usefull-funcs.js"

const SampleMethods = {
  "steady": "head is kept still whilst calibrating",
  "moving": "head is moving whilst calibrating",
}

let MSteady = null;
let MMAdjust = null;
let KFilter = null;

let SampleData = [];
let MethodID = null;
let is_sampling = false;
let GetScreenPosition = null;


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
function trainRidgeReg(train, k = Math.pow(10, -5)){
  console.log(train);
  let X = train.map(u => u.X)
  let mx = ridgereg(train.map(u => [u.y.x]), X, k);
  let my = ridgereg(train.map(u => [u.y.y]), X, k);
  console.log(mx, my);
  return {
    mx: mx,
    my: my,
    predict: (newX) => {
      let v = new Vector(0)
      for (let i = 0; i < newX.length; i++) {
        v.x += newX[i] * mx[i];
        v.y += newX[i] * my[i];
      }
      return v;
    }
  }
}
function getEyePixelFeature(X) {
  return [...X.left.pixels, ...X.right.pixels];
}
function getEyeGeometryFeature(X, yp1) {
  let newX = [];
  for (let key of ["left", "right"]) {
    for (let pname of ["topLeft", "bottomLeft", "topRight"]) {
      for (let comp of "xyz") {
        newX.push(X[key].box[pname].v3d[comp])
      }
    }
  }
  newX.push(yp1.x);
  newX.push(yp1.y);
  return newX;
}
function predictScreenPosition(X) {
  let y2 = null;
  if (MSteady != null && MMAdjust != null) {
    let Xp = getEyePixelFeature(X);
    let yp1 = MSteady.predict(Xp);
    // console.log(yp1);
    let Xg = getEyeGeometryFeature(X, yp1);
    // console.log(Xg,MMAdjust);
    y2 = MMAdjust.predict(Xg);
    y2 = new Vector(KFilter.update([y2.x, y2.y]));
    // console.log(y2);
  }
  return y2;
}
function sample(features) {
  if (is_sampling && GetScreenPosition instanceof Function) {
    features.method = MethodID;
    // console.log(features);
    SampleData.push({X: features, y: GetScreenPosition()})
  }
}
function processFrame(input) {
  let points = FaceMesh.getFacePointsFromVideo(input.video);
  input.points = points;

  let features = extractEyeFeatures(points, input.canvas);
  input.features = features;

  if (features.errors) {
    // console.log(features.errors);
    throw features.errors;
  }

  sample(features);

  let position = predictScreenPosition(features);
  // console.log(position);
  return position;
}

export function trainModel(sampleRate = 0.8){
  Webcam.stopProcessing();
  // console.log(SampleData);
  let steady = [];
  for (let {X, y} of SampleData) {
    if (X.method === "steady") {
      X = getEyePixelFeature(X);
      steady.push({X, y});
    }
  }
  // console.log(steady);
  let [train1, validation1] = sampleSelect(steady, sampleRate);
  MSteady = trainRidgeReg(train1);

  let moving = [];
  for (let {X, y} of SampleData) {
    let Xp = getEyePixelFeature(X);
    let yp1 = MSteady.predict(Xp);
    let Xg = getEyeGeometryFeature(X, yp1);
    moving.push({X: Xg, y: y});
  }

  let [train2, validation2] = sampleSelect(moving, sampleRate);
  MMAdjust = trainRidgeReg(train2);
  KFilter = KalmanFilter.default();
  // window.requestAnimationFrame(() =>
  Webcam.startProcessing();//);

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
    GetScreenPosition = posGetter;
  }
}

Webcam.setProcess((input) => processFrame(input));

export {Webcam}

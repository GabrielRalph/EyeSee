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
let MComb = null;
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
  // console.log(train);
  let X = train.map(u => u.X)
  let mx = ridgereg(train.map(u => [u.y.x]), X, k);
  let my = ridgereg(train.map(u => [u.y.y]), X, k);
  // console.log(mx, my);
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
function getCombFeature(X) {
  let X2 = [...X.left.pixels, ...X.right.pixels];
  for (let key of ["left", "right"]) {
    for (let pname of ["topLeft", "bottomLeft", "topRight"]) {
      for (let comp of "xyz") {
        X2.push(X[key].box[pname].v3d[comp])
      }
    }
  }
  return X2;
}
function predictScreenPosition(X, kfilter = true) {
  let y2 = null;
  if (MComb != null) {
    let Xp = getCombFeature(X);
    // let yp1 = MSteady.predict(Xp);
    // console.log(yp1);
    // let Xg = getEyeGeometryFeature(X, yp1);
    // console.log(Xg,MMAdjust);
    y2 = MComb.predict(Xp);
    if (kfilter) y2 = new Vector(KFilter.update([y2.x, y2.y]));
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

function getDeltaStats(vecs){
  let sum = new Vector(0);
  for (let v of vecs) sum = sum.add(v);
  let mean = sum.div(vecs.length);

  let ss = 0;
  for (let v of vecs) {
    let e = v.dist(mean);
    ss += e * e;
  }
  let std = Math.sqrt(ss/vecs.length);
  return {mean, std};
}

function getRegionStats(yp, yr, gsize = 5){
  let positions = {};
  for (let i = 0; i < yp.length; i++) {
    let gy = yr[i].mul(gsize).floor();
    let ip = gy.x + gy.y * gsize;
    if (!(ip in positions)) positions[ip] = [];
    positions[ip].push(yp[i].sub(yr[i]));
  }

  for (let i in positions) {
    positions[i] = getDeltaStats(positions[i]);
  }

  return positions;
}

function validateModel(m, val){
  // let vdata = [...v1, ...v2];
  // let e = null;
  //   // check filter errors
  //   let mcompv = [];
  //   let deltas = val.map(({X, y}) => MComb.predict(X).sub(y));
  //   let stats = getDeltaStats(deltas);
  //
  //   let fdeltas = SampleData.map(({X, y}) => {
  //     let yp = m.predict(getCombFeature(X));
  //     let yf = new Vector(KFilter.update([yp.x, yp.y]));
  //     return yf.sub(y);
  //   });
  //
  //   let filt_stats = getDeltaStats(fdeltas);
  //   console.log("no filter ", stats);
  //   console.log("filter ", filt_stats);
  //   // for (let {oldX, y} of vdata) {
  //   //   let Xp = getEyePixelFeature(oldX);
  //   //   let yp1 = MSteady.predict(Xp);
  //   //   ve.steady.push(yp1.sub(y));
  //   //   // console.log(yp1);
  //   //   let Xg = getEyeGeometryFeature(oldX, yp1);
  //   //   // console.log(Xg,MMAdjust);
  //   //   let y2 = MMAdjust.predict(Xg);
  //   //   ve.adjust.push(y2.sub(y));
  //   // }
  //   //
  //   // for (let {X, y} of SampleData) {
  //   //   yr.push(y);
  //   //
  //   //   let Xp = getEyePixelFeature(X);
  //   //   let yp1 = MSteady.predict(Xp);
  //   //   te.steady.push(yp1.sub(y));
  //   //   // console.log(yp1);
  //   //   let Xg = getEyeGeometryFeature(X, yp1);
  //   //   // console.log(Xg,MMAdjust);
  //   //   let y2 = MMAdjust.predict(Xg);
  //   //   te.adjust.push(y2.sub(y));
  //   //
  //   //   y2 = new Vector(KFilter.update([y2.x, y2.y]));
  //   //   te.kalman.push(y2);
  //   // }
  //   //
  //   //
  //   // for (let key in ve) {
  //   //   ve[key] = getDeltaStats(ve[key]);
  //   // }
  //   // for (let key in te) {
  //   //   te[key] = getRegionStats(te[key], yr);
  //   // }
  //   //
  //   e = {stats, filt_stats}
  // }
  //
  // return e;
}

export function trainModel(sampleRate = 0.8){
  Webcam.stopProcessing();
  // console.log(SampleData);
  // let steady = [];
  // for (let {X, y} of SampleData) {
  //   if (X.method === "steady") {
  //     let newX = getEyePixelFeature(X);
  //     steady.push({X: newX, y: y, oldX: X});
  //   }
  // }

  // console.log(steady);
  // let [train1, validation1] = sampleSelect(steady, sampleRate);
  // MSteady = trainRidgeReg(train1);

  // let moving = [];
  let comb = [];
  for (let {X, y} of SampleData) {
    // let Xp = getEyePixelFeature(X);
    // let yp1 = MSteady.predict(Xp);
    // let Xg = getEyeGeometryFeature(X, yp1);
    // moving.push({X: Xg, y: y, oldX: X});
    // if (X.method === "moving") {
      comb.push({X: getCombFeature(X), y: y});
    // }
  }

  // let [train2, validation2] = sampleSelect(moving, sampleRate);
  let [train, val] = sampleSelect(comb, sampleRate);
  // MMAdjust = trainRidgeReg(train2);
  KFilter = KalmanFilter.default();

  let error = null;
  let train2 = train;
  let models = [];
  for (let itt = 0; itt < 4; itt++) {
    console.log("train itteration", itt + 1);
    console.log("data length", train2.length);
    let M = trainRidgeReg(train2);
    let deltas = train.map(({X, y}) => M.predict(X).sub(y));
    let vdeltas = val.map(({X, y}) => M.predict(X).sub(y));
    let stdval = getDeltaStats(vdeltas).std;
    let {std} = getDeltaStats(deltas);
    console.log("model error", std);
    console.log("valid error", stdval);
    console.log("\n");
    M.std = stdval;
    M.itteration = itt+1;
    models.push(M);
    train2 = train.filter(({X, y}) => M.predict(X).dist(y)/std < 1);
    // console.log(deltas.map((d) => d.norm()/std));
  }

  MComb = models[models.length - 1];
  console.log(`Model ${MComb.itteration} was choosen`);



  Webcam.startProcessing();
  SampleData = [];
  return MComb;
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

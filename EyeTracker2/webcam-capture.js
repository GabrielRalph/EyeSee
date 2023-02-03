let Canvas = document.createElement("canvas");
let Ctx = Canvas.getContext("2d", {willReadFrequently: true});
let Video = document.createElement("video");
Video.setAttribute("autoplay", "true");
let Stream = null;
let Predictor = null;

let predictionListeners = [];
function addPredictionListener(listener) {
  if (listener instanceof Function) {
    predictionListeners.push(listener);
  }
}

function setPredictor(algorithm){
  if (algorithm instanceof Function) {
    Predictor = algorithm;
  }
}

async function makePrediction(){
  captureFrame();
  let input = {video: Video, canvas: Canvas, context: Ctx}
  if (Predictor instanceof Function){
    try {
      input.prediction = await Predictor(input);
    } catch (e) {
      input.error = e;
    }
  }
  for (let listener of predictionListeners) {
    try {
      listener(input);
    } catch (e) {
      console.log(e);
    }
  }
}

async function parallel() {
  let res = [];
  for (let argument of arguments) {
    res.push(await argument);
  }
  return res;
}

let webcam_on = false;

const camParams = { video: { width: { min: 320, ideal: 640, max: 1920 }, height: { min: 240, ideal: 480, max: 1080 }, facingMode: "user" } };

async function nextFrame(){
  return new Promise((resolve, reject) => {
    window.requestAnimationFrame(resolve);
  })
}

function setUserMediaVariable(){
  if (navigator.mediaDevices === undefined) {
    navigator.mediaDevices = {};
  }

  if (navigator.mediaDevices.getUserMedia === undefined) {
    navigator.mediaDevices.getUserMedia = function(constraints) {

      // gets the alternative old getUserMedia is possible
      var getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

      // set an error message if browser doesn't support getUserMedia
      if (!getUserMedia) {
        return Promise.reject(new Error("Unfortunately, your browser does not support access to the webcam through the getUserMedia API. Try to use the latest version of Google Chrome, Mozilla Firefox, Opera, or Microsoft Edge instead."));
      }

      // uses navigator.getUserMedia for older browsers
      return new Promise(function(resolve, reject) {
        getUserMedia.call(navigator, constraints, resolve, reject);
      });
    }
  }
}

async function startWebcam(params = camParams){
  webcam_on = false;
  try {
    setUserMediaVariable();
    let stream = await navigator.mediaDevices.getUserMedia( params );
    Stream = stream;
    Video.srcObject = stream;
    webcam_on = true;
  } catch (e) {
    console.log(e);
  }
  console.log(webcam_on);
  return webcam_on;
}

function stopWebcam(){
  try {
    for (let track of Stream.getTracks()) {
      track.stop();
    }
  } catch(e) {}
}

var stopCapture = false;
let capturing = false;
async function startPredictions(){
  if (capturing) return;
  capturing = true;
  while (!stopCapture) {
    // console.log(stopCapture);
    await parallel(makePrediction(), nextFrame());
  }
  capturing = stopCapture;
}

function stopPredictions() {
  // console.log("stop prediction");
  stopCapture = true;
}

function captureFrame(){
  Canvas.width = Video.videoWidth;
  Canvas.height = Video.videoHeight;

  let {width, height} = Canvas;

  Ctx.drawImage(Video, 0, 0, Canvas.width, Canvas.height);
}

async function waitForReady(){

}

export {setPredictor, addPredictionListener, startWebcam, stopWebcam, stopPredictions, startPredictions}

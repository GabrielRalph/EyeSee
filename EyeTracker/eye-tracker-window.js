import {SvgPlus, Vector} from "../SvgPlus/4.js"

async function parallel() {
  let res = [];
  for (let argument of arguments) {
    res.push(await argument);
  }
  return res;
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

const camParams = { video: { width: { min: 320, ideal: 640, max: 1920 }, height: { min: 240, ideal: 480, max: 1080 }, facingMode: "user" } };

class EyeTrackerWindow extends SvgPlus {
  constructor(el) {
    super(el);
    this.predictionFrequency = 30;// Hz
  }

  onconnect(){
    this.styles = {background: "white"}

    this.message = this.querySelector("[name = 'message']");
    this.errorMessage = this.querySelector("[name = 'error']");
    this.innerHTML = "";

    let video = document.createElement("video");
    video.toggleAttribute("autoplay", true);
    video.toggleAttribute("muted", true);

    let canvas = document.createElement("canvas");

    this.video = video;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", {willReadFrequently: true});
  }

  async fade(element, time, fadeIn) {
    await this.waveTransition((a) => {
      element.style.setProperty("opacity", a);
    }, time, fadeIn);
  }

  async animateStartMessage(){
    this.innerHTML = "";
    let {message} = this;
    let pointer = message.querySelector(".pointer");

    message.style.opacity = 0;
    this.appendChild(message);
    await this.fade(message, 350, true);
    await this.fade(pointer, 500, false);
    await this.fade(pointer, 500, true);

    await this.fade(message, 350, false);
  }

  async showErrorMessage(){
    this.innerHTML = "";
    let {errorMessage} = this;
    let tryAgain = errorMessage.querySelector("[name = 'try-again']");
    let home = errorMessage.querySelector("[name = 'home']");

    errorMessage.style.opacity = 0;
    this.appendChild(errorMessage);

    return new Promise(async (resolve, reject) => {
      tryAgain.onclick = () => {
        resolve(true);
      }
      home.onclick = () => {
        resolve(false);
      }
      this.fade(errorMessage, 350, true);
    });
  }

  stop(){
    this.stopPredictions();
    if (this.webcamStream) {
      for (let track of this.webcamStream.getTracks()) {
        track.stop();
      }
      this.webcamStream = null;
    }
  }
  async start(){
    if (this.__starting) return;
    this.__starting = true;
    this.styles = {display: "block", opacity: 1};
    let done = false;
    let webCamStarted = false;
    while (!done) {
      webCamStarted = (await parallel(this.startWebcam(), this.animateStartMessage()))[0];
      if (webCamStarted) {
        done = true;
      } else {
        done = !(await this.showErrorMessage());
      }
    }

    if (webCamStarted) {
      await this.fade(this, 350, false);
      this.styles = {display: "none"}
      this.startPredictions();
    }
    this.__starting = false;
    return webCamStarted;
  }

  set pointerPos(pos) {
    if (pos !== null) {
      let smf = (2)/15;
      let v = new Vector(pos);

      if (this.position instanceof Vector) {
        v = v.mul(smf).add(this.position.mul(1 - smf))
      }

      this.position = v;
    }
  }

  async startWebcam(){
    let {video} = this;
    this.started = null;
    try {
      setUserMediaVariable();
      let stream = await navigator.mediaDevices.getUserMedia( camParams );
      this.webcamStream = stream;
      video.srcObject = stream;
    } catch (e) {
      this.started = false;
      return false;
    }
    this.started = true;
    return true;
  }
  captureFrame(){
    let {canvas, video, ctx} = this;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    let {width, height} = canvas;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  }


  startPredictions(){
    if (this.started) {
      let stop = false;
      this.stopPredictions = () => {
        stop = true;
      }
      let next = async () => {
        try {
          await this.makePrediction();
        } catch (e) {
        }
        if (!stop) {
          setTimeout(next, 1000/this.predictionFrequency);
        }
      }
      setTimeout(next, 1000/this.predictionFrequency);
    }
  }
  stopPredictions(){}

  addCalibrationPoint(screenX, screenY, type = "click") {
    if (this.lastEyePatches) {
      FaceTracker.addData(this.lastEyePatches, [screenX, screenY], type)
    }
  }

  async makePrediction(){
    let {video, canvas} = this;
    let {FaceTracker} = window;
    if (FaceTracker) {

      // capture webcam frame into canvas
      this.captureFrame();
      let eyePatches = null;

      // get eye patches
      try {
        let faces = await FaceTracker.predictFaces(video);
        eyePatches = FaceTracker.getEyePatches(faces, canvas);
      } catch (e) {
      }
      // if (eyePatches) {
      //   let {right, left} = eyePatches;
      //   this.lefteye.width = left.width;
      //   this.lefteye.height = left.height;
      //   this.lefteye.getContext('2d').putImageData(left.patch, 0, 0);
      //   this.righteye.width = right.width;
      //   this.righteye.height = right.height;
      //   this.righteye.getContext('2d').putImageData(right.patch, 0, 0);
      // }

      this.lastEyePatches = eyePatches;

      // attempt to predict location of eyes
      let eyePos = null;
      try {
        eyePos = FaceTracker.predictIrises(eyePatches);
      } catch (e) {
      }

      // update position and dispatch prediction event
      this.pointerPos = eyePos;
      if (eyePos)
        eyePos = new Vector(eyePos);
      const event = new Event("prediction");
      event.position = eyePos;
      this.dispatchEvent(event);
    }
  }
}

SvgPlus.defineHTMLElement(EyeTrackerWindow);
export {EyeTrackerWindow}

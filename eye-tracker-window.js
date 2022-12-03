import {SvgPlus, Vector} from "./SvgPlus/4.js"

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
  }


  onconnect(){
    let video = this.createChild("video");
    video.toggleAttribute("autoplay", true);
    video.toggleAttribute("muted", true);

    let canvas = this.createChild("canvas");

    // this.pointer = this.createChild("div", {class: "pointer"})
    this.video = video;
    this.canvas = canvas;
    window.onclick = (e) => {
      this.addCalibrationPoint(e.x, e.y);
    }
  }


  ondblclick(){this.start();}


  async start(){
    if (await this.startWebcam()) {
      setInterval(async () => {
        await this.makePrediction();
      }, 50)
    }
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
      console.log(stream);
      video.srcObject = stream;
    } catch (e) {
      this.started = false;
      return false;
    }
    this.started = true;
    return true;
  }

  captureFrame(){
    let {canvas, video} = this;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    let {width, height} = canvas;

    let ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  }

  addCalibrationPoint(screenX, screenY, type = "click") {
    if (this.lastEyePatches) {
      FaceTracker.addData(this.lastEyePatches, [screenX, screenY], type)
    }
  }

  async makePrediction(){
    let {video, canvas} = this;
    let {FaceTracker} = window;
    if (FaceTracker) {
      try {
        this.captureFrame();
        let faces = await FaceTracker.predictFaces(video);
        let eyePatches = FaceTracker.getEyePatches(faces, canvas);
        let eyePos = FaceTracker.predictIrises(eyePatches);
        this.lastEyePatches = eyePatches;
        this.pointerPos = eyePos;
        const event = new Event("prediction");
        event.position = this.position.clone();
        this.dispatchEvent(event);
      } catch(e){}
    }
  }
}

SvgPlus.defineHTMLElement(EyeTrackerWindow);
export {EyeTrackerWindow}

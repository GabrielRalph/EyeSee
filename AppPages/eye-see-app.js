import {SvgPlus, Vector} from "../SvgPlus/4.js"
import {} from "../Icons/paste-icon.js"

import {startWebcam, stopWebcam, startPredictions, stopPredictions, addPredictionListener, addCalibrationPoint, clearCalibration} from "../EyeTracker2/eye-tracker.js"
import {addUpdateHandler, broadcast, leaveSession, joinSession, sendRequest, addAuthChangeListener, login, logout, createSession, isOwner, isCreator, removeCurrentSession} from "../Database/database-functions.js"

window.closestInputValue = function (node) {
  let input = null;
  while (!input && node) {
    input = node.querySelector("input");
    if (!input) node = node.parentNode;
  }
  if (input) input = input.value;
  else input = "";
  return input;
}


async function parallel() {
  let res = [];
  for (let argument of arguments) {
    res.push(await argument);
  }
  return res;
}
function delay(t) {
  return new Promise(function(resolve, reject) {
    setTimeout(resolve, t);
  });
}
function getQueryKey(string) {
  let key = null;
  try {

    console.log(string);
    let match = string.match(/[ !"%&'()*+\,\-\/0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ\^_`abcdefghijklmnopqrstuvwxyz{|}]{20}$/);
    if (match) {
      key = match[0];
    }
  } catch(e){}
  return key;
}


class EyeSeeApp extends SvgPlus{
  constructor(el) {
    super(el);
    this.page = "loader";

    const handlers = {
      pdf: (value) => {
        let {pdfViewer} = this;
        if (pdfViewer && value) {
          if (pdfViewer.url != value.url) {
            pdfViewer._pageNumber = value.page;
            pdfViewer.url = value.url;
          } else if (pdfViewer.pageNum != value.page) {
            pdfViewer.page = value.page;
          }
        }
      },
      eyes: (value) => {
        this.toggleAttribute("patient-calibrating", false);
        for (let key in value) {
          let eyes = value[key].eyes;
          if (eyes === "calibrating") {
            this.toggleAttribute("patient-calibrating", true);
          } else {
            let pos = this.toScreen(new Vector(eyes));
            if (pos) {
              this.cursors.setCursorPosition(pos, key, "blob")
            }
          }
        }
      },
      mouse: (value) => {
        let pos = this.toScreen(new Vector(value));
        if (pos) {
          this.cursors.setCursorPosition(pos, "mouse", "default");
        }
      },
      user: async (data) => {
        // console.log("user info", data);
        this.toggleAttribute("user", "new-user");
        this.toggleAttribute("hosting-session", false);
        if (data) {
          let {info, creator} = data;
          creator = !!creator;
          let userinfo = info && typeof info["first-name"] === "string";
          this.setAttribute("user", creator ? "creator" : (userinfo ? "requesting" : "new-user"));
            if (info) {
              let sid = info["current-session"];
              if (sid) {
                let owner = await isOwner(sid);
                this.toggleAttribute("hosting-session", owner);
                console.log("hosting session", sid);
                this.hostedSession = sid;
                this.isOwner = owner;
              }
            }
          this.isOwner = false;
        }
        if (this.page == "loader") this.page = "home"
      }
    }
    addUpdateHandler((type, value) => {
      if (type in handlers) handlers[type](value);
    });
    addPredictionListener((e) => {
      let pred = e.prediction;
      if (pred != null) pred = new Vector(pred);

      let eyePosRel = null;
      let {calibrating} = this.calibrator;
      if (calibrating) {
        pred = null;
        eyePosRel = "calibrating"
      } else {
        eyePosRel = this.toRel(pred);
      }
      this.cursors.setCursorPosition(pred, "eye-position", "blob");
      broadcast.eye(eyePosRel);
    })
    addAuthChangeListener(this);
  }

  async onconnect(){
    window.app = this;
    this.errorMessage = document.querySelector('.error-message');
    this.progressLoader = document.querySelector('progress-loader');

    this.pdfViewer = document.querySelector("pdf-viewer");
    this.calibrator = document.querySelector("calibration-window");
    this.cursors = document.querySelector("cursor-group");
    this.webcamIcon = document.querySelector("[name = 'webcam-icon']");
    this.requestError = this.querySelector("[name = 'request-error']");

    this.calibrator.addEventListener("point", (e) => {
      addCalibrationPoint(e.point.x, e.point.y);
    })
    this.pdfViewer.onmousemove = (e) => {
      let mousePosRel = this.toRel(new Vector(e));
      broadcast.mouse(mousePosRel);
    }

    await this.waitForLoad
    let key = getQueryKey(window.location.search);
    if (key != null) {
      this.joinSession(key, false);
    }
  }



  async webcamIconPulse(){
    console.log(this.webcamIcon);
    let fade = async (inout) => {
      await this.waveTransition((o) => {
        this.webcamIcon.style.setProperty("opacity", o);
      }, 400, inout);
    }
    for (let i = 0; i < 2; i++) {
      await fade(false);
      await fade(true);
    }
  }

  toScreen(rel) {
    let pos = null;
    if (this.pdfViewer && this.pdfViewer.canvas) {
    let [cpos, size] = this.pdfViewer.canvas.bbox;
      if (rel instanceof Vector) {
        pos = rel.mul(size).add(cpos);
      }
    }
    return pos;
  }
  toRel(pos){
    let rel = null;
    if (this.pdfViewer && this.pdfViewer.canvas) {
      let [cpos, size] = this.pdfViewer.canvas.bbox;
      if (pos instanceof Vector && size.x != 0 && size.y != 0) {
        rel = pos.sub(cpos).div(size);
      }
    }
    return rel;
  }

  async onauthchange(user) {
    this.toggleAttribute("user", false);
    let name = document.getElementById("name");
    if (user) {
      name.innerHTML = user.displayName;
      this.lastuid = user.uid;
      this.setAttribute("user", "new-user")
    } else {
      this.page = "home";
    }
  }

  signIn() {
    this.page = "loader";
    login();
  }

  signOut(){
    this.page = "loading";
    logout();
  }

  async getPDF(){
    let input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf";

    return new Promise((resolve, reject) => {
      input.oninput = () => {
        let file = input.files[0];
        resolve(file);
      }

      input.click();
    });
  }

  set error(value){
    this.errorMessage.innerHTML = value;
    this.page = "error";
  }

  set progress(value) {
    this.progressLoader.progress = value;
    this.page = "progress-loader"
  }

  async createSession(){
    let pdf = await this.getPDF();

    let sessionKey = null;
    this.progress = 0;
    try {
      sessionKey = await createSession(pdf, (p) => {this.progress = p * 0.99}, false);
      await this.joinSession(sessionKey, true);
    } catch (e) {
      console.log("errrror");
      this.error = e;
      return;
    }
  }

  leaveSession(){
    stopPredictions();
    stopWebcam();
    leaveSession();
    this.home();
  }

  async resumeSession(){
    if (this.hostedSession) {
      await this.joinSession(this.hostedSession, !this.isOwner);
    }
  }

  async joinSession(key, isCreator = false){
    console.log(isCreator);
    key = getQueryKey(key);
    this.page = "loader";
    this.pdfViewer.url = null;
    try {
      await joinSession(key, isCreator);
      this.sessionKey = key;
      this.hostedSession = key;
      this.toggleAttribute("session-host", isCreator);
    } catch (e) {
      console.log(e);
      this.page = "join-session-error"
      return;
    }
    console.log("waiting for pdf");
    await this.pdfViewer.waitForLoad();
    console.log("waiting done for pdf");
    this.page = "session"

    if (!isCreator) {
      await this.startEyeTracker();
    }
  }

  async startEyeTracker(){
    this.page = "start-eye-tracking"
    this.toggleAttribute("calibrated", false);

    let [webcamOn] = await parallel(startWebcam(), this.webcamIconPulse());
    console.log(webcamOn);
    if (webcamOn) {
      startPredictions();
      await this.calibrate();
      this.toggleAttribute("calibrated", true);
    } else {
      this.page = "eye-tracking-error";
    }
  }

  async calibrate(){
    let {calibrator} = this;
    calibrator.show();
    clearCalibration();
    this.page = "calibrator"
    try {
      await calibrator.calibrate();
    } catch (e) {
      console.log(e);
      this.page = "calibration-error";
    }
    this.page = "session"
  }

  endSession(){
    this.removeCurrentSession();
    this.page = "home";
  }

  removeCurrentSession(){
    try {
      removeCurrentSession();
      this.sessionKey = null;
      this.hostedSession = null;
    } catch (e) {
    }
    this.toggleAttribute("in-session", false);
  }

  nextPDFPage(){
    this.pdfViewer.page++;
    broadcast.page(this.pdfViewer.page);
  }
  lastPDFPage(){
    this.pdfViewer.page--;
    broadcast.page(this.pdfViewer.page);
  }

  makeRequest(){
    this.requestError.innerHTML = "";
    this.page = "request";
  }

  async sendRequest(){
    let form = this.querySelector(".app-window[name = 'request']");
    let inputs = form.querySelectorAll("input");
    let info = {};
    let error = false;
    for (let input of inputs) {
      let value = input.value;
      value = value.replace(/^\s*/, "");
      if (!value.match(/^\w+/)) {
        error = true;
        break;
      }
      info[input.getAttribute("name")] = input.value;
    }

    if (error) {
      this.requestError.innerHTML = "Please enter values for all fields"
    } else {
      await sendRequest(info);
      this.home()
    }
  }



  home(){this.page = 'home';}

  set page(name) {
    for (let child of this.children) {
      let inputs = child.querySelectorAll("input");
      for (let input of inputs) input.value = "";
      child.toggleAttribute("shown", child.getAttribute("name") == name)
    }
    console.log(name);
    if (name == "loader") {
      this.waitForLoad = new Promise((resolve, reject) => {
        this._endLoad = () => resolve();
      })
    } else {
      this._endLoad();
      this._endLoad = () => {}
      this.waitForLoad = async () => {}
    }
    this._page = name;
  }
  get page(){return this._page;}
}

SvgPlus.defineHTMLElement(EyeSeeApp);

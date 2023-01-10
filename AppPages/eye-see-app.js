import {SvgPlus, Vector} from "../SvgPlus/4.js"
import {} from "../Icons/paste-icon.js"
import {sendRequest, addAuthChangeListener, login, logout, createSession, isCreator, removeCurrentSession} from "../Database/database-functions.js"
import {addUpdateHandler, broadcast, joinSession} from "../Database/session.js";
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



class EyeSeeApp extends SvgPlus{
  constructor(el) {
    super(el);
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
        // if (size.x != 0 && size.y != 0) {
          for (let key in value) {
            let eyes = value[key].eyes;
            let pos = this.toScreen(eyes);
            if (pos) {
              this.cursors.setCursorPosition(pos, key, "blob")
            }
          }
        },
        mouse: (value) => {
          let pos = this.toScreen(new Vector(value));
          console.log(pos);
          if (pos) {
            this.cursors.setCursorPosition(pos, "mouse", "default");
          }
        }
      // }
    }
    addUpdateHandler((type, value) => {
      if (type in handlers) handlers[type](value);

    })
  }

  onconnect(){
    window.app = this;
    this.errorMessage = document.querySelector('.error-message');
    this.progressLoader = document.querySelector('progress-loader');

    this.pdfViewer = document.querySelector("pdf-viewer");
    this.eyeTracker = document.querySelector("eye-tracker-window");
    this.calibrator = document.querySelector("calibration-window");
    this.cursors = document.querySelector("cursor-group");
    this.eyeTracking = document.querySelector("[name = 'eye-tracking']");
    this.keyDisplay = document.querySelector("[name = 'key-display']");

    this.eyeTracker.addEventListener("prediction", (e) => {
      let pred = e.position;
      // console.log(pred);
      if (this.calibrator.calibrating) {pred = null;}
      this.cursors.setCursorPosition(pred, "eye-position", "blob");


      let eyePosRel = this.toRel(pred);
      broadcast.eye(eyePosRel);
    })

    this.pdfViewer.onmousemove = (e) => {
      let mousePosRel = this.toRel(new Vector(e));
      broadcast.mouse(mousePosRel);
    }

    this.calibrator.eyeTracker = this.eyeTracker;

    addAuthChangeListener(this)
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
    if (user && user.uid !== this.lastuid) {
      let currentSession = user.info ? user.info["current-session"] : null;
      console.log(!!currentSession);
      this.toggleAttribute("in-session", !!currentSession);
      this.usersCurrentSession = currentSession;

      this.lastuid = user.uid;
      let creator = await isCreator();
      this.isCreator = creator;
      this.toggleAttribute("creator", creator)
      let name = document.getElementById("name");
      name.innerHTML = user.displayName;
      this.page = "home";
    } else {
      this.page = "sign-in";
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
      this.joinSession(sessionKey);
    } catch (e) {
      console.log("errrror");
      this.error = e;
      return;
    }
  }

  leaveSession(){
    this.eyeTracker.stop();
    this.home();
  }

  async resumeSession(){
    console.log(this.usersCurrentSession);
    if (this.usersCurrentSession) {
      await this.joinSession(this.usersCurrentSession, !this.isCreator);
    }
  }

  async joinSession(key, isPatient){
    this.page = "loader";
    this.pdfViewer.url = null;
    try {
      await joinSession(key, isPatient);
      this.sessionKey = key;
      this.usersCurrentSession = key;
      this.toggleAttribute("patient-session", isPatient);
      this.toggleAttribute("clinician-session", !isPatient);
    } catch (e) {
      this.page = "join-session-error"
      return;
    }
    console.log("waiting for pdf");
    await this.pdfViewer.waitForLoad();
    console.log("waiting done for pdf");
    this.page = "session"

    console.log(isPatient);
    this.eyeTracking.toggleAttribute("hidden", !isPatient);
    if (isPatient) {
      await this.startEyeTracker();
    }
  }

  async startEyeTracker(){
    let {eyeTracker, calibrator} = this;
    if (eyeTracker && calibrator) {
      let eyetracking = await eyeTracker.start();
      this.eyeTracking.style["pointer-events"] = "all";
      if (eyetracking) {
        await calibrator.calibrate();
      } else {
        this.home();
      }
      this.eyeTracking.style["pointer-events"] = "none";
    }
  }

  removeCurrentSession(){
    removeCurrentSession();
    this.sessionKey = null;
    this.usersCurrentSession = null;
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

  async sendRequest(){
    let form = this.querySelector(".app-window[name = 'request']");
    let inputs = form.querySelectorAll("input");
    let info = {};
    for (let input of inputs) {
      info[input.getAttribute("name")] = input.value;
    }
    await sendRequest(info);
    this.home()
  }

  home(){this.page = 'home';}

  set page(name) {
    for (let child of this.children) {
      let inputs = child.querySelectorAll("input");
      for (let input of inputs) input.value = "";
      child.toggleAttribute("shown", child.getAttribute("name") == name)
    }
  }
}

SvgPlus.defineHTMLElement(EyeSeeApp);

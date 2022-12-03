import {SvgPlus, Vector} from "./SvgPlus/4.js"
import {login, logout, addAuthChangeListener, makeSession, joinSession, uploadPDF} from "./Database/database-functions.js";
import {Cursor} from "./cursor.js"
import {EyeTrackerWindow} from "./eye-tracker-window.js"
import {PdfViewer} from "./PDFViewer/pdf-viewer.js"
import {} from "./Loader/loader.js"

class EyeSee extends SvgPlus {
  constructor(el) {
    super(el);
    this.mpos = new Vector;
    this.opacity = 0;
    this.fade = true;
  }

  async joinSession(id, forcePatient){
    let {jtool, isSessionOwner, eyeTracker} = this;
    jtool.style.opacity = 0.5;
    this.leaveSession();
    let res = await joinSession(id, this, forcePatient);
    if (res !== null) {
      jtool.toggleAttribute("hidden", true);
      if (!isSessionOwner) {
        console.log("eye tracking");
        await eyeTracker.start();
      }
    }
    jtool.style.opacity = 1;
    return res;
  }

  async makeSession(){
    if (await makeSession()) {
      await this.joinSession(this.uid);
    }
  }

  leaveSession(){
    if (this.unsubscribeSession instanceof Function) {
      this.unsubscribeSession();
    }
  }

  async uploadPDF(){
    if (this.uid && this.isSessionOwner === true) {
      await uploadPDF(this.uid, (e) => {
        console.log(e);
      });
    }
  }


  onconnect(){
    this.pdf = document.createElement("pdf-viewer");
    this.appendChild(this.pdf);
    this.pointer = this.createChild("div", {class: "pointer"});
    let logoutbtn = this.createChild("div", {class: "btn logout", content: "Logout"});
    logoutbtn.onclick = () => {logout()}
    logoutbtn.oncontextmenu = (e) => {
      e.preventDefault();
      this.makeSession();
    }

    let jtool = this.createChild("div", {class: "join-tool"});
    let jinput = jtool.createChild("input", {class: "joine"});
    let jbtn = jtool.createChild("div", {class: "btn", content: "join"});
    this.jtool = jtool;
    jbtn.onclick = async () => {
      let id = jinput.value;
      await this.joinSession(id, true);
    }


    this.login_window = this.createChild("div", {class: "login-window"});
    let loginbtn = this.login_window.createChild("div", {class: "btn", content: "Login"});
    loginbtn.onclick = () => {
      this.loader.toggleAttribute("hidden", false);
      // window.setTimeout(() => {
        login()

      // }, 2000);
    }
    this.login_window.createChild("div", {class: "msg", content: "Login with Gmail to join or create a eye see session."});


    this.eyeTracker = document.createElement("eye-tracker-window");
    this.eyeTracker.addEventListener("prediction", async (e) => {
      let v = e.position;

      let [pos, size] = this.pdf.canvas.bbox;
      v = v.sub(pos).div(size);

      this.eye_position = v;
    })
    this.appendChild(this.eyeTracker);

    this.cursors = this.createChild("div");

    this.loader = this.createChild("div", {class: "loader", content: "<wavey-circle-loader></wavey-circle-loader>"});
    addAuthChangeListener(this);

    setInterval(async () => {
      if (this.uid !== null) {
        if (this.updateMousePosition instanceof Function && this.mouse_position instanceof Vector)
          await this.updateMousePosition(this.mouse_position);
        if (this.updateEyePosition instanceof Function && this.eye_position instanceof Vector)
          await this.updateEyePosition(this.eye_position);

        this.setCursorPosition("own", this.eye_position);

      }
    }, 25);
  }

  onmousemove(e) {
    let p = new Vector(e);
    let [pos, size] = this.bbox;
    let pr = p.sub(pos).div(size);
    this.mouse_position = pr;
  }

  onmouseleave(e) {
    this.mouse_position = new Vector(-1);
  }

  onauthchange(user){
    if (user) {
      this.uid = user.uid;
    } else {
      this.uid = null;
      this.leaveSession();
    }
    console.log(user, "here");
    this.loader.toggleAttribute("hidden", true);
    this.login_window.toggleAttribute("hidden", user !== null);
  }

  setCursorPosition(pid, v){
    let [pos, size] = this.pdf.canvas.bbox;

    if (typeof pid === "string" && v instanceof Vector) {
      if (!(pid in this.cursors)) {
        this.cursors[pid] = this.cursors.createChild(Cursor);
        this.cursors[pid].name = pid;
      }

      v = v.mul(size).add(pos);

      this.cursors[pid].addPoint(v)
    }
  }


  // update methods called from an update in the database
  async mouseUpdate(mpos) {
    let [pos, size] = this.bbox;
    let [x, y] = [mpos.x * size.x, mpos.y * size.y]
    this.fade = (x< 0 || y < 0);
    this.pointer.styles = {
      left: x+ "px",
      top: y + "px",
    }
  }

  async patientUpdate(patients) {
    for (let pid in patients) {
      let v = new Vector(patients[pid]);
      this.setCursorPosition(pid, v);
    }
  }

  async PDFUpdate(pdf_info){
    let {url, page} = pdf_info;
    let {pdf, _updating_pdf} = this;
    if (!pdf.loading && !_updating_pdf) {
      this._updating_pdf = true;
      if (url != pdf.url) {
        await pdf.loadPDF(url);
      }
      await pdf.renderPage(page);
      this._updating_pdf = false;
    }
  }
}

SvgPlus.defineHTMLElement(EyeSee);

import {SvgPlus, Vector} from "./SvgPlus/4.js"
import {login, logout, addAuthChangeListener, makeSession, joinSession} from "./database-functions.js";
class EyeSee extends SvgPlus {
  constructor(el) {
    super(el);
    this.mpos = new Vector;
  }

  leaveSession(){
    if (this.unsubscribeSession instanceof Function) {
      this.unsubscribeSession();
    }
    this.updateInfo = null;
    this.updatePatientInfo = null;
  }
  async joinSession(id, forcePatient){
    this.jtool.style.opacity = 0.5;
    this.leaveSession();
    let res = await joinSession(id, this, forcePatient);
    if (res !== null) {
      this.jtool.toggleAttribute("hidden", true);
    }
    this.jtool.style.opacity = 1;
    return res;
  }

  onconnect(){
    this.pointer = this.createChild("div", {class: "pointer"});
    let logoutbtn = this.createChild("div", {class: "btn logout", content: "Logout"});
    logoutbtn.onclick = () => {logout()}

    let jtool = this.createChild("div", {class: "join-tool"});
    let jinput = jtool.createChild("input", {class: "joine"});
    let jbtn = jtool.createChild("div", {class: "btn", content: "join"});
    this.jtool = jtool;

    jbtn.onclick = async () => {
      let id = jinput.value;
      await this.joinSession(id, true);
    }

    logoutbtn.oncontextmenu = async (e) => {
      e.preventDefault();
      await this.joinSession(this.uid);
    }

    this.login_window = this.createChild("div", {class: "login-window"});
    let loginbtn = this.login_window.createChild("div", {class: "btn", content: "Login"});
    loginbtn.onclick = () => {login()}
    this.login_window.createChild("div", {class: "msg", content: "Login with Gmail to join or create a eye see session."});


    this.loader = this.createChild("div", {class: "loader"})
    addAuthChangeListener(this);

    setInterval(async () => {
      // console.log('x');
      // console.log(this.updateInfo);
      await this.update();
    }, 25);
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

  onmousemove(e) {
    let p = new Vector(e);
    let [pos, size] = this.bbox;
    let pr = p.sub(pos);
    this.mpos = pr;
  }

  async update(){
    if (this.uid == null) return;

    if (this.updateInfo instanceof Function) {
      let info = {
        mousex: this.mpos.x,
        mousey: this.mpos.y,
      }
      await this.updateInfo(info)
    } else {

    }

    if (this.updatePatientInfo instanceof Function) {
      let info = {

      }
      await this.updatePatientInfo(info);
    }
  }

  onpatientinfo(info){
    console.log(info);
  }

  oninfo(info) {
    // this.mpos = new Vector(info.mousex, info.mousey);
    // console.log(info);
    this.pointer.styles = {
      left: info.mousex + "px",
      top: info.mousey + "px",
    }
    // console.log(info);
  }
}

SvgPlus.defineHTMLElement(EyeSee);

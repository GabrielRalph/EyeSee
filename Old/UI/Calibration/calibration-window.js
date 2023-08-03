import {SvgPlus, Vector} from "../SvgPlus/4.js"

function delay(t) {
  return new Promise(function(resolve, reject) {
    setTimeout(resolve, t);
  });
}

function lurp(p1, p2, t) {
  return p1.mul(t).add(p2.mul(1-t));
}

function dotgrid(size, count) {
  let points = []
  for (let y = 0; y < count + 1; y++) {
    for (let x = 0; x < count + 1; x++) {
      points.push(size.mul(new Vector(x/count, y/count)))
    }
  }
  return points;
}

class CalibrationWindow extends SvgPlus {

  onconnect(){
    this.message = this.querySelector("[name = 'message']");
    this.startButton = this.message.querySelector("[name = 'run']");
    this.exitButton = this.message.querySelector("[name = 'exit']");
    // console.log(this.startButton);
    if (!this.startButton) this.startButton = this.message;
    this.innerHTML = ""

    let mbox = this.createChild("div");
    this.pointer = mbox.createChild("div", {
      class: "pointer",
      style: {
        opacity: 0,
      }
    });
    mbox.appendChild(this.message);
    this.mbox = mbox;
  }

  async waitForClick(){
    return new Promise((resolve, reject) => {
      this.startButton.onclick = () => {
        resolve(true);
      }
      this.exitButton.onclick = () => {
        resolve(false);
      }
    });
  }

  async fade(duration, fadeIn, elname = "pointer") {
    await this.waveTransition((opacity) => {
      let obj = typeof elname === "string" ? this[elname] : elname
      obj.style.setProperty("opacity", opacity);
    }, duration, fadeIn);
  }

  show(){
    this.styles = {opacity: 1};
  }



  async calibrate(){
    if (this._calibrating) return;
    this._calibrating = true;
    this.styles = {cursor: "inherit", opacity: 1};
    this.message.style.setProperty("pointer-events", "all");

    let exited = true;
    if (await this.waitForClick()) {
      exited = false;

      // hide message
      this.message.style.setProperty("pointer-events", "none");
      this.styles = {cursor: "none"}
      await this.fade(300, false, "message");

      // trigger calibration points
      let points = this.points;
      for (let point of points) {
        await this.triggerAt(point);
      }

      // fade contents, show message for later
      await this.fade(300, false, this)
      this.message.style.setProperty("opacity", 1);
    }

    this._calibrating = false;
    return exited;
  }

  get points(){
    let [pos, size] = this.mbox.bbox;
    return dotgrid(size, 2);
  }

  get point(){
    return this._point;
  }

  set pos(point){
    this.pointer.styles = {
      top: point.y + "px",
      left: point.x + "px"
    }
  }

  get calibrating(){
    return this._calibrating;
  }

  async triggerAt(point, triggers = 3, samples = 3, sampletime = 1000) {
    let {pointer} = this;
    let [pos] = this.bbox;
    pointer.innerHTML = triggers > 1 ? 3 : "";
    this.pos = point;
    await this.fade(500, true, "pointer");
    await delay(500);
    this._point = point.add(pos);
    for (let t = 0; t < triggers; t++) {
      pointer.innerHTML = triggers > 1 ? (3 - t) : "";
      let dtime = sampletime / (samples + 1);
      await delay(dtime);
      for (let s = 0; s < samples; s++) {
        this.addCalibrationPoint();
        await delay(dtime);
      }
    }
    this._point = null;
    await this.fade(300, false, "pointer")
  }

  addCalibrationPoint() {
    const event = new Event("point");
    event.point = new Vector(this.point);
    this.dispatchEvent(event)
  }
}

SvgPlus.defineHTMLElement(CalibrationWindow);

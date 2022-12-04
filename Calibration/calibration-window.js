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
    this.innerHTML = "";
    this.style = {opacity: 0};
    let mbox = this.createChild("div");
    this.pointer = mbox.createChild("div", {
      class: "pointer",
      style: {
        opacity: 0,
      }
    });
    this.message = mbox.createChild("div", {
      class: "message",
      style: {
        opacity: 0,
      },
      content: `Focus on the center of the dots\nto calibrate eye tracking`,
    });
    this.mbox = mbox;
  }

  async fade(duration, fadeIn, elname = "pointer") {
    await this.waveTransition((opacity) => {
      let obj = typeof elname === "string" ? this[elname] : elname
      obj.styles = {opacity: opacity};
    }, duration, fadeIn);
  }

  async connectEyeTracker(eyetracker) {
    if (eyetracker) {
      this.addEventListener("trigger", () => {
        let point = this.point;
        if (point != null) {
          eyetracker.addCalibrationPoint(point.x, point.y)
        }
      })
      try {
        console.log('starting');
        await eyetracker.start()
      } catch(e) {
        console.log(e);
        return false;
      }
      return true;
    }
    return false;
  }

  async calibrate(eyetracker){
    if (this._calibrating) return;
    this.styles = {cursor: "none"}
    this._calibrating = true;
    // this.fade(300, true, this);
    await this.fade(300, true, "message");
    let proms = [delay(3000), this.connectEyeTracker(eyetracker)];
    console.log(proms);
    for (let prom of proms) {
      console.log(prom);
      await prom;
      console.log(prom);
    }

    await this.fade(300, false, "message");
    let points = this.points;
    for (let point of points) {
      await this.triggerAt(point);
    }
    this.fade(300, false, this)
    this.styles = {cursor: "inherit"}
    this._calibrating = false;
  }

  get points(){
    let [pos, size] = this.mbox.bbox;
    return dotgrid(size, 3);
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

  async triggerAt(point, triggers = 1) {
    let {pointer} = this;
    let [pos] = this.bbox;
    pointer.innerHTML = triggers > 1 ? 1 : "";
    this.pos = point;
    await this.fade(500, true, "pointer");
    this._point = point.add(pos);
    for (let s = 0; s < triggers; s++) {
      pointer.innerHTML = triggers > 1 ? s + 1 : "";
      await delay(333.333);
      this.dispatchEvent(new Event("trigger"))
      await delay(333.333);
      this.dispatchEvent(new Event("trigger"))
      await delay(333.333);

    }
    this._point = null;
    await this.fade(300, false, "pointer")
  }
}

SvgPlus.defineHTMLElement(CalibrationWindow);

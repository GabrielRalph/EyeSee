import {SvgPlus, Vector} from "../SvgPlus/4.js"

const Glasses = `<path class="st0" d="M27.9-11.3c-13.2,0.1-20.5,4-20.5,4S3.9-7.5,0-7.5c-3.9,0-7.4,0.2-7.4,0.2s-7.3-3.8-20.5-4S-50-8.6-50-8.6v4.5
	c0,0,3.5-0.7,3.8,4.3c0.3,5,1.8,11.1,3.7,14.2s4.8,6.5,15.4,6.5c10.7,0,15.4-4.6,17-7.1c1.6-2.5,4.7-7.7,4.6-12.3c0-4.1-1.6-5,5.5-5
	c7,0,5.5,0.9,5.5,5c0,4.5,3,9.7,4.6,12.3c1.6,2.5,6.3,7.1,17,7.1c10.7,0,13.6-3.5,15.4-6.5c1.8-3.1,3.4-9.2,3.7-14.2
	c0.3-5,3.8-4.3,3.8-4.3v-4.5C50-8.6,41.2-11.4,27.9-11.3z M-16.3,17.2c-4.3,2.1-10.5,2.1-13,2c-2.4-0.1-11,0.4-13.2-10.9
	C-44.8-3.1-42.6-6.3-39-7.8c3.6-1.5,10.4-2,12.5-2c5.8,0,19,1.5,18.9,9.9C-7.8,8.5-12,15.1-16.3,17.2z M42.5,8.3
	c-2.2,11.4-10.8,10.8-13.2,10.9c-2.4,0.1-8.7,0.2-13-2C12,15.1,7.8,8.5,7.7,0.1c-0.2-8.4,13-9.9,18.9-9.9c2.1,0,8.9,0.4,12.5,2
	S44.8-3.1,42.5,8.3z"/>`

class FeedbackFrame extends SvgPlus {
  onconnect(){
		this.styles = {display: "flex"}
    let rel = this.createChild("div", {styles:{position: "relative", display: "inline-flex"}});
    this.canvas = rel.createChild("canvas");
    this.svg = rel.createChild("svg", {styles:{position: "absolute", top: 0, left: 0, right: 0, bottom: 0}});
    this.msg = rel.createChild("div", {class: "msg",styles:{position: "absolute"}});
    this.glasses = this.svg.createChild("g", {content: Glasses, class: "glasses"});
    this.svg.styles = {opacity: 0}

    let opacity = 0;
    let fader = () => {
      if (this.fade) opacity -= 0.02;
      else opacity = 1;
      this.msg.styles = {opacity: opacity};
      window.requestAnimationFrame(fader);
    }
    window.requestAnimationFrame(fader);
  }

  updateCanvas(source) {
    let {canvas, svg} = this;
    try {
      let {width, height} = source;
      canvas.width = width;
      canvas.height = height;
      let destCtx = canvas.getContext('2d');
      destCtx.drawImage(source, 0, 0);
      svg.props = {viewBox: `0 0 ${width} ${height}`, style: {opacity: 1}}
    } catch (e) {
      console.log(e);
      svg.styles = {opacity: 0}
    }
  }

  set error(value) {
    let {msg, svg} = this;
    if (value != null) {
      msg.innerHTML = value;
      this.fade = false;
    } else {
      this.fade = true;
    }
    svg.toggleAttribute('valid', value == null);
  }



  setGlassesPose(x,y,width,angle) {
    let nwidth = 100 * Math.cos(angle);
    let s = width/nwidth;
    let p = new Vector(x, y);
    p = p.div(s);
    p = p.rotate(-angle);
    this.glasses.props = {
      transform: `rotate(${angle*180/Math.PI}) scale(${s}) translate(${p.x}, ${p.y})`
    }
  }
}

SvgPlus.defineHTMLElement(FeedbackFrame);
export {Vector}

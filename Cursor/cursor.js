import {SvgPlus, Vector} from "../SvgPlus/4.js"


class Cursor extends SvgPlus {
  constructor(){
    super("svg");
    this.props = {
      class: "cursor",
      viewBox: "-100 -100 200 200"
    }
    this.innerHTML = `
    <filter id="filter" x="-20%" y="-20%" width="140%" height="140%" filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse" color-interpolation-filters="linearRGB">
    	<feGaussianBlur stdDeviation="0.5 0.5" x="-100%" y="-100%" width="200%" height="200%" in="morphology1" edgeMode="none" result="blur"/>
    	<feComposite in="blur" in2="SourceGraphic" operator="xor" x="-100" y="-100" width="100%" height="100%" result="composite"/>
    	<feComposite in="composite" in2="composite" operator="lighter" x="-100" y="-100" width="100%" height="100%" result="composite1"/>
    </filter>`
    this._points = [];
    this.g = this.createChild("g", {filter: "url(#filter)"});
    this.start(0.1);
    this.opacity = 0;
  }

  // async fade(duration){
  //   this.styles = {opacity}
  // }

  start(fac = 0.1){
    let next = () => {
      let {_points} = this;
      if (_points.length > 0) {
        let po = _points[0];
        let points = [];
        for (let point of _points) {
          points.push(point.mul(1 - fac).add(po.mul(fac)))
        }
      }
      this.render();
      window.requestAnimationFrame(next);
    }
    window.requestAnimationFrame(next);
  }

  smoothPoint(point, n) {
    let lambda = 2/n;
    let {lastpoint} = this;
    if (!(lastpoint instanceof Vector))
      lastpoint = point;

    if (point instanceof Vector) {
      point = point.mul(lambda).add(lastpoint.mul(1 - lambda));
      this.lastpoint = point.clone();
    }
    return point;
  }

  addPoint(point) {
    let {_points} = this;
    if (point != null) {
      point = new Vector(point);
      point = this.smoothPoint(point, 15);
      _points.push(point);
      if (_points.length > 5) _points.shift();
      this.opacity += 0.01;
    } else {
      this.opacity -= 0.01;
    }
  }

  get opacity(){
    return this._opacity;
  }
  set opacity(op){
    if (op < 0) op = 0;
    if (op > 0.75) op = 0.75;
    this._opacity = op;
    this.styles = {opacity: op}
  }

  get points(){
    return [... this._points];
  }


  render(){
    let {points, g} = this;
    let html = "";
    let i = 1;
    let s = 0.5;
    if (points.length > 0) {
      let {x, y} = points[points.length - 1];
      this.styles = {
        top: y + "px",
        left: x + "px",
        transform: "translate(-50%, -50%)"
      }
      for (let pos of points) {
        html += `<circle r = "${i * 4}" cy = "${(pos.y - y) * s}" cx = "${(pos.x - x) * s}"></circle>`
        i++;
      }
      g.innerHTML = html;
    }
  }
}

export {Cursor}

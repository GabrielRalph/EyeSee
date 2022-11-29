import {SvgPlus, Vector} from "./SvgPlus/4.js"


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
    this.g = this.createChild("g", {filter: "url(#filter)"})
    // window.onmousemove = (e) => {
    //   this.addPoint(e);
    // }
  }

  addPoint(point) {
    let {_points} = this;
    let {x, y} = point;
    _points.push({x, y});
    if (_points.length > 5) _points.shift();
    this.render();
  }

  get points(){
    return [... this._points];
  }


  render(){
    let {points, g} = this;
    let html = "";
    let i = 1;
    let s = 0.5;
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

export {Cursor}

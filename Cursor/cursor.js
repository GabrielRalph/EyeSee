import {SvgPlus, Vector} from "../SvgPlus/4.js"

class Cursor extends SvgPlus {
  constructor(el = "div"){
    super(el);
    this.opacity = 0;
    this.position = null;
    this.maxOpacity = 0.8;
    this.opacityIncrement = 0.1;
    this.delta = 0;
    this.lambda = 0.97;
  }

  // main public setter / getter
  set position(point) {
    point = this.parsePoint(point);
    this._position = point;

    this._new_position = point !== null;
  }
  get position(){
    let position = this._position;
    if (position instanceof Vector) {
      position = position.clone();
    }
    return position;
  }

  // overwrite to add functionality
  parsePoint(point) {
    let position = null;
    try {
      let {x, y} = point;
      position = new Vector(x, y);
    } catch (e) {
    }

    return position;
  }

  render() {
    let {position, lastRenderPos, lambda} = this;
    let delta = 0;
    if (position instanceof Vector && lastRenderPos instanceof Vector) {
      delta = position.sub(lastRenderPos).norm();
      // console.log(delta);
    }
    this.delta = this.delta * lambda + (1 - lambda) * delta;
    delta = this.delta;
    if (position == null || delta < 0.1) {
      this.opacity -= this.opacityIncrement;
      // console.log('y');
    } else {
      // console.log('x');
      this.opacity += this.opacityIncrement;
      let {x, y} = position;
      this.styles = {
        position: "fixed",
        top: y + "px",
        left: x + "px",
        transform: "translate(-50%, -50%)"
      }
    }
    this.lastRenderPos = position
    this._new_position = false;
  }

  // usefull stuff
  get isNewPosition(){return this._new_position;}

  get opacity(){
    return this._opacity;
  }
  set opacity(op){
    let {maxOpacity} = this;
    if (op < 0) op = 0;
    if (op > maxOpacity) op = maxOpacity;
    this._opacity = op;
    this.styles = {opacity: op}
  }
}

class BlobCursor extends Cursor {
  constructor(){
    super('svg');
    this.props = {
      class: "cursor",
      viewBox: "-100 -100 200 200"
    }

    // svg filter to create merged blobs
    this.innerHTML = `
    <filter id="filter" x="-20%" y="-20%" width="140%" height="140%" filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse" color-interpolation-filters="linearRGB">
    	<feGaussianBlur stdDeviation="0.5 0.5" x="-100%" y="-100%" width="200%" height="200%" in="morphology1" edgeMode="none" result="blur"/>
    	<feComposite in="blur" in2="SourceGraphic" operator="xor" x="-100" y="-100" width="100%" height="100%" result="composite"/>
    	<feComposite in="composite" in2="composite" operator="lighter" x="-100" y="-100" width="100%" height="100%" result="composite1"/>
    </filter>`
    this.g = this.createChild("g", {filter: "url(#filter)"});

    this._position_buffer = [];
    this.smoothingFactor = 10;
    this.positionBufferLength = 5;
    this.pointSizeFactor = 3;
    this.convergenceMax = 1;
    this.convergeRate = 0.001;
    this.convergence = 0.8;
  }

  set convergence(value){
    if (value < 0) value = 0;
    if (value > this.convergenceMax) value = this.convergenceMax;
    this._convergence = value;
  }
  get convergence() {
    return this._convergence;
  }

  // smooth point position using exponentially weighted moving average
  smoothPoint(point) {
    let lambda = 2/this.smoothingFactor;
    let {lastpoint} = this;
    if (!(lastpoint instanceof Vector))
      lastpoint = point;

    if (point instanceof Vector) {
      point = point.mul(lambda).add(lastpoint.mul(1 - lambda));
      this.lastpoint = point.clone();
    }
    return point;
  }

  addPointToBuffer(point) {
    if (point instanceof Vector) {
      // add point to position buffer
      this._position_buffer.push(point);
      if (this._position_buffer.length > this.positionBufferLength) {
        this._position_buffer.shift();
      }
    }
  }

  // smooth point and add it to position buffer
  parsePoint(point) {
    let position = super.parsePoint(point);

    if (position instanceof Vector) {
      let smoothedPosition = this.smoothPoint(position);
      this.addPointToBuffer(smoothedPosition);
      position = smoothedPosition;
    }

    return position;
  }

  // position buffer
  get points(){
    return [... this._position_buffer];
  }


  render(){
    // // auto converg if no new points have been added
    // if (!this.isNewPosition) {
    //   this.convergence -= this.convergeRate;
    // } else {
    //   this.convergence += this.convergeRate;
    // }

    super.render();

    // draw circles for each point in the position buffer
    // relative to the current cursor position
    let {points, g, pointSizeFactor, convergence} = this;
    let html = "";
    let i = 1;
    if (points.length > 0) {
      let {x, y} = points[points.length - 1];
      for (let pos of points) {
        html += `<circle r = "${i * pointSizeFactor}" cy = "${(pos.y - y) * convergence}" cx = "${(pos.x - x) * convergence}"></circle>`
        i++;
      }
      g.innerHTML = html;
    }
  }
}

const CursorsByType = {
  "blob": BlobCursor,
  "default": Cursor,
}

function makeCursor(type) {
  let cursor = null;
  if (type in CursorsByType) {
    cursor = new CursorsByType[type]();
  } else {
    cursor = new Cursor();
    cursor.class = type;
  }

  return cursor;
}

class CursorGroup extends SvgPlus {
  constructor(el){
    super(el);
    this.cursors = {};
  }

  onconnect(){this.startRendering();}
  ondisconnect() {this.stopRendering();}

  stopRendering(){}
  startRendering(){
    let stop = false;
    this.stopRendering = () => stop = true;
    let next = () => {
      this.renderCursors();
      if (!stop) {
        window.requestAnimationFrame(next);
      } else {
        this.stopRendering = () => {};
      }
    }
    window.requestAnimationFrame(next);
  }

  clear(){
    this.innerHTML = "";
    this.cursors = {};
  }

  removeCursor(name = "default") {
    if (name in cursors) {
      this.cursors[name].remove();
      delete this.cursors[name];
    }
  }
  setCursorPosition(point, name = "default", type = "blob") {
    let {cursors} = this;

    if (!(name in cursors)) {
      let cursor = makeCursor(type);
      cursor.setAttribute("name", name);
      this.cursors[name] = cursor;
      this.appendChild(cursor);
    }

    this.cursors[name].position = point;
  }

  renderCursors(){
    for (let name in this.cursors) {
      this.cursors[name].render();
    }
  }
}

SvgPlus.defineHTMLElement(CursorGroup)

export {Cursor, BlobCursor}

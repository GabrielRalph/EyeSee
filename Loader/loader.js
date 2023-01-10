import {SvgPath, SvgPlus, Vector} from "../SvgPlus/svg-path.js"

class WaveyCircleLoader extends SvgPlus {
  onconnect(){
    this.styles = {display: "block"};
    let r = 10;
    let rpad = r * 1.2;

    let svg = this.createChild("svg", {
      viewBox: `${-rpad} ${-rpad} ${2*rpad} ${2*rpad}`,
      style: {
        width: "100%",
      }
    })
    let text = svg.createChild("text", {
      content: "LOADING",
      "font-size": 2.5,
      "text-anchor": "middle",
      y: 1
    })
    let main = svg.createChild("g", {style: {
      "stroke": "black",
      "fill": "none",
      "stroke-linecap": "round"
    }});
    let next = () => {
      let t = 0.5 + 0.5 * Math.cos(performance.now() / 1000);
      let theta1 = Math.PI * (2 * t + 1.5);
      let theta2 = theta1 + 2 * Math.PI * (0.5 + 0.5 * Math.sin(performance.now() / 1222)) / 3;

      let p1 = new Vector(Math.cos(theta1) * r, Math.sin(theta1)*r);
      let p2 = new Vector(Math.cos(theta2) * r, Math.sin(theta2) * r);

      let path = `<path d = "M${p1}A${r},${r},0,${theta2 - theta1 > Math.PI ? 1 : 0},1,${p2}"></path>`
      main.innerHTML = path;
      window.requestAnimationFrame(next);
    }
    window.requestAnimationFrame(next);
  }
}


class ProgressLoader extends SvgPlus {
  onconnect(){
    let r = 10;
    let rpad = r * 1.2;
    this.svg = this.createChild("svg", {
      viewBox: `${-rpad} ${-rpad} ${2*rpad} ${2*rpad}`,
      style: {
        width: "100%",
      }
    });
    this.r = r;
  }


  set progress(value) {
    let {svg, r} = this;

    svg.innerHTML = "";
    if (typeof value === "number") {
      let theta1 = Math.PI / 2;
      let theta2 = Math.PI / 2 + 2 * Math.PI * value;

      let p1 = new Vector(Math.cos(theta1) * r, -Math.sin(theta1) * r);
      let p2 = new Vector(Math.cos(theta2) * r, -Math.sin(theta2) * r);

      let html =
      svg.innerHTML = `
      <path style = "fill: none; stroke: black; stroke-linecap: round;" d = "M${p1}A${r},${r},0,${value > 0.5 ? 1 : 0},0,${p2}"></path>
      `;
      svg.createChild("text", {
        content: `${Math.round(value * 100)}%`,
        "font-size": 2.5,
        "text-anchor": "middle",
        y: 1
      });
    }
  }
}

SvgPlus.defineHTMLElement(WaveyCircleLoader);
SvgPlus.defineHTMLElement(ProgressLoader);

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

SvgPlus.defineHTMLElement(WaveyCircleLoader);

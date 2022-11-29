import {SvgPlus, Vector} from "../SvgPlus/4.js"

class PdfViewer extends SvgPlus {
  onconnect(){
    this.canvas = this.createChild("canvas");

    let icons = this.createChild("div", {class: "icons"})
    this.icons = icons;
    this.left_icon = icons.createChild("div", {class: "left icon", content: "<"});
    this.middle_icon = icons.createChild("div", {class: "middle icon"});
    this.right_icon = icons.createChild("div", {class: "right icon", content: ">"});

    this.left_icon.onclick = async () => {
      await this.lastPage();
    }

    this.right_icon.onclick = async () => {
      await this.nextPage();
    }

    this.onclick = (e) => {
      let p = this.screenToPDFPoint(e);
    }
  }

  set iconsHidden(value){
    this.toggleAttribute(this.icons, value);
  }

  screenToPDFPoint(point) {
    let {canvas} = this;
    let pdfp = null;
    if (canvas) {
      let [pos, size] = canvas.bbox;
      let v = new Vector(point);
      pdfp = v.sub(pos).div(size);
    }
    return pdfp;
  }

  async nextPage(){
    let pg = this.pageNum + 1;
    console.log(pg);
    if (pg <= this.totalPages) {
      await this.renderPage(pg);
    }
  }

  async lastPage(){
    let pg = this.pageNum - 1;
    console.log(pg);
    if (pg > 0) {
      await this.renderPage(pg);
    }
  }

  get pageNum(){
    return this._pageNumber;
  }

  get totalPages(){
    return this._totalPages;
  }

  async loadPDF(url) {
    try {
      this._loading = true;
      let pdfDoc = await pdfjsLib.getDocument(url).promise
      this._url = url;
      this._totalPages = pdfDoc.numPages
      this.pdfDoc = pdfDoc;
      this._loading = false;
    } catch(e) {
      console.log(e);
    }
  }

  get url(){
    return this._url;
  }

  get loading(){
    return this._loading;
  }

  async renderPage(num) {
    if (this._rendering instanceof Promise) {
      await this._rendering;
    } else {
      this._rendering = this._render_page(num);
      await this._rendering;
      this._pageNumber = num;
      this.middle_icon.innerHTML = `${num}/${this.totalPages}`
    }
    this._rendering = null;
  }

  async _render_page(num){
    let {canvas, pdfDoc} = this;
    if (canvas && pdfDoc) {
      let page = await pdfDoc.getPage(num);

      // Set scale
      const viewport = page.getViewport({scale: 2});
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderCtx = {
        canvasContext: canvas.getContext("2d"),
        viewport: viewport
      };

      await page.render(renderCtx).promise
    }
  }
}

SvgPlus.defineHTMLElement(PdfViewer);

export {PdfViewer}

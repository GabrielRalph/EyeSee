import {SvgPlus, Vector} from "../SvgPlus/4.js"

async function delay(time) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, time);
  });
}


class PdfViewer extends SvgPlus {
  constructor(el) {
    super(el);
    this._wait_for_load = new Promise((resolve, reject) => {
      this._end_load = resolve;
    })
  }
  onconnect(){
    let loader = this.querySelector("[name = 'loader']");
    this.loader = loader;
    this.innerHTML = "";
    this.canvas = this.createChild("canvas", {width: 1000, height: 1000});
    let icons = this.createChild("div", {class: "pdf-controls"});
    this.icons = icons;
    this.middle_icon = icons.createChild("div", {class: "bottom-middle"});
  }

  set page(value) {
    if (value < 1) value = 1;
    let {totalPages} = this;
    if (value > totalPages) value = totalPages;
    this._pageNumber = value;
    this.renderPage();
  }
  get page() {
    return this._pageNumber;
  }
  get pageNum() {
    return this._pageNumber;
  }
  get totalPages() {
    return this._totalPages;
  }

  async loadPDF(url) {
    this._loaded = false;
    let load = async () => {
      try {
        let pdfDoc = await pdfjsLib.getDocument(url).promise
        this._totalPages = pdfDoc.numPages
        this.pdfDoc = pdfDoc;
        this._url = url;
        if (this.pageNum < 1 || this.pageNum > this.totalPages) this._pageNumber = 1;
        await this.renderPage();
        return true;
      } catch(e) {
        this._url = null;
        this._pageNumber = null;
        return false;
      }
    }
    if (this._loading_prom instanceof Promise) await this._loading_prom;
    this._loading_prom = load();
    this._loading_prom = await this._loading_prom;
    if (this._loading_prom) {
      this._loaded = true;
    }
  }
  get loading_prom() {
    return this._loading_prom;
  }

  get url() {
    return this._url;
  }
  set url(url) {
    this.loadPDF(url);
  }
  set src(value) {
    console.log("src");
    this.url = value;
  }

  async waitForLoad(){
    console.log('waiting for load', this._wait_for_load);
    while (!this._loaded) {
      await delay(50);
    }
    // await this._wait_for_load;
    console.log('loaded');
  }

  async renderPage(){
    let {canvas, pdfDoc, pageNum} = this;
    let render = async () => {
      if (canvas && pdfDoc) {
        console.log("rendering page", pageNum);
        let page = await pdfDoc.getPage(pageNum);

        // Set scale
        const viewport = page.getViewport({scale: 2});
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderCtx = {
          canvasContext: canvas.getContext("2d"),
          viewport: viewport
        };

        await page.render(renderCtx).promise
        this.middle_icon.innerHTML = `${pageNum}/${this.totalPages}`
        console.log("page rendered");
      }
    };
    if (this._render_prom instanceof Promise) await this._render_prom;
    this._render_prom = render();
    this._render_prom = await this._render_prom;
  }
  get render_prom(){
    return this._render_prom;
  }

  static get observedAttributes() {return ["src"]}
}

SvgPlus.defineHTMLElement(PdfViewer);

export {PdfViewer}

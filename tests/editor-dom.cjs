/* Optional interaction tests: Node.js + jsdom are test tools, not app dependencies. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { JSDOM } = require(process.env.PORTFOLIO_JSDOM || "jsdom");
function fixture(upload) {
  const dom = new JSDOM('<div id="root"></div>', {
    url: "https://portfolio.test",
    runScripts: "outside-only",
  });
  const window = dom.window;
  window.HTMLElement.prototype.setPointerCapture = function () {};
  window.HTMLElement.prototype.scrollIntoView = function () {};
  window.eval(
    readFileSync(path.join(__dirname, "../public/editor.js"), "utf8"),
  );
  const root = window.document.querySelector("#root");
  const project = {
    title: "Test",
    images: [
      { url: "/media/images/" + "a".repeat(32), caption: "First" },
      { url: "/media/images/" + "b".repeat(32), caption: "Second" },
    ],
  };
  let messages = [],
    busy = [];
  window.PortfolioCanvas.mount(root, project, {
    onChange() {},
    onMessage(message) {
      messages.push(message);
    },
    onBusy(value) {
      busy.push(value);
    },
    upload: upload || (async () => "/media/images/" + "c".repeat(32)),
  });
  const stage = root.querySelector("#canvas-stage");
  stage.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 1200,
    height: project.layout.height,
  });
  const pointer = (target, type, x, y) => {
    const event = new window.MouseEvent(type, {
      bubbles: true,
      clientX: x,
      clientY: y,
      button: 0,
    });
    Object.defineProperty(event, "pointerId", { value: 1 });
    target.dispatchEvent(event);
  };
  return { window, dom, root, project, stage, pointer, messages, busy };
}
test("canvas pointer interactions move and resize pictures, with working undo/redo", () => {
  const f = fixture(),
    block = f.project.layout.blocks[0];
  f.pointer(f.stage.querySelector("[data-block]"), "pointerdown", 100, 100);
  f.pointer(f.stage, "pointermove", 110, 125);
  f.pointer(f.stage, "pointerup", 110, 125);
  assert.equal(block.x, 58);
  assert.equal(block.y, 73);
  f.pointer(
    f.stage.querySelector('.selected [data-resize="se"]'),
    "pointerdown",
    300,
    300,
  );
  f.pointer(f.stage, "pointermove", 200, 380);
  f.pointer(f.stage, "pointerup", 200, 380);
  assert.equal(block.w, 1004);
  assert.equal(block.h, 720);
  f.root.querySelector("#canvas-undo").click();
  assert.equal(f.project.layout.blocks[0].w, 1104);
  f.root.querySelector("#canvas-redo").click();
  assert.equal(f.project.layout.blocks[0].w, 1004);
  f.dom.window.close();
});
test("text boxes can be added, edited, resized and removed without deleting pictures", () => {
  const f = fixture();
  f.root.querySelector("#add-heading").click();
  const block = f.project.layout.blocks.find((b) => b.type === "text");
  const text = f.root.querySelector("#element-text");
  text.value = "A project story";
  text.dispatchEvent(new f.window.Event("input"));
  text.dispatchEvent(new f.window.Event("change"));
  const width = f.root.querySelector("#element-w");
  width.value = "900";
  width.dispatchEvent(new f.window.Event("input"));
  width.dispatchEvent(new f.window.Event("change"));
  assert.equal(block.text, "A project story");
  assert.equal(block.w, 900);
  assert.match(f.stage.textContent, /A project story/);
  f.root.querySelector("#delete-element").click();
  assert.equal(f.project.layout.blocks.length, 2);
  assert.equal(f.project.images.length, 2);
  f.dom.window.close();
});
test("multi-file upload appends every picture; a failed upload preserves successful ones", async () => {
  let attempts = 0;
  const f = fixture(async () => {
    attempts++;
    if (attempts === 2) throw Error("Network interrupted");
    return "/media/images/" + String(attempts).repeat(32);
  });
  const input = f.root.querySelector("#canvas-upload");
  const files = ["one.png", "two.png", "three.png"].map(
    (name) => new f.window.File(["png"], name, { type: "image/png" }),
  );
  Object.defineProperty(input, "files", { value: files });
  input.dispatchEvent(new f.window.Event("change"));
  for (let i = 0; i < 20 && !f.busy.includes(false); i++)
    await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(attempts, 3);
  assert.equal(f.project.images.length, 4);
  assert.equal(f.project.layout.blocks.length, 4);
  assert.deepEqual(f.busy, [true, false]);
  assert.match(f.messages.at(-1), /Network interrupted/);
  f.project.layout.blocks
    .filter((b) => b.type === "image")
    .forEach((b) =>
      assert.ok(f.project.images.some((i) => i.id === b.imageId)),
    );
  f.dom.window.close();
});
test("cover selection and caption changes persist, and removing a picture can be undone", () => {
  const f = fixture();
  const second = f.project.images[1];
  f.root.querySelectorAll("[data-asset]")[1].click();
  const caption = f.root.querySelector("#element-caption");
  caption.value = "New caption";
  caption.dispatchEvent(new f.window.Event("input"));
  caption.dispatchEvent(new f.window.Event("change"));
  f.root.querySelector("#make-cover").click();
  assert.equal(f.project.images[0].id, second.id);
  assert.equal(f.project.images[0].caption, "New caption");
  f.root.querySelector("#delete-element").click();
  assert.equal(f.project.images.length, 1);
  f.root.querySelector("#canvas-undo").click();
  assert.equal(f.project.images.length, 2);
  assert.equal(f.project.layout.blocks.length, 2);
  f.dom.window.close();
});

test("the full admin saves multiple uploads and text, then the public project uses that layout", async () => {
  const vm = require("node:vm");
  const content = JSON.parse(readFileSync(path.join(__dirname, "../backend/default-content.json"), "utf8"));
  let saved, uploads = 0;
  function page(url) {
    const html = readFileSync(path.join(__dirname, "../public/index.html"), "utf8");
    const dom = new JSDOM(html, {url, runScripts: "outside-only"});
    dom.window.fetch = async (path, options = {}) => ({ok: true, json: async () => {
      if(path === '/api/status') return {initialized: true, authenticated: true};
      if(path === '/api/upload') return {url: '/media/images/' + String(++uploads).repeat(32)};
      if(options.method === 'PUT') {saved = JSON.parse(options.body); return {ok: true};}
      return JSON.parse(JSON.stringify(saved || content));
    }});
    for(const file of ['editor.js','admin.js','app.js']) vm.runInContext(readFileSync(path.join(__dirname,'../public/'+file),'utf8'),dom.getInternalVMContext());
    return dom;
  }
  const dom = page('https://portfolio.test/my-admin');
  for(let i=0;i<20&&!dom.window.document.querySelector('#canvas-upload');i++) await new Promise(resolve=>setTimeout(resolve,0));
  const doc=dom.window.document,input=doc.querySelector('#canvas-upload');assert.ok(input);
  Object.defineProperty(input,'files',{value:['one.png','two.png'].map(name=>new dom.window.File(['png'],name,{type:'image/png'}))});
  input.dispatchEvent(new dom.window.Event('change'));
  for(let i=0;i<20&&doc.querySelector('#save').disabled;i++) await new Promise(resolve=>setTimeout(resolve,0));
  doc.querySelector('#add-heading').click();
  const text=doc.querySelector('#element-text');text.value='My screenshot story';text.dispatchEvent(new dom.window.Event('input'));text.dispatchEvent(new dom.window.Event('change'));
  doc.querySelector('#save').click();
  for(let i=0;i<20&&!saved;i++) await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(saved.projects[0].images.length,2);assert.equal(saved.projects[0].layout.blocks.length,3);assert.equal(saved.projects[0].layout.blocks[2].text,'My screenshot story');
  const publicPage=page('https://portfolio.test/projects/quizweb');
  for(let i=0;i<20&&!publicPage.window.document.querySelector('.gallery .project-canvas');i++) await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(publicPage.window.document.querySelectorAll('.gallery .canvas-figure img').length,2);assert.match(publicPage.window.document.querySelector('.gallery').textContent,/My screenshot story/);
  publicPage.window.close();dom.window.close();
});

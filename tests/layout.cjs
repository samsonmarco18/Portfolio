const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");
const context = vm.createContext({ crypto: webcrypto });
vm.runInContext(
  readFileSync(
    require("node:path").join(__dirname, "../public/editor.js"),
    "utf8",
  ),
  context,
);
const canvas = context.PortfolioCanvas;
test("legacy galleries keep all images when opening the canvas", () => {
  const project = {
    title: "Project",
    images: [
      { url: "/media/images/" + "a".repeat(32), caption: "First" },
      { url: "/media/images/" + "b".repeat(32), caption: "Second" },
    ],
  };
  const layout = canvas.ensure(project);
  assert.equal(layout.blocks.length, 2);
  assert.notEqual(project.images[0].id, project.images[1].id);
  const firstId = layout.blocks[0].id;
  canvas.ensure(project);
  assert.equal(project.layout.blocks[0].id, firstId);
  const html = canvas.render(project);
  assert.equal((html.match(/<img /g) || []).length, 2);
  assert.ok(html.includes("First") && html.includes("Second"));
});
test("moving and resizing clamp elements inside the canvas", () => {
  const block = { x: -500, y: 9999, w: 2000, h: -50 };
  canvas.constrain(block, 800);
  assert.deepEqual(block, { x: 0, y: 760, w: 1200, h: 40 });
  const resized = { x: 100.777, y: 100.888, w: 700, h: 300 };
  canvas.constrain(resized, 800);
  assert.equal(resized.x, 100.78);
  assert.equal(resized.y, 100.89);
});
test("sixty pictures fit a generated gallery without losing any", () => {
  const project = {
    images: Array.from({ length: 60 }, (_, i) => ({ id: "picture-" + i })),
  };
  const layout = canvas.defaultLayout(project.images);
  assert.equal(layout.blocks.length, 60);
  assert.ok(layout.height <= 30000);
  layout.blocks.forEach((b) => {
    assert.ok(b.x + b.w <= 1200);
    assert.ok(b.y + b.h <= layout.height);
  });
});
test("sixty sequential uploads receive non-overlapping canvas positions", () => {
  const project = { images: [], layout: { height: 800, blocks: [] } };
  for (let i = 0; i < 60; i++) {
    const image = { id: "image-" + i };
    const block = canvas.newImageBlock(project, image);
    project.layout.height = Math.max(
      project.layout.height,
      block.y + block.h + 48,
    );
    assert.ok(project.layout.height <= 30000);
    assert.ok(
      !project.layout.blocks.some(
        (other) =>
          block.x < other.x + other.w &&
          block.x + block.w > other.x &&
          block.y < other.y + other.h &&
          block.y + block.h > other.y,
      ),
    );
    project.images.push(image);
    project.layout.blocks.push(block);
  }
  assert.equal(project.images.length, 60);
});
test("public text is escaped and ordered for mobile while preserving desktop layers", () => {
  const project = {
    images: [],
    layout: {
      height: 800,
      background: "#121212",
      blocks: [
        {
          id: "one",
          type: "text",
          text: "<script>bad()</script>",
          x: 50,
          y: 400,
          w: 500,
          h: 100,
          fontSize: 32,
          color: "#ffffff",
          weight: 400,
          align: "left",
        },
        {
          id: "two",
          type: "text",
          text: "Top heading",
          x: 50,
          y: 50,
          w: 500,
          h: 100,
          fontSize: 64,
          color: "#ffffff",
          weight: 700,
          align: "left",
        },
      ],
    },
  };
  const html = canvas.render(project);
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.indexOf("Top heading") < html.indexOf("&lt;script&gt;"));
  assert.match(html, /z-index:1/);
});

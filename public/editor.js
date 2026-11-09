/* Project canvas: plain JavaScript, shared by the private editor and public pages. */
(() => {
  const WIDTH = 1200;
  const escape = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const id = () => crypto.randomUUID();
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const round = (value) => Math.round(value * 100) / 100;
  function constrain(block, height) {
    block.w = round(clamp(Number(block.w) || 200, 60, WIDTH));
    block.h = round(clamp(Number(block.h) || 100, 40, height));
    block.x = round(clamp(Number(block.x) || 0, 0, WIDTH - block.w));
    block.y = round(clamp(Number(block.y) || 0, 0, height - block.h));
    return block;
  }
  function defaultLayout(images) {
    const blocks = images.map((image, index) => {
      const first = index === 0;
      return {
        id: id(),
        type: "image",
        imageId: image.id,
        x: first ? 48 : 48 + ((index - 1) % 2) * 564,
        y: first ? 48 : 736 + Math.floor((index - 1) / 2) * 440,
        w: first ? 1104 : 540,
        h: first ? 640 : 392,
        fit: "contain",
      };
    });
    return {
      height: Math.max(800, ...blocks.map((b) => b.y + b.h + 48)),
      background: "#1e211f",
      blocks,
    };
  }
  function ensure(project) {
    project.images.forEach((image) => {
      if (!image.id) image.id = id();
    });
    if (!project.layout) project.layout = defaultLayout(project.images);
    return project.layout;
  }
  function newImageBlock(project, image) {
    const blocks = project.layout.blocks;
    const bottom = Math.max(0, ...blocks.map((block) => block.y + block.h));
    const block = {
      id: id(),
      type: "image",
      imageId: image.id,
      x: 48,
      y: bottom + 48,
      w: blocks.length ? 540 : 1104,
      h: blocks.length ? 392 : 620,
      fit: "contain",
    };
    const previous = blocks
      .filter((block) => block.type === "image")
      .sort((a, b) => b.y - a.y || b.x - a.x)[0];
    if (previous && previous.x === 48 && previous.w === 540) {
      const candidate = { ...block, x: 612, y: previous.y };
      if (
        !blocks.some(
          (other) =>
            candidate.x < other.x + other.w &&
            candidate.x + candidate.w > other.x &&
            candidate.y < other.y + other.h &&
            candidate.y + candidate.h > other.y,
        )
      )
        return candidate;
    }
    return block;
  }
  function blockHTML(block, project, editable, layer = 0) {
    let inside;
    if (block.type === "image") {
      const image = project.images.find((image) => image.id === block.imageId);
      if (!image) return "";
      inside =
        '<figure class="canvas-figure"><img draggable="false" src="' +
        escape(image.url) +
        '" alt="' +
        escape(image.caption || project.title) +
        '" style="object-fit:' +
        escape(block.fit || "contain") +
        '">' +
        (image.caption
          ? "<figcaption>" + escape(image.caption) + "</figcaption>"
          : "") +
        "</figure>";
    } else
      inside =
        '<div class="canvas-text" style="font-size:' +
        round(block.fontSize / 12) +
        "cqw;color:" +
        escape(block.color) +
        ";text-align:" +
        escape(block.align) +
        ";font-weight:" +
        block.weight +
        '">' +
        escape(block.text) +
        "</div>";
    return (
      '<div class="canvas-block ' +
      (editable ? "editable-block" : "") +
      '" data-block="' +
      escape(block.id) +
      '" tabindex="' +
      (editable ? "0" : "-1") +
      '" ' +
      (editable
        ? 'role="group" aria-label="' +
          (block.type === "image" ? "Image" : "Text") +
          ' block. Use arrow keys to move."'
        : "") +
      ' style="left:' +
      round(block.x / 12) +
      "%;top:" +
      round((block.y / project.layout.height) * 100) +
      "%;width:" +
      round(block.w / 12) +
      "%;height:" +
      round((block.h / project.layout.height) * 100) +
      "%;--mobile-ratio:" +
      round(block.w / block.h) +
      (editable ? "" : ";z-index:" + layer) +
      '">' +
      inside +
      (editable
        ? '<span class="block-label">' +
          (block.type === "image" ? "IMAGE" : "TEXT") +
          "</span>" +
          ["nw", "ne", "sw", "se"]
            .map(
              (c) =>
                '<button class="resize-handle ' +
                c +
                '" data-resize="' +
                c +
                '" aria-label="Resize ' +
                c +
                ' corner"></button>',
            )
            .join("")
        : "") +
      "</div>"
    );
  }
  function render(project) {
    if (!project.layout || !project.layout.blocks.length) return "";
    return (
      '<div class="project-canvas" style="aspect-ratio:1200/' +
      project.layout.height +
      ";background:" +
      escape(project.layout.background) +
      '">' +
      project.layout.blocks
        .map((block, index) => ({ block, index }))
        .sort((a, b) => a.block.y - b.block.y || a.block.x - b.block.x)
        .map(({ block, index }) => blockHTML(block, project, false, index))
        .join("") +
      "</div>"
    );
  }
  function mount(root, project, options) {
    ensure(project);
    let selection = null,
      history = [],
      future = [],
      uploading = false,
      disposed = false,
      gesture = null;
    root.innerHTML =
      '<div class="studio-tools"><div class="actions"><label class="btn upload-button">＋ Add pictures<input id="canvas-upload" type="file" multiple accept="image/png,image/jpeg,image/webp"></label><button class="btn secondary" id="add-heading">＋ Heading</button><button class="btn secondary" id="add-text">＋ Text</button></div><div class="actions"><button class="icon-btn" id="canvas-undo" aria-label="Undo">↶</button><button class="icon-btn" id="canvas-redo" aria-label="Redo">↷</button><button class="btn secondary" id="canvas-preview">Preview</button></div></div><div class="studio-grid"><aside class="studio-inspector"><div class="inspector-title"><span class="eyebrow">YOUR ELEMENTS</span><span id="image-count"></span></div><div id="asset-tray" class="asset-tray"></div><p class="notice">Upload several at once, or drop pictures onto the canvas.</p><div id="selection-controls"></div><div class="canvas-settings"><label for="canvas-height">Canvas height</label><input id="canvas-height" type="number" min="600" max="30000" step="100"><label for="canvas-background">Canvas color</label><input id="canvas-background" type="color"><button class="btn secondary" id="canvas-arrange">Arrange images in a grid</button></div></aside><div class="studio-workspace"><div class="canvas-ruler"><span>PROJECT CANVAS</span><span>Drag to move · corners to resize</span></div><div class="canvas-scroll"><div id="canvas-stage" class="project-canvas editor-canvas" aria-label="Visual project editor"></div></div><div class="canvas-footer"><span id="canvas-hint" role="status">Select a picture or text block to start editing.</span><span>1200 px wide</span></div></div></div>';
    const $ = (selector) => root.querySelector(selector);
    const stage = $("#canvas-stage");
    const current = () =>
      project.layout.blocks.find((block) => block.id === selection);
    const snapshot = () =>
      JSON.stringify({ images: project.images, layout: project.layout });
    const remember = () => {
      history.push(snapshot());
      if (history.length > 40) history.shift();
      future = [];
      buttons();
    };
    const modified = () => {
      options.onChange();
      buttons();
    };
    function buttons() {
      $("#canvas-undo").disabled = !history.length || uploading;
      $("#canvas-redo").disabled = !future.length || uploading;
    }
    function paint() {
      stage.style.aspectRatio = "1200/" + project.layout.height;
      stage.style.background = project.layout.background;
      stage.innerHTML = project.layout.blocks
        .map((block) => blockHTML(block, project, true))
        .join("");
      stage
        .querySelector('[data-block="' + selection + '"]')
        ?.classList.add("selected");
      $("#canvas-height").value = project.layout.height;
      $("#canvas-background").value = project.layout.background;
      $("#image-count").textContent = project.images.length + " / 60";
      $("#asset-tray").innerHTML = project.images.length
        ? project.images
            .map(
              (image, index) =>
                '<button type="button" draggable="true" data-asset="' +
                escape(image.id) +
                '" class="asset-thumb" title="Select picture ' +
                (index + 1) +
                '"><img src="' +
                escape(image.url) +
                '" alt="Picture ' +
                (index + 1) +
                '"><span>' +
                String(index + 1).padStart(2, "0") +
                (index === 0 ? " · Cover" : "") +
                "</span></button>",
            )
            .join("")
        : '<div class="asset-empty">Your pictures will appear here.<br>Start with a few screenshots.</div>';
      controls();
      buttons();
    }
    function select(value) {
      selection = value;
      stage
        .querySelectorAll(".selected")
        .forEach((el) => el.classList.remove("selected"));
      stage
        .querySelector('[data-block="' + value + '"]')
        ?.classList.add("selected");
      controls();
    }
    function controls() {
      const block = current(),
        panel = $("#selection-controls");
      if (!block) {
        panel.innerHTML =
          '<div class="inspector-empty"><span>↖</span><p>Select an element<br>to make it yours.</p></div>';
        return;
      }
      const image = project.images.find((image) => image.id === block.imageId);
      panel.innerHTML =
        '<div class="inspector-title"><span class="eyebrow">' +
        (image ? "IMAGE SETTINGS" : "TEXT SETTINGS") +
        "</span></div>" +
        (image
          ? '<label for="element-caption">Caption</label><textarea id="element-caption" maxlength="3000">' +
            escape(image.caption) +
            '</textarea><label for="element-fit">Picture fit</label><select id="element-fit"><option value="contain">Show entire picture</option><option value="cover">Fill and crop</option></select><div class="actions inspector-actions"><label class="btn secondary upload-button">Replace<input type="file" id="replace-picture" accept="image/png,image/jpeg,image/webp"></label><button class="btn secondary" id="make-cover">Set as cover</button></div>'
          : '<label for="element-text">Text</label><textarea id="element-text" maxlength="3000">' +
            escape(block.text) +
            '</textarea><div class="property-pair"><div><label for="element-size">Font size</label><input id="element-size" type="number" min="12" max="120" value="' +
            block.fontSize +
            '"></div><div><label for="element-color">Color</label><input id="element-color" type="color" value="' +
            escape(block.color) +
            '"></div></div><div class="property-pair"><div><label for="element-align">Alignment</label><select id="element-align"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></div><div><label for="element-weight">Weight</label><select id="element-weight"><option value="400">Regular</option><option value="700">Bold</option></select></div></div>') +
        '<div class="property-pair">' +
        ["x", "y", "w", "h"]
          .map(
            (key) =>
              '<div><label for="element-' +
              key +
              '">' +
              { x: "Left", y: "Top", w: "Width", h: "Height" }[key] +
              '</label><input id="element-' +
              key +
              '" type="number" step="1" value="' +
              Math.round(block[key]) +
              '"></div>',
          )
          .join("") +
        '</div><div class="actions inspector-actions"><button id="layer-back" class="btn secondary">Send back</button><button id="layer-front" class="btn secondary">Bring front</button></div><button id="delete-element" class="btn danger">Remove ' +
        (image ? "picture" : "text") +
        "</button>";
      const live = (selector, fn) => {
        let saved = false;
        const el = $(selector);
        el.oninput = () => {
          if (!saved) {
            remember();
            saved = true;
          }
          fn(el.value);
          redrawBlock(block);
          modified();
        };
        el.onchange = () => {
          saved = false;
          controls();
        };
      };
      if (image) {
        $("#element-fit").value = block.fit || "contain";
        live("#element-caption", (value) => {
          image.caption = value;
        });
        live("#element-fit", (value) => {
          block.fit = value;
        });
        $("#make-cover").onclick = () => {
          remember();
          project.images.splice(project.images.indexOf(image), 1);
          project.images.unshift(image);
          modified();
          paint();
        };
        $("#replace-picture").onchange = (event) =>
          uploadFiles([...event.target.files], image);
      } else {
        $("#element-align").value = block.align;
        $("#element-weight").value = String(block.weight);
        live("#element-text", (value) => {
          block.text = value;
        });
        live("#element-size", (value) => {
          block.fontSize = clamp(Number(value) || 12, 12, 120);
        });
        live("#element-color", (value) => {
          block.color = value;
        });
        live("#element-align", (value) => {
          block.align = value;
        });
        live("#element-weight", (value) => {
          block.weight = Number(value);
        });
      }
      ["x", "y", "w", "h"].forEach((key) =>
        live("#element-" + key, (value) => {
          block[key] = Number(value);
          constrain(block, project.layout.height);
        }),
      );
      $("#layer-back").onclick = () => layer(false);
      $("#layer-front").onclick = () => layer(true);
      $("#delete-element").onclick = remove;
    }
    function redrawBlock(block) {
      const el = stage.querySelector('[data-block="' + block.id + '"]');
      if (!el) return;
      el.outerHTML = blockHTML(block, project, true);
      stage
        .querySelector('[data-block="' + selection + '"]')
        ?.classList.add("selected");
    }
    function remove() {
      const block = current();
      if (!block) return;
      remember();
      project.layout.blocks = project.layout.blocks.filter(
        (b) => b.id !== block.id,
      );
      if (block.type === "image") {
        project.images = project.images.filter(
          (image) => image.id !== block.imageId,
        );
        project.layout.blocks = project.layout.blocks.filter(
          (b) => b.imageId !== block.imageId,
        );
      }
      selection = null;
      modified();
      paint();
    }
    function layer(front) {
      const block = current();
      if (!block) return;
      remember();
      project.layout.blocks = project.layout.blocks.filter((b) => b !== block);
      front
        ? project.layout.blocks.push(block)
        : project.layout.blocks.unshift(block);
      modified();
      paint();
    }
    function addText(heading) {
      if (project.layout.blocks.length >= 120) {
        options.onMessage("Maximum 120 canvas elements.");
        return;
      }
      remember();
      const block = {
        id: id(),
        type: "text",
        text: heading
          ? "Tell the story behind it."
          : "Add a detail, a thought, or a little context.",
        x: 72,
        y: Math.min(
          96 + project.layout.blocks.length * 24,
          project.layout.height - 200,
        ),
        w: heading ? 800 : 600,
        h: heading ? 180 : 140,
        fontSize: heading ? 64 : 28,
        color: heading ? "#d5f878" : "#efeee6",
        align: "left",
        weight: heading ? 700 : 400,
      };
      project.layout.blocks.push(block);
      selection = block.id;
      modified();
      paint();
      $("#element-text").focus();
    }
    async function uploadFiles(files, replacement) {
      if (uploading || !files.length) return;
      if (!replacement && project.images.length + files.length > 60) {
        options.onMessage("You can add up to 60 pictures per project.");
        return;
      }
      if (!replacement && project.layout.blocks.length + files.length > 120) {
        options.onMessage("Maximum 120 canvas elements.");
        return;
      }
      remember();
      uploading = true;
      options.onBusy(true);
      options.onChange();
      root.classList.add("is-uploading");
      buttons();
      let completed = 0,
        failures = [];
      for (const file of files) {
        if (disposed) break;
        options.onMessage(
          "Uploading " +
            (completed + failures.length + 1) +
            " of " +
            files.length +
            "…",
        );
        try {
          if (file.size > 10 * 1024 * 1024)
            throw Error("Maximum size is 10 MB");
          if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
            throw Error("Use PNG, JPG, or WebP");
          const url = await options.upload(file);
          if (replacement) {
            replacement.url = url;
          } else {
            const image = { id: id(), url, caption: "" };
            const block = newImageBlock(project, image);
            if (block.y + block.h + 48 > 30000)
              throw Error("Canvas is full. Resize or remove elements first.");
            project.layout.height = Math.max(
              project.layout.height,
              block.y + block.h + 48,
            );
            project.images.push(image);
            project.layout.blocks.push(block);
            selection = block.id;
          }
          completed++;
        } catch (error) {
          failures.push(file.name + ": " + error.message);
        }
      }
      uploading = false;
      root.classList.remove("is-uploading");
      options.onBusy(false);
      modified();
      paint();
      options.onMessage(
        (completed
          ? completed + " picture" + (completed === 1 ? "" : "s") + " added. "
          : "") +
          (failures.length
            ? "Could not upload " + failures.join("; ")
            : "Arrange them, then save changes."),
      );
    }
    stage.onpointerdown = (event) => {
      if (uploading || event.button !== 0) return;
      const el = event.target.closest("[data-block]");
      if (!el) {
        select(null);
        return;
      }
      event.preventDefault();
      select(el.dataset.block);
      el.focus();
      const block = current(),
        rect = stage.getBoundingClientRect();
      gesture = {
        pointer: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        original: { ...block },
        corner: event.target.closest("[data-resize]")?.dataset.resize,
        rect,
        remembered: false,
      };
      stage.setPointerCapture(event.pointerId);
    };
    stage.onpointermove = (event) => {
      if (!gesture || gesture.pointer !== event.pointerId) return;
      const dx =
          ((event.clientX - gesture.startX) / gesture.rect.width) * WIDTH,
        dy =
          ((event.clientY - gesture.startY) / gesture.rect.height) *
          project.layout.height;
      if (!gesture.remembered && Math.abs(dx) + Math.abs(dy) < 2) return;
      if (!gesture.remembered) {
        remember();
        gesture.remembered = true;
      }
      const block = current(),
        o = gesture.original,
        c = gesture.corner;
      if (!c) {
        block.x = o.x + dx;
        block.y = o.y + dy;
      } else {
        if (c.includes("e")) block.w = clamp(o.w + dx, 60, WIDTH - o.x);
        if (c.includes("s"))
          block.h = clamp(o.h + dy, 40, project.layout.height - o.y);
        if (c.includes("w")) {
          block.x = clamp(o.x + dx, 0, o.x + o.w - 60);
          block.w = o.x + o.w - block.x;
        }
        if (c.includes("n")) {
          block.y = clamp(o.y + dy, 0, o.y + o.h - 40);
          block.h = o.y + o.h - block.y;
        }
      }
      constrain(block, project.layout.height);
      redrawBlock(block);
      modified();
      $("#canvas-hint").textContent =
        Math.round(block.w) +
        " × " +
        Math.round(block.h) +
        " px · " +
        Math.round(block.x) +
        ", " +
        Math.round(block.y);
    };
    const finish = () => {
      if (gesture) {
        gesture = null;
        controls();
      }
    };
    stage.onpointerup = finish;
    stage.onpointercancel = finish;
    stage.onlostpointercapture = finish;
    stage.ondblclick = (event) => {
      if (event.target.closest("[data-block]")) $("#element-text")?.focus();
    };
    stage.onkeydown = (event) => {
      if (uploading) return;
      const block = current();
      if (!block) return;
      if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      ) {
        event.preventDefault();
        remember();
        const step = event.shiftKey ? 10 : 1;
        block.x +=
          event.key === "ArrowLeft"
            ? -step
            : event.key === "ArrowRight"
              ? step
              : 0;
        block.y +=
          event.key === "ArrowUp"
            ? -step
            : event.key === "ArrowDown"
              ? step
              : 0;
        constrain(block, project.layout.height);
        redrawBlock(block);
        modified();
        controls();
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        remove();
      }
    };
    root.ondragstart = (event) => {
      const asset = event.target.closest("[data-asset]");
      if (asset)
        event.dataTransfer.setData(
          "text/x-portfolio-image",
          asset.dataset.asset,
        );
    };
    root.ondragover = (event) => {
      if (
        event.dataTransfer.types.includes("Files") ||
        event.dataTransfer.types.includes("text/x-portfolio-image")
      ) {
        event.preventDefault();
        stage.classList.add("drop-active");
      }
    };
    root.ondragleave = (event) => {
      if (!root.contains(event.relatedTarget))
        stage.classList.remove("drop-active");
    };
    root.ondrop = (event) => {
      event.preventDefault();
      stage.classList.remove("drop-active");
      if (uploading) return;
      if (event.dataTransfer.files.length) {
        uploadFiles([...event.dataTransfer.files]);
        return;
      }
      const block = project.layout.blocks.find(
        (b) =>
          b.imageId === event.dataTransfer.getData("text/x-portfolio-image"),
      );
      if (block) {
        remember();
        const rect = stage.getBoundingClientRect();
        block.x =
          ((event.clientX - rect.left) / rect.width) * WIDTH - block.w / 2;
        block.y =
          ((event.clientY - rect.top) / rect.height) * project.layout.height -
          block.h / 2;
        constrain(block, project.layout.height);
        selection = block.id;
        modified();
        paint();
      }
    };
    $("#asset-tray").onclick = (event) => {
      const asset = event.target.closest("[data-asset]");
      if (asset) {
        const block = project.layout.blocks.find(
          (b) => b.imageId === asset.dataset.asset,
        );
        if (block) {
          select(block.id);
          stage
            .querySelector('[data-block="' + block.id + '"]')
            ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      }
    };
    $("#canvas-upload").onchange = (event) => {
      uploadFiles([...event.target.files]);
      event.target.value = "";
    };
    $("#add-heading").onclick = () => addText(true);
    $("#add-text").onclick = () => addText(false);
    $("#canvas-undo").onclick = () => restore(history, future);
    $("#canvas-redo").onclick = () => restore(future, history);
    function restore(from, to) {
      if (!from.length || uploading) return;
      to.push(snapshot());
      const value = JSON.parse(from.pop());
      project.images = value.images;
      project.layout = value.layout;
      selection = null;
      modified();
      paint();
    }
    $("#canvas-height").onchange = (event) => {
      remember();
      const bottom = Math.max(
        600,
        ...project.layout.blocks.map((b) => b.y + b.h),
      );
      project.layout.height = clamp(
        Number(event.target.value) || 800,
        bottom,
        30000,
      );
      modified();
      paint();
    };
    $("#canvas-background").onchange = (event) => {
      remember();
      project.layout.background = event.target.value;
      modified();
      paint();
    };
    $("#canvas-arrange").onclick = () => {
      const texts = project.layout.blocks.filter((b) => b.type === "text");
      const arranged = defaultLayout(project.images);
      const required =
        arranged.height +
        texts.reduce((height, block) => height + block.h + 32, 0) +
        48;
      if (required > 30000) {
        options.onMessage(
          "Not enough space to arrange these elements. Shorten text boxes or remove an element first.",
        );
        return;
      }
      remember();
      let y = arranged.height;
      texts.forEach((block) => {
        block.x = 48;
        block.y = y;
        block.w = Math.min(block.w, 1104);
        y += block.h + 32;
      });
      arranged.height = Math.max(arranged.height, y + 48);
      arranged.blocks.push(...texts);
      project.layout = arranged;
      selection = null;
      modified();
      paint();
    };
    $("#canvas-preview").onclick = () => {
      const preview = document.createElement("dialog");
      preview.className = "canvas-preview";
      preview.innerHTML =
        '<div class="preview-top"><span>Unsaved project preview</span><button class="btn secondary" autofocus>Close preview ×</button></div>' +
        render(project);
      preview.querySelector("button").onclick = () => preview.close();
      preview.onclose = () => preview.remove();
      document.body.append(preview);
      preview.showModal();
    };
    paint();
    return {
      destroy() {
        disposed = true;
        gesture = null;
      },
    };
  }
  globalThis.PortfolioCanvas = {
    ensure,
    defaultLayout,
    newImageBlock,
    constrain,
    render,
    mount,
  };
})();

let content,
  dirty = false,
  selected = 0;
const app = document.querySelector("#app");
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
async function api(path, method = "GET", body) {
  let r = await fetch("/api/" + path, {
    method,
    headers:
      body && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {},
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  let d = await r.json();
  if (!r.ok) throw Error(d.error || "Request failed");
  return d;
}
function art(p) {
  if (p.images.length)
    return (
      '<div class="art ' +
      esc(p.theme) +
      '"><img src="' +
      esc(p.images[0].url) +
      '" alt="' +
      esc(p.images[0].caption || p.title) +
      '"></div>'
    );
  let inner =
    p.id === "quizweb"
      ? '<div class="mock"><div class="mockbar"><b>Chalk.</b><span>Learn something new ↗</span></div><div class="mockbody"><div><small>A LITTLE CURIOSITY GOES A LONG WAY</small><h4>Big ideas.<br>Small quizzes.</h4><span class="mockbtn">Let’s get started →</span></div><div class="mocktiles"><div class="tile">Aa</div><div class="tile">✳</div><div class="tile">π</div><div class="tile">?</div></div></div></div>'
      : p.id === "ddpmss"
        ? '<div class="mock mockdashboard"><div class="mockbar"><b>DDPMSS</b><span>Project overview</span></div><div class="mockbody"><small>A CLEARER VIEW OF YOUR PROJECTS</small><h4>Make every<br>decision count.</h4><div class="bars"><i style="height:35%"></i><i style="height:65%"></i><i style="height:50%"></i><i style="height:90%"></i><i style="height:75%"></i><i style="height:100%"></i></div></div></div>'
        : '<div class="orb"></div><div class="harvee">harvee<span style="color:#faf8f2">.</span></div>';
  return (
    '<div class="art ' +
    esc(p.theme) +
    '">' +
    inner +
    '<span class="artlabel">CONCEPT COVER · ADD YOUR SCREENSHOTS</span></div>'
  );
}
function card(p, i) {
  return (
    '<a class="card" href="/projects/' +
    esc(p.id) +
    '">' +
    art(p) +
    '<div class="cardmeta"><div><div class="eyebrow">0' +
    (i + 1) +
    " / " +
    esc(p.category) +
    "</div><h3>" +
    esc(p.title) +
    "</h3><p>" +
    esc(p.description) +
    '</p><span class="notice">View project</span></div><span class="arrow">↗</span></div></a>'
  );
}
function home() {
  app.innerHTML =
    '<section class="hero"><span class="eyebrow">INDEPENDENT DEVELOPER / ' +
    esc(content.name) +
    "</span><h1>" +
    esc(content.intro).replace(
      "Meaningful experiences.",
      "<em>Meaningful</em><br>experiences.",
    ) +
    '</h1><div class="herobottom"><p>I’m ' +
    esc(content.name) +
    '. Welcome to my corner of the internet — a collection of projects, ideas, and things I’ve built.</p><a href="#work" class="roundlink"><span class="circle">↓</span> EXPLORE MY WORK</a></div></section><section id="work"><div class="sectionhead"><h2>Selected work<span style="color:var(--lime)">.</span></h2><small>01 — ' +
    String(content.projects.length).padStart(2, "0") +
    ' / PROJECTS</small></div><div class="projects">' +
    content.projects.map(card).join("") +
    '</div></section><section class="about" id="about"><div><span class="eyebrow">A LITTLE ABOUT ME</span><h2 style="margin-top:12px">Behind the work.</h2>' +
    (content.profile
      ? '<img class="portrait" src="' +
        esc(content.profile) +
        '" alt="' +
        esc(content.name) +
        '">'
      : "") +
    "</div><p>" +
    esc(content.about) +
    '</p></section><section class="contact" id="contact"><span class="eyebrow">HAVE SOMETHING IN MIND?</span><h2>Let’s build something<br><span style="color:var(--lime)">worth sharing.</span></h2>' +
    (content.email
      ? '<a href="mailto:' + esc(content.email) + '">Say hello ↗</a>'
      : '<p class="notice">Open to conversations, collaborations, and new opportunities.</p>') +
    "</section>";
}
function detail(id) {
  let p = content.projects.find((p) => p.id === id);
  if (!p) {
    app.innerHTML =
      '<section class="detail"><h1>Project not found.</h1><a href="/">← Back to work</a></section>';
    return;
  }
  document.title = p.title + " — " + content.name;
  let next =
    content.projects[
      (content.projects.indexOf(p) + 1) % content.projects.length
    ];
  app.innerHTML =
    '<article class="detail"><a class="notice" href="/#work">← ALL PROJECTS</a><h1>' +
    esc(p.title) +
    '</h1><p class="lead">' +
    esc(p.description) +
    '</p><div class="facts"><div><span class="eyebrow">MY ROLE & CONTRIBUTIONS</span><p>' +
    esc(p.role) +
    '</p></div><div><span class="eyebrow">BUILT WITH</span><div>' +
    (p.technologies.length
      ? p.technologies
          .map((t) => '<span class="tag">' + esc(t) + "</span>")
          .join("")
      : '<p class="notice">Details coming soon.</p>') +
    '</div></div><div><span class="eyebrow">TAKE A LOOK</span><p>' +
    (p.url
      ? '<a class="btn" href="' +
        esc(p.url) +
        '" target="_blank" rel="noopener noreferrer">Visit live project ↗</a>'
      : '<span class="notice">Link coming soon.</span>') +
    '</p></div></div><div class="gallery">' +
    (p.images.length
      ? p.images
          .map(
            (i) =>
              '<figure><img src="' +
              esc(i.url) +
              '" alt="' +
              esc(i.caption || p.title) +
              '" loading="lazy"><figcaption>' +
              esc(i.caption) +
              "</figcaption></figure>",
          )
          .join("")
      : art(p) +
        '<p class="notice">Concept cover. Project screenshots and captions will be added soon.</p>') +
    '</div><div class="sectionhead" style="margin-top:70px"><span class="eyebrow">KEEP EXPLORING</span><a href="/projects/' +
    esc(next.id) +
    '">' +
    esc(next.title) +
    " ↗</a></div></article>";
}
async function admin() {
  let s = await api("status");
  if (s.authenticated) {
    editor();
    return;
  }
  app.innerHTML =
    '<section class="admin"><a href="/" class="notice">← BACK TO PORTFOLIO</a><h1>Your little editing space.</h1><p class="notice">' +
    (s.initialized
      ? "Sign in to update your work."
      : s.canSetup
        ? "Create your admin password (at least 12 characters)."
        : "Owner setup is unavailable. Enable secure initial setup before signing in.") +
    '</p><form id="login" class="adminpanel"><label for="password">' +
    (s.initialized ? "Password" : "Create password") +
    '</label><input id="password" type="password" autocomplete="' +
    (s.initialized ? "current-password" : "new-password") +
    '" required minlength="' +
    (s.initialized ? 1 : 12) +
    '"><button class="btn" style="margin-top:20px" ' +
    (!s.initialized && !s.canSetup ? "disabled" : "") +
    ">" +
    (s.initialized ? "Sign in →" : "Create password & sign in →") +
    '</button><p role="status" class="status" id="message"></p></form></section>';
  document.querySelector("#login").onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api("login", "POST", {
        password: document.querySelector("#password").value,
      });
      editor();
    } catch (e) {
      document.querySelector("#message").textContent = e.message;
    }
  };
}
function field(label, key, val, multi = false) {
  return (
    '<label for="' +
    key +
    '">' +
    label +
    "</label><" +
    (multi ? "textarea" : "input") +
    ' id="' +
    key +
    '" ' +
    (!multi ? 'value="' + esc(val) + '"' : "") +
    ">" +
    (multi ? esc(val) + "</textarea>" : "")
  );
}
function editor() {
  let p = content.projects[selected];
  app.innerHTML =
    '<section class="admin"><div class="actions" style="justify-content:space-between"><a href="/" target="_blank" class="notice">VIEW PORTFOLIO ↗</a><button id="logout" class="btn secondary">Sign out</button></div><h1>A little update goes a long way.</h1><p class="notice">Edit your introduction or choose a project. Save when you’re ready.</p><details class="adminpanel"><summary>Homepage & profile</summary>' +
    field("Your name", "name", content.name) +
    field("Headline", "intro", content.intro) +
    field("About me", "about", content.about, true) +
    field("Contact email (optional)", "email", content.email) +
    '<label for="profile">Profile picture</label>' +
    (content.profile
      ? '<img class="portrait" src="' +
        esc(content.profile) +
        '" alt="Profile">'
      : "") +
    '<input id="profile" type="file" accept="image/png,image/jpeg,image/webp"><button type="button" id="removeprofile" class="btn secondary" style="margin-top:10px">Remove profile picture</button></details><div class="admincards">' +
    content.projects
      .map(
        (p, i) =>
          '<button class="admincard ' +
          (i === selected ? "active" : "") +
          '" data-select="' +
          i +
          '"><small>PROJECT 0' +
          (i + 1) +
          "</small>" +
          esc(p.title) +
          '<br><span style="color:var(--lime);font-size:12px">Edit project ↗</span></button>',
      )
      .join("") +
    '</div><div class="adminpanel"><span class="eyebrow">PROJECT DETAILS</span>' +
    field("Project title", "title", p.title) +
    field("Category", "category", p.category) +
    field("Short description", "description", p.description, true) +
    field("My role & contributions", "role", p.role, true) +
    field(
      "Technologies (separate with commas)",
      "technologies",
      p.technologies.join(", "),
    ) +
    field("Live project URL (optional)", "url", p.url) +
    '<label for="images">Screenshots · PNG, JPG, WebP · up to 10 MB each</label><input id="images" type="file" multiple accept="image/png,image/jpeg,image/webp"><p class="notice">The first image becomes the project thumbnail. Use the arrows to reorder.</p><div id="imagelist">' +
    p.images
      .map(
        (img, i) =>
          '<div class="imageedit"><img src="' +
          esc(img.url) +
          '" alt="Screenshot ' +
          (i + 1) +
          '"><div><label for="caption' +
          i +
          '">Caption ' +
          (i + 1) +
          '</label><input id="caption' +
          i +
          '" data-caption="' +
          i +
          '" value="' +
          esc(img.caption) +
          '"><div class="actions" style="margin-top:10px"><button class="btn secondary" data-up="' +
          i +
          '" ' +
          (i === 0 ? "disabled" : "") +
          '>↑ Up</button><button class="btn secondary" data-down="' +
          i +
          '" ' +
          (i === p.images.length - 1 ? "disabled" : "") +
          '>↓ Down</button><button class="btn secondary" data-delete="' +
          i +
          '">Remove</button><label style="margin:0" class="btn secondary">Replace<input type="file" class="hidden" data-replace="' +
          i +
          '" accept="image/png,image/jpeg,image/webp"></label></div></div></div>',
      )
      .join("") +
    '</div></div><div class="savebar"><span id="message" role="status" class="status">' +
    (dirty ? "Unsaved changes" : "Everything is up to date") +
    '</span><button id="save" class="btn">Save changes ↗</button></div></section>';
  ["name", "intro", "about", "email"].forEach(
    (k) =>
      (document.getElementById(k).oninput = (e) => {
        content[k] = e.target.value;
        changed();
      }),
  );
  ["title", "category", "description", "role", "url", "technologies"].forEach(
    (k) =>
      (document.getElementById(k).oninput = (e) => {
        p[k] =
          k === "technologies"
            ? e.target.value
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
            : e.target.value;
        changed();
      }),
  );
  document.querySelectorAll("[data-select]").forEach(
    (b) =>
      (b.onclick = () => {
        selected = +b.dataset.select;
        editor();
      }),
  );
  document.querySelectorAll("[data-caption]").forEach(
    (b) =>
      (b.oninput = () => {
        p.images[+b.dataset.caption].caption = b.value;
        changed();
      }),
  );
  ["up", "down", "delete"].forEach((action) =>
    document.querySelectorAll("[data-" + action + "]").forEach(
      (b) =>
        (b.onclick = () => {
          let i = +b.dataset[action];
          if (action === "delete") p.images.splice(i, 1);
          else {
            let j = i + (action === "up" ? -1 : 1);
            [p.images[i], p.images[j]] = [p.images[j], p.images[i]];
          }
          dirty = true;
          editor();
        }),
    ),
  );
  document.querySelectorAll("[data-replace]").forEach(
    (el) =>
      (el.onchange = async () => {
        if (!el.files[0]) return;
        await uploadTask(async () => {
          p.images[+el.dataset.replace].url = await upload(el.files[0]);
        });
      }),
  );
  document.querySelector("#images").onchange = async (e) => {
    let files = [...e.target.files];
    await uploadTask(async () => {
      for (let f of files) {
        if (p.images.length >= 60) throw Error("Maximum 60 images per project");
        p.images.push({ url: await upload(f), caption: "" });
      }
    });
  };
  document.querySelector("#profile").onchange = async (e) => {
    if (e.target.files[0])
      await uploadTask(async () => {
        content.profile = await upload(e.target.files[0]);
      });
  };
  document.querySelector("#removeprofile").onclick = () => {
    content.profile = "";
    dirty = true;
    editor();
  };
  document.querySelector("#save").onclick = async () => {
    let b = document.querySelector("#save");
    b.disabled = true;
    try {
      await api("content", "PUT", content);
      dirty = false;
      document.querySelector("#message").textContent =
        "Saved — your portfolio is updated.";
    } catch (e) {
      document.querySelector("#message").textContent = e.message;
    } finally {
      b.disabled = false;
    }
  };
  document.querySelector("#logout").onclick = async () => {
    if (dirty && !confirm("Discard unsaved changes and sign out?")) return;
    await api("logout", "POST");
    dirty = false;
    content = await api("content");
    admin();
  };
}
function changed() {
  dirty = true;
  document.querySelector("#message").textContent = "Unsaved changes";
}
async function upload(file) {
  let form = new FormData();
  form.append("image", file);
  return (await api("upload", "POST", form)).url;
}
async function uploadTask(fn) {
  document.querySelector("#message").textContent = "Uploading…";
  document.querySelector("#save").disabled = true;
  try {
    await fn();
    dirty = true;
    editor();
  } catch (e) {
    dirty = true;
    editor();
    document.querySelector("#message").textContent = e.message;
  }
}
window.addEventListener("beforeunload", (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});
(async () => {
  try {
    content = await api("content");
    document.querySelector("#brand").innerHTML =
      esc(content.name.split(" ")[0].toLowerCase()) + "<span>®</span>";
    document.querySelector("#copyright").textContent =
      "© " + new Date().getFullYear() + " " + content.name;
    let path = location.pathname;
    if (path === "/my-admin") {
      document.querySelector('meta[name="description"]').content =
        "Private portfolio editor";
      await admin();
    } else if (path.startsWith("/projects/")) detail(path.split("/")[2]);
    else home();
  } catch (e) {
    app.innerHTML =
      '<p class="error">Could not load portfolio. Please refresh.</p>';
  }
})();

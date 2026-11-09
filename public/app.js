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
function socialLinks() {
  const profiles = [
    ["linkedin", "LinkedIn", "in", "Connect professionally"],
    ["email", "Gmail", "@", "Send me an email"],
    ["facebook", "Facebook", "f", "Find me on Facebook"],
    ["github", "GitHub", "{ }", "Explore my repositories"]
  ];
  const links = profiles.map(([key, label, icon, description]) => {
    const value = (content[key] || "").trim();
    if (!value) return "";
    let href;
    if (key === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "";
      href = "mailto:" + encodeURIComponent(value);
    } else {
      try {
        const url = new URL(value);
        if (url.protocol !== "https:" || url.username || url.password) return "";
        href = url.href;
      } catch { return ""; }
    }
    return '<a class="social-link" href="' + esc(href) + '"' +
      (key === "email" ? "" : ' target="_blank" rel="noopener noreferrer"') +
      '><span class="social-icon" aria-hidden="true">' + icon +
      '</span><span class="social-copy"><strong>' + label + '</strong><small>' + description +
      '</small></span><span aria-hidden="true">&#8599;</span></a>';
  }).join("");
  return links ? '<div class="social-links" aria-label="Contact and social profiles">' + links + '</div>' :
    '<p class="notice">Open to conversations, collaborations, and new opportunities.</p>';
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
    socialLinks() +
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
    '</p><div class="facts"><div><span class="eyebrow">PROJECT OVERVIEW</span><p>' +
    esc(p.role || "Explore the interface and workflows in the screenshots below.") +
    '</p></div><div><span class="eyebrow">PROJECT FOCUS</span><div>' +
    (p.technologies.length
      ? p.technologies
          .map((t) => '<span class="tag">' + esc(t) + "</span>")
          .join("")
      : '<p class="notice">Interface &amp; application workflows.</p>') +
    '</div></div><div><span class="eyebrow">TAKE A LOOK</span><p>' +
    (p.url
      ? '<a class="btn" href="' +
        esc(p.url) +
        '" target="_blank" rel="noopener noreferrer">Visit live project ↗</a>'
      : '<span class="notice">Link coming soon.</span>') +
    '</p></div></div><div class="gallery">' +
    (p.layout?.blocks?.length
      ? PortfolioCanvas.render(p)
      : p.images.length
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
  openPortfolioEditor();
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
window.addEventListener("beforeunload", (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});
(async () => {
  try {
    const [savedResult, defaultsResult] = await Promise.allSettled([
      api("content"),
      fetch("/default-content.json").then(r => { if (!r.ok) throw Error("Defaults unavailable"); return r.json(); })
    ]);
    const defaults = defaultsResult.status === "fulfilled" ? defaultsResult.value : null;
    if (savedResult.status === "fulfilled") content = savedResult.value;
    else if (defaults && location.pathname !== "/my-admin") content = defaults;
    else throw savedResult.reason;
    content.projects = content.projects.map(project => {
      const fallback = defaults?.projects.find(item => item.id === project.id);
      if (!fallback) return project;
      return { ...project,
        images: project.images.length ? project.images : fallback.images,
        description: project.description.includes("Project details coming soon.") ? fallback.description : project.description,
        role: project.role === "Add your role and contributions here." ? "" : project.role
      };
    });
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

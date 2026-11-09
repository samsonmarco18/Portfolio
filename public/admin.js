/* Private editor shell. The API still authorizes every save and upload in PHP. */
let activeDesigner = null;
function openPortfolioEditor() {
  activeDesigner?.destroy();
  const project = content.projects[selected];
  let busy = false;
  app.innerHTML =
    '<section class="admin visual-admin"><div class="studio-heading"><div><span class="eyebrow">YOUR PORTFOLIO, YOUR WAY</span><h1>Make room for your work.</h1><p class="notice">A little canvas for your pictures, words, and ideas.</p></div><div class="actions"><a href="/" target="_blank" rel="noopener" class="btn secondary">View portfolio ↗</a><button id="logout" class="btn secondary">Sign out</button></div></div><details class="adminpanel homepage-settings"><summary>Homepage & profile <span class="notice">Name, introduction, and profile picture</span></summary>' +
    field("Your name", "name", content.name) +
    field("Headline", "intro", content.intro) +
    field("About me", "about", content.about, true) +
    '<div class="social-settings"><h2>Find me online</h2><p class="notice">Add your profile links below. Leave a field empty to hide it from your portfolio.</p>' +
    field("Gmail / contact email (optional)", "email", content.email) +
    field("LinkedIn profile URL (https://www.linkedin.com/in/your-name)", "linkedin", content.linkedin || "") +
    field("Facebook profile URL (https://www.facebook.com/your-name)", "facebook", content.facebook || "") +
    field("GitHub profile URL (https://github.com/your-name)", "github", content.github || "") +
    '</div>' +
    '<label for="profile">Profile picture</label>' +
    (content.profile
      ? '<img class="portrait" src="' +
        esc(content.profile) +
        '" alt="Profile">'
      : "") +
    '<input id="profile" type="file" accept="image/png,image/jpeg,image/webp"><button id="removeprofile" class="btn secondary" style="margin-top:12px">Remove profile picture</button></details><div class="admincards">' +
    content.projects
      .map(
        (p, index) =>
          '<button class="admincard ' +
          (index === selected ? "active" : "") +
          '" data-select="' +
          index +
          '"><small>PROJECT ' +
          String(index + 1).padStart(2, "0") +
          "</small>" +
          esc(p.title) +
          '<span class="project-edit-label">' +
          (index === selected ? "Currently editing" : "Open canvas ↗") +
          "</span></button>",
      )
      .join("") +
    '</div><details class="adminpanel project-details"><summary>Project details <span class="notice">Title, description, technologies & links</span></summary>' +
    field("Project title", "title", project.title) +
    field("Category", "category", project.category) +
    field("Short description", "description", project.description, true) +
    field("My role & contributions", "role", project.role, true) +
    field(
      "Technologies (separate with commas)",
      "technologies",
      project.technologies.join(", "),
    ) +
    field("Live project URL (optional)", "url", project.url) +
    '</details><div id="project-studio" class="project-studio"></div><div class="savebar"><div><strong id="message" role="status" class="status">' +
    (dirty ? "Unsaved changes" : "Ready when you are") +
    '</strong><p class="notice">Your changes go live when you save.</p></div><button id="save" class="btn">Save changes ↗</button></div></section>';
  const message = (text) => {
    document.querySelector("#message").textContent = text;
  };
  function setBusy(value) {
    busy = value;
    document.querySelector("#save").disabled = value;
    document.querySelector("#logout").disabled = value;
    document
      .querySelectorAll(
        "[data-select],.homepage-settings input,.homepage-settings textarea,.homepage-settings button,.project-details input,.project-details textarea",
      )
      .forEach((el) => {
        el.disabled = value;
      });
  }
  ["name", "intro", "about", "email", "linkedin", "facebook", "github"].forEach((key) => {
    document.getElementById(key).oninput = (event) => {
      content[key] = ["email", "linkedin", "facebook", "github"].includes(key) ? event.target.value.trim() : event.target.value;
      changed();
    };
  });
  ["title", "category", "description", "role", "url", "technologies"].forEach(
    (key) => {
      document.getElementById(key).oninput = (event) => {
        project[key] =
          key === "technologies"
            ? event.target.value
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean)
            : event.target.value;
        changed();
      };
    },
  );
  document.querySelectorAll("[data-select]").forEach((button) => {
    button.onclick = () => {
      if (!busy) {
        selected = Number(button.dataset.select);
        openPortfolioEditor();
      }
    };
  });
  document.querySelector("#profile").onchange = async (event) => {
    const file = event.target.files[0];
    if (!file || busy) return;
    setBusy(true);
    message("Uploading profile picture…");
    try {
      content.profile = await upload(file);
      dirty = true;
      openPortfolioEditor();
      message("Profile picture updated. Save to publish.");
    } catch (error) {
      message(error.message);
      setBusy(false);
    }
  };
  document.querySelector("#removeprofile").onclick = () => {
    if (busy) return;
    content.profile = "";
    dirty = true;
    openPortfolioEditor();
  };
  document.querySelector("#logout").onclick = async () => {
    if (busy || (dirty && !confirm("Discard unsaved changes and sign out?")))
      return;
    setBusy(true);
    try {
      await api("logout", "POST");
      activeDesigner?.destroy();
      dirty = false;
      content = await api("content");
      await admin();
    } catch (error) {
      message(error.message);
      setBusy(false);
    }
  };
  document.querySelector("#save").onclick = async () => {
    if (busy) return;
    setBusy(true);
    const studio = document.querySelector("#project-studio");
    studio.inert = true;
    message("Saving your work…");
    try {
      await api("content", "PUT", content);
      dirty = false;
      message("Saved — your portfolio is updated.");
    } catch (error) {
      message(error.message);
    } finally {
      studio.inert = false;
      setBusy(false);
    }
  };
  activeDesigner = PortfolioCanvas.mount(
    document.querySelector("#project-studio"),
    project,
    { onChange: changed, onMessage: message, onBusy: setBusy, upload },
  );
}

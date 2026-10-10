const menuToggle = document.querySelector(".menu-toggle");
const siteNav = document.querySelector("#site-nav");
const lessonGrid = document.querySelector("#lesson-grid");
const lessonStatus = document.querySelector("#lesson-status");
const categoryFilters = document.querySelector(".lesson-filters");

const categoryLabels = {
  "grade-9": "Конспект уроку · 9 клас",
  "grade-10": "Конспект уроку · 10 клас",
  "grade-11": "Конспект уроку · 11 клас",
  presentations: "Презентація уроку",
  tests: "Тест",
  "teacher-documents": "Документ учителя",
};

let lessons = [];
let activeCategory = "all";

menuToggle.addEventListener("click", () => {
  const isExpanded = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!isExpanded));
  menuToggle.setAttribute("aria-label", isExpanded ? "Відкрити меню" : "Закрити меню");
  siteNav.classList.toggle("is-open", !isExpanded);
});

siteNav.addEventListener("click", (event) => {
  if (event.target.closest("a")) {
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Відкрити меню");
    siteNav.classList.remove("is-open");
  }
});

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}

function getSafeUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const url = new URL(value.trim(), document.baseURI);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

function getEmbedUrl(value) {
  const url = getSafeUrl(value);
  if (!url || url.protocol !== "https:") {
    return null;
  }

  if (url.origin === window.location.origin && url.pathname.toLowerCase().endsWith(".pdf")) {
    return url.href;
  }

  const segments = url.pathname.split("/").filter(Boolean);

  if (url.hostname === "docs.google.com") {
    const documentIndex = segments.indexOf("document");
    const presentationIndex = segments.indexOf("presentation");

    if (documentIndex !== -1 && segments[documentIndex + 1] === "d" && segments[documentIndex + 2]) {
      return `https://docs.google.com/document/d/${encodeURIComponent(segments[documentIndex + 2])}/preview`;
    }
    if (presentationIndex !== -1 && segments[presentationIndex + 1] === "d" && segments[presentationIndex + 2]) {
      return `https://docs.google.com/presentation/d/${encodeURIComponent(segments[presentationIndex + 2])}/embed`;
    }
  }

  if (url.hostname === "drive.google.com") {
    const fileIndex = segments.indexOf("file");
    if (fileIndex !== -1 && segments[fileIndex + 1] === "d" && segments[fileIndex + 2]) {
      return `https://drive.google.com/file/d/${encodeURIComponent(segments[fileIndex + 2])}/preview`;
    }
  }

  const isOneDrive = url.hostname === "onedrive.live.com";
  const isSharePointEmbed = url.hostname.endsWith(".sharepoint.com") && /embed\.aspx$/i.test(url.pathname);
  if ((isOneDrive || isSharePointEmbed) && /embed/i.test(url.pathname)) {
    return url.href;
  }

  return null;
}

function createResource(resource) {
  if (!resource || typeof resource !== "object") {
    return null;
  }

  const resourceUrl = getSafeUrl(resource.file || resource.url);
  if (!resourceUrl) {
    return null;
  }

  const details = document.createElement("details");
  details.className = "resource-item";
  const summary = document.createElement("summary");
  const typeLabel = resource.kind === "presentation" ? "Презентація" : "Документ";
  summary.textContent = `${typeLabel}: ${resource.title || "Навчальний матеріал"}`;
  details.append(summary);

  const openLink = document.createElement("a");
  openLink.className = "resource-open";
  openLink.href = resourceUrl.href;
  openLink.target = "_blank";
  openLink.rel = "noopener noreferrer";
  openLink.textContent = resource.file ? "Відкрити або завантажити файл ↗" : "Відкрити матеріал ↗";
  details.append(openLink);

  const embedUrl = getEmbedUrl(resource.url || resource.file);
  if (embedUrl) {
    const frame = document.createElement("iframe");
    frame.className = `resource-embed${resource.kind === "document" ? " is-document" : ""}`;
    frame.src = embedUrl;
    frame.title = `${typeLabel}: ${resource.title || "Навчальний матеріал"}`;
    frame.loading = "lazy";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-presentation");
    frame.allowFullscreen = true;
    details.append(frame);
  }

  return details;
}

function createLessonCard(lesson) {
  const card = document.createElement("article");
  card.className = "lesson-card";

  const header = document.createElement("div");
  header.className = "lesson-card-header";
  const category = createTextElement("span", "lesson-category", categoryLabels[lesson.category]);
  header.append(category);
  if (lesson.date) {
    header.append(createTextElement("span", "lesson-date", lesson.date));
  }
  card.append(header);
  card.append(createTextElement("h3", "", lesson.title.trim()));

  if (lesson.summary) {
    card.append(createTextElement("p", "lesson-summary", lesson.summary));
  }
  if (lesson.body) {
    card.append(createTextElement("div", "lesson-body", lesson.body));
  }

  const resources = Array.isArray(lesson.resources)
    ? lesson.resources.map(createResource).filter(Boolean)
    : [];
  if (resources.length) {
    const resourceList = document.createElement("div");
    resourceList.className = "lesson-resources";
    resources.forEach((resource) => resourceList.append(resource));
    card.append(resourceList);
  }

  return card;
}

function renderLessons() {
  const visibleLessons = lessons.filter((lesson) => (
    lesson
    && typeof lesson === "object"
    && typeof lesson.title === "string"
    && lesson.title.trim()
    && categoryLabels[lesson.category]
    && (activeCategory === "all" || lesson.category === activeCategory)
  ));

  lessonGrid.replaceChildren();
  if (!visibleLessons.length) {
    const emptyMessage = activeCategory === "all"
      ? "Уроків поки немає. Додайте перший матеріал через онлайн-редактор для вчителя."
      : "У цій категорії матеріалів поки немає. Додайте їх через онлайн-редактор.";
    lessonGrid.append(createTextElement("p", "lesson-empty", emptyMessage));
    lessonStatus.textContent = "";
    return;
  }

  visibleLessons.forEach((lesson) => lessonGrid.append(createLessonCard(lesson)));
  lessonStatus.textContent = `Матеріалів у категорії: ${visibleLessons.length}`;
}

categoryFilters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category-filter]");
  if (!button) {
    return;
  }

  activeCategory = button.dataset.categoryFilter;
  categoryFilters.querySelectorAll("[data-category-filter]").forEach((filter) => {
    const isActive = filter === button;
    filter.classList.toggle("is-active", isActive);
    filter.setAttribute("aria-pressed", String(isActive));
  });
  renderLessons();
});

async function loadLessons() {
  try {
    const response = await fetch("content/lessons.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Не вдалося завантажити уроки (HTTP ${response.status}).`);
    }

    const content = await response.json();
    if (!Array.isArray(content)) {
      throw new Error("Файл уроків має містити список матеріалів.");
    }

    lessons = content;
    renderLessons();
  } catch (error) {
    console.error("Помилка завантаження уроків:", error);
    lessonStatus.textContent = "Не вдалося завантажити матеріали. Оновіть сторінку трохи пізніше.";
    lessonGrid.replaceChildren();
  }
}

document.querySelector("#current-year").textContent = new Date().getFullYear();
loadLessons();

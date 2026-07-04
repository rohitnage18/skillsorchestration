const fallbackRoutes = {
  home: {
    title: "Welcome to XYZ Company",
    description:
      "XYZ is a small business built for clarity and confidence. We help modern teams turn a simple idea into a clean, memorable presence online.",
    content: [
      {
        type: "paragraph",
        text: "XYZ Company is a modern small business focused on delivering concise digital experiences. We keep things simple so our clients can move fast without losing quality.",
      },
      {
        type: "cardGrid",
        cards: [
          {
            title: "Focused craftsmanship",
            body: "Every page, interaction, and message is designed to support a clear business goal.",
          },
          {
            title: "Fast delivery",
            body: "We build lean, accessible, and maintainable digital touchpoints that make a strong first impression.",
          },
        ],
      },
    ],
  },
  about: {
    title: "About XYZ",
    description:
      "XYZ was created to help small teams present their work with confidence online. We believe that less is more when the message is strong.",
    content: [
      {
        type: "paragraph",
        text: "At XYZ, we keep our story short and our values clear: simplicity, honesty, and responsiveness. We work with founders and creators who want to be understood quickly.",
      },
      {
        type: "paragraph",
        text: "Our approach is not to add complexity for its own sake, but to make every touchpoint feel intentional.",
      },
    ],
  },
  services: {
    title: "Services",
    description:
      "We offer a focused set of services that help small organizations launch and grow without overbuilding.",
    content: [
      {
        type: "cardGrid",
        cards: [
          {
            title: "Brand presence",
            body: "Clear messaging, visual polish, and approachable design for your public-facing materials.",
          },
          {
            title: "Landing pages",
            body: "Fast-loading, mobile-ready landing pages that turn visitors into leads.",
          },
          {
            title: "Content updates",
            body: "Maintainable pages and content that are easy to refresh as your business evolves.",
          },
        ],
      },
    ],
  },
  contact: {
    title: "Get in touch",
    description:
      "Reach out to learn how XYZ can help your small business build a strong online presence with minimal fuss.",
    content: [
      {
        type: "paragraph",
        text: "Whether you're launching a new project or refreshing an existing one, we're here to help with thoughtful, efficient design and delivery.",
      },
      {
        type: "paragraph",
        text: "Start with a short note about your goals, and we'll respond with the clearest next step.",
      },
      {
        type: "list",
        items: [
          "Email: <a href=\"mailto:hello@xyzcompany.com\">hello@xyzcompany.com</a>",
          "Location: Remote-friendly team",
        ],
      },
    ],
  },
};

let siteRoutes = null;
const contentElement = document.getElementById("route-content");
const navLinks = document.querySelectorAll(".nav-link");

function setActiveLink(routeKey) {
  navLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.route === routeKey);
  });
}

function renderContentBlocks(blocks = []) {
  return blocks
    .map((block) => {
      if (block.type === "cardGrid") {
        return `
          <div class="card-grid">
            ${block.cards
              .map(
                (card) => `
                  <div class="card">
                    <h3>${card.title}</h3>
                    <p>${card.body}</p>
                  </div>
                `
              )
              .join("")}
          </div>
        `;
      }

      if (block.type === "list") {
        return `
          <ul>
            ${block.items.map((item) => `<li>${item}</li>`).join("")}
          </ul>
        `;
      }

      return `<p>${block.text}</p>`;
    })
    .join("");
}

function renderRoute(routeKey) {
  const route = (siteRoutes && siteRoutes[routeKey]) || fallbackRoutes[routeKey] || fallbackRoutes.home;
  document.title = `${route.title} | XYZ Company`;
  contentElement.innerHTML = `
    <section>
      <h2>${route.title}</h2>
      <p>${route.description}</p>
      ${renderContentBlocks(route.content || [])}
    </section>
  `;
  setActiveLink(routeKey);
  contentElement.focus();
}

function getCurrentRoute() {
  const hash = window.location.hash.replace("#", "").replace("/", "");
  return hash || "home";
}

async function loadSiteContent() {
  try {
    const response = await fetch("/api/site");
    if (!response.ok) throw new Error("Unable to load site content");
    const data = await response.json();
    siteRoutes = data.routes;
  } catch (error) {
    siteRoutes = null;
  }

  renderRoute(getCurrentRoute());
}

window.addEventListener("hashchange", () => {
  renderRoute(getCurrentRoute());
});

window.addEventListener("DOMContentLoaded", () => {
  if (!window.location.hash) {
    window.location.hash = "#/home";
  }

  loadSiteContent();
});

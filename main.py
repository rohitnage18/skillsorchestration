from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from pathlib import Path

app = FastAPI(title="XYZ Company Backend", version="0.1.0")

SITE_ROUTES = {
    "home": {
        "title": "Welcome to XYZ Company",
        "description": "XYZ is a small business built for clarity and confidence. We help modern teams turn a simple idea into a clean, memorable presence online.",
        "content": [
            {
                "type": "card",
                "title": "Focused craftsmanship",
                "body": "Every page, interaction, and message is designed to support a clear business goal.",
            },
            {
                "type": "card",
                "title": "Fast delivery",
                "body": "We build lean, accessible, and maintainable digital touchpoints that make a strong first impression.",
            },
        ],
    },
    "about": {
        "title": "About XYZ",
        "description": "XYZ was created to help small teams present their work with confidence online. We believe that less is more when the message is strong.",
        "content": [
            {
                "type": "paragraph",
                "text": "At XYZ, we keep our story short and our values clear: simplicity, honesty, and responsiveness.",
            },
            {
                "type": "paragraph",
                "text": "Our approach is not to add complexity for its own sake, but to make every touchpoint feel intentional.",
            },
        ],
    },
    "services": {
        "title": "Services",
        "description": "We offer a focused set of services that help small organizations launch and grow without overbuilding.",
        "content": [
            {
                "type": "card",
                "title": "Brand presence",
                "body": "Clear messaging, visual polish, and approachable design for your public-facing materials.",
            },
            {
                "type": "card",
                "title": "Landing pages",
                "body": "Fast-loading, mobile-ready landing pages that turn visitors into leads.",
            },
            {
                "type": "card",
                "title": "Content updates",
                "body": "Maintainable pages and content that are easy to refresh as your business evolves.",
            },
        ],
    },
    "contact": {
        "title": "Get in touch",
        "description": "Reach out to learn how XYZ can help your small business build a strong online presence with minimal fuss.",
        "content": [
            {
                "type": "paragraph",
                "text": "Whether you're launching a new project or refreshing an existing one, we're here to help with thoughtful, efficient design and delivery.",
            },
            {
                "type": "paragraph",
                "text": "Start with a short note about your goals, and we'll respond with the clearest next step.",
            },
            {
                "type": "list",
                "items": [
                    "Email: hello@xyzcompany.com",
                    "Location: Remote-friendly team",
                ],
            },
        ],
    },
}


@app.get("/api/site")
def get_site_content():
    return {"site": "XYZ Company", "routes": SITE_ROUTES}


@app.get("/", response_class=HTMLResponse)
def read_root():
    index_path = Path(__file__).resolve().parent / "xyz-frontend" / "index.html"
    return HTMLResponse(index_path.read_text(encoding="utf-8"))

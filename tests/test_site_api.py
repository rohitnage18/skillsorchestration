from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


def test_site_content_endpoint_returns_routes():
    response = client.get("/api/site")
    assert response.status_code == 200
    data = response.json()
    assert "home" in data["routes"]
    assert data["routes"]["home"]["title"] == "Welcome to XYZ Company"


def test_homepage_serves_frontend():
    response = client.get("/")
    assert response.status_code == 200
    assert "XYZ Company" in response.text

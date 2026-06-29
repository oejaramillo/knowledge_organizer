"""Flask application entrypoint for the Research Knowledge Dashboard.

Serves a JSON API under /api/* and a static single-page-app under /.
"""
import os

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

from config import Config

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")


def create_app() -> Flask:
    app = Flask(__name__, static_folder=None)
    app.config.from_object(Config)

    # CORS — allow configured origins on the API.
    origins = Config.CORS_ORIGINS
    cors_origins = "*" if origins.strip() == "*" else [
        o.strip() for o in origins.split(",") if o.strip()
    ]
    CORS(app, resources={r"/api/*": {"origins": cors_origins}})

    # Register API blueprints
    from api.projects import bp as projects_bp
    from api.papers import bp as papers_bp
    from api.claims import bp as claims_bp
    from api.stats import bp as stats_bp
    from api.ideas import bp as ideas_bp

    for bp in (projects_bp, papers_bp, claims_bp, stats_bp, ideas_bp):
        app.register_blueprint(bp)

    # --------------------------------------------------------------------- #
    # Health check
    # --------------------------------------------------------------------- #
    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"})

    # --------------------------------------------------------------------- #
    # Static SPA
    # --------------------------------------------------------------------- #
    @app.get("/")
    def index():
        return send_from_directory(STATIC_DIR, "index.html")

    @app.get("/<path:path>")
    def static_files(path):
        full = os.path.join(STATIC_DIR, path)
        if os.path.isfile(full):
            return send_from_directory(STATIC_DIR, path)
        # SPA fallback
        return send_from_directory(STATIC_DIR, "index.html")

    # --------------------------------------------------------------------- #
    # Error handlers (always JSON for API correctness)
    # --------------------------------------------------------------------- #
    @app.errorhandler(404)
    def not_found(_e):
        return jsonify({"error": "Not found.", "details": None}), 404

    @app.errorhandler(405)
    def method_not_allowed(_e):
        return jsonify({"error": "Method not allowed.", "details": None}), 405

    @app.errorhandler(500)
    def server_error(_e):
        return jsonify({"error": "Internal server error.", "details": None}), 500

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host=Config.HOST, port=Config.PORT, debug=Config.DEBUG)

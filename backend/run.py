import os

from app import create_app
from seed import seed_database

app = create_app(os.getenv("FLASK_ENV", "development"))


@app.cli.command("seed-db")
def seed_db_command():
    """Create baseline departments, years, categories and demo accounts."""
    seed_database()


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    debug = os.getenv("FLASK_DEBUG", "false").lower() in {"1", "true", "yes", "on"}
    app.run(host=os.getenv("HOST", "127.0.0.1"), port=port, debug=debug)

"""App-wide settings read from the environment (.env locally, the service's
environment on Render)."""

from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    # The deployed frontend: every link in a mail (reset link, footer) and the
    # mail's images (/brand/email/*.png) point here.
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "https://nexa.ashytyk.com").rstrip("/")


settings = Settings()

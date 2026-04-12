# Scraper configuration

# Proxy list for rotation (add your proxies here)
PROXIES = [
    # "http://user:pass@proxy1.example.com:8080",
    # "http://user:pass@proxy2.example.com:8080",
]

# Delay settings (seconds)
MIN_DELAY = 2
MAX_DELAY = 5

# Retry configuration
MAX_RETRIES = 3
RETRY_BACKOFF = 2  # Multiplier for exponential backoff

# Browser settings
HEADLESS = True
VIEWPORT_WIDTH = 1280
VIEWPORT_HEIGHT = 900
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

# Output settings
MAX_POSTS = 30

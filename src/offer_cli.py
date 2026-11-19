"""Run the shared discovery engine for the storefront's authenticated backend."""
import json
import sys

import urllib3

from .discovery import analyze, website


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    try:
        result = analyze(website(sys.argv[1]))
    except ValueError as exc:
        result = {"error": str(exc)}
    except (OSError, urllib3.exceptions.HTTPError):
        result = {"error": "The merchant website could not be reached. Check its URL and try again."}
    print(json.dumps(result, ensure_ascii=False))

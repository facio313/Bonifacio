#!/usr/bin/env python3
"""Write one Authelia file-provider user without exposing its password digest."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path


USERNAME = re.compile(r"[a-z0-9][a-z0-9_-]{0,63}\Z")
ARGON2ID = re.compile(
    r"\$argon2id\$v=19\$m=\d+,t=\d+,p=\d+\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+\Z"
)


def yaml_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def write_database(
    path: Path,
    *,
    username: str,
    display_name: str,
    email: str,
    digest: str,
) -> None:
    if not path.is_absolute():
        raise ValueError("output path must be absolute")
    if not USERNAME.fullmatch(username):
        raise ValueError("username must be lowercase ASCII and filesystem-safe")
    if not display_name.strip() or any(ord(char) < 32 for char in display_name):
        raise ValueError("display name is invalid")
    if email != email.strip().lower() or email.count("@") != 1:
        raise ValueError("email must be a normalized address")
    if not ARGON2ID.fullmatch(digest):
        raise ValueError("stdin must contain one complete Argon2id digest")

    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    fd = os.open(path, flags, 0o600)
    payload = (
        "---\n"
        "users:\n"
        f"  {username}:\n"
        "    disabled: false\n"
        f"    displayname: {yaml_string(display_name.strip())}\n"
        f"    password: {yaml_string(digest)}\n"
        f"    email: {yaml_string(email)}\n"
        "    groups:\n"
        "      - owners\n"
        "      - users\n"
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
    except Exception:
        path.unlink(missing_ok=True)
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--username", default="owner")
    parser.add_argument("--display-name", default="Owner")
    parser.add_argument("--email", default="owner@bonifacio.work")
    args = parser.parse_args()
    digest = sys.stdin.readline().strip()
    write_database(
        args.output,
        username=args.username,
        display_name=args.display_name,
        email=args.email,
        digest=digest,
    )
    print(f"Authelia user database created at {args.output}; digest was not printed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

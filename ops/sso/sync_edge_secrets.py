#!/usr/bin/env python3
"""Create file-backed edge secrets and matching root-only Nginx snippets.

The command never prints secret values. Existing secret files are reused so an
application restart and an Nginx reload cannot silently rotate independently.
"""

from __future__ import annotations

import argparse
import os
import pwd
import re
import secrets
import stat
import tempfile
from dataclasses import dataclass
from pathlib import Path


SECRET_PATTERN = re.compile(r"^[A-Za-z0-9_-]{43,128}$")


@dataclass(frozen=True)
class Target:
    secret_path: Path
    nginx_path: Path
    secret_mode: int = 0o600


TARGETS = {
    "admin": Target(
        Path("/home/cks/.config/portfolio-sso/secrets/admin-edge-secret"),
        Path("/etc/nginx/snippets/bonifacio-sso-admin-edge-secret.conf"),
    ),
    "monitor": Target(
        Path("/home/cks/.config/monitor/edge-secret"),
        Path("/etc/nginx/snippets/monitor-edge-secret.conf"),
    ),
    "pilgrimage": Target(
        Path("/home/cks/.config/pilgrimage/edge-secret"),
        Path("/etc/nginx/snippets/pilgrimage-edge-secret.conf"),
        0o640,
    ),
    "feelmyrythm": Target(
        Path("/home/cks/.config/feelmyrythm/sso-edge-secret"),
        Path("/etc/nginx/snippets/feelmyrythm-edge-secret.conf"),
        0o640,
    ),
    "multtara": Target(
        Path("/opt/pongdang-multtara/secrets/sso-edge-secret"),
        Path("/etc/nginx/snippets/multtara-edge-secret.conf"),
        0o640,
    ),
}


def require_safe_directory(
    path: Path,
    *,
    owner_uid: int | None = None,
    require_private: bool = True,
) -> None:
    metadata = path.lstat()
    if not stat.S_ISDIR(metadata.st_mode) or stat.S_ISLNK(metadata.st_mode):
        raise RuntimeError(f"unsafe directory: {path}")
    if owner_uid is not None and metadata.st_uid != owner_uid:
        raise RuntimeError(f"unexpected directory owner: {path}")
    if require_private and metadata.st_mode & 0o077:
        raise RuntimeError(f"directory must be mode 0700: {path}")


def ensure_secret_parent(path: Path, uid: int, gid: int) -> None:
    if path.exists():
        require_safe_directory(path, owner_uid=uid)
        return
    path.mkdir(mode=0o700, parents=False)
    os.chown(path, uid, gid)
    require_safe_directory(path, owner_uid=uid)


def read_or_create_secret(path: Path, uid: int, gid: int, mode: int = 0o600) -> str:
    if mode not in (0o600, 0o640):
        raise ValueError("unsupported secret file mode")
    ensure_secret_parent(path.parent, uid, gid)
    try:
        descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    except FileNotFoundError:
        value = secrets.token_urlsafe(48)
        descriptor = os.open(
            path,
            os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
            mode,
        )
        try:
            os.fchmod(descriptor, mode)
            os.write(descriptor, f"{value}\n".encode())
            os.fsync(descriptor)
            os.fchown(descriptor, uid, gid)
        finally:
            os.close(descriptor)
        directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
        return value

    try:
        metadata = os.fstat(descriptor)
        if (
            not stat.S_ISREG(metadata.st_mode)
            or metadata.st_nlink != 1
            or metadata.st_uid != uid
            or metadata.st_gid != gid
            or stat.S_IMODE(metadata.st_mode) != mode
            or metadata.st_size > 256
        ):
            raise RuntimeError(f"unsafe existing secret file: {path}")
        value = os.read(descriptor, 257).decode("ascii").strip()
    finally:
        os.close(descriptor)
    if not SECRET_PATTERN.fullmatch(value):
        raise RuntimeError(f"invalid existing secret file: {path}")
    return value


def write_nginx_snippet(path: Path, value: str) -> None:
    require_safe_directory(path.parent, owner_uid=0, require_private=False)
    source = f'proxy_set_header X-Portfolio-Edge-Secret "{value}";\n'.encode()
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.",
        dir=path.parent,
    )
    temporary = Path(temporary_name)
    try:
        os.fchmod(descriptor, 0o600)
        os.write(descriptor, source)
        os.fsync(descriptor)
        os.close(descriptor)
        descriptor = -1
        os.replace(temporary, path)
        directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        if descriptor >= 0:
            os.close(descriptor)
        temporary.unlink(missing_ok=True)


def sync(name: str, uid: int, gid: int) -> None:
    target = TARGETS[name]
    value = read_or_create_secret(
        target.secret_path,
        uid,
        gid,
        target.secret_mode,
    )
    write_nginx_snippet(target.nginx_path, value)
    print(f"synchronized {name} edge boundary")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("names", nargs="+", choices=sorted(TARGETS))
    args = parser.parse_args()
    if os.geteuid() != 0:
        parser.error("run as root so the Nginx snippet remains root-only")
    account = pwd.getpwnam("cks")
    for name in dict.fromkeys(args.names):
        sync(name, account.pw_uid, account.pw_gid)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

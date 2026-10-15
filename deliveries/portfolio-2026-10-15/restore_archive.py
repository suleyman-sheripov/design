from pathlib import Path
import argparse
import hashlib
import json
import zipfile


def restore(output=None):
    root = Path(__file__).resolve().parent
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    destination = Path(output) if output else root / manifest["filename"]
    temporary = destination.with_suffix(destination.suffix + ".partial")
    destination.parent.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256()
    size = 0
    try:
        with temporary.open("wb") as assembled:
            for part in manifest["parts"]:
                part_digest = hashlib.sha256()
                part_size = 0
                with (root / part["filename"]).open("rb") as source:
                    while block := source.read(1024 * 1024):
                        assembled.write(block)
                        digest.update(block)
                        part_digest.update(block)
                        size += len(block)
                        part_size += len(block)
                if part_size != part["bytes"] or part_digest.hexdigest() != part["sha256"]:
                    raise ValueError("Archive part failed verification: " + part["filename"])
        if size != manifest["bytes"] or digest.hexdigest() != manifest["sha256"]:
            raise ValueError("Assembled archive failed SHA-256 verification")
        with zipfile.ZipFile(temporary) as archive:
            damaged = archive.testzip()
            if damaged:
                raise ValueError("Damaged ZIP entry: " + damaged)
            if len(archive.infolist()) != manifest["files"]:
                raise ValueError("Unexpected number of files in archive")
        temporary.replace(destination)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise
    print(f"Verified archive: {destination} ({size} bytes)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output")
    restore(parser.parse_args().output)

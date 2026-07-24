"""Frontend-oriented helpers: file tree + language registry."""

from __future__ import annotations

# Lightweight pure-python mirrors of web/src/lib/fileTree.ts + fileTypes for CI without node.


def build_file_tree(paths: list[str]) -> list[dict]:
    root: dict = {"name": "", "path": "", "kind": "dir", "children": {}}
    for path in paths:
        parts = [p for p in path.split("/") if p]
        cur = root
        acc = []
        for i, part in enumerate(parts):
            acc.append(part)
            key = "/".join(acc)
            is_file = i == len(parts) - 1
            kids = cur["children"]
            if key not in kids:
                kids[key] = {
                    "name": part,
                    "path": key,
                    "kind": "file" if is_file else "dir",
                    "children": {},
                }
            cur = kids[key]
    def to_list(node: dict) -> list[dict]:
        out = []
        for child in sorted(node["children"].values(), key=lambda n: (0 if n["kind"] == "dir" else 1, n["name"])):
            item = {"name": child["name"], "path": child["path"], "kind": child["kind"]}
            if child["kind"] == "dir":
                item["children"] = to_list(child)
            out.append(item)
        return out
    return to_list(root)


def language_of(path: str) -> str:
    ext = path.rsplit(".", 1)[-1].lower() if "." in path else ""
    return {
        "html": "html",
        "css": "css",
        "js": "javascript",
        "md": "markdown",
        "yaml": "yaml",
        "yml": "yaml",
        "sql": "sql",
    }.get(ext, "plaintext")


def test_build_nested_tree():
    tree = build_file_tree(["index.html", "src/app.js", "src/styles.css", "README.md"])
    names = {n["name"] for n in tree}
    assert "index.html" in names
    assert "src" in names
    src = next(n for n in tree if n["name"] == "src")
    assert src["kind"] == "dir"
    assert {c["name"] for c in src["children"]} == {"app.js", "styles.css"}


def test_language_registry():
    assert language_of("index.html") == "html"
    assert language_of("notes/README.md") == "markdown"
    assert language_of("deploy/deployment.yaml") == "yaml"

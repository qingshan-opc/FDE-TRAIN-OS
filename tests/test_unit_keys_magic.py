"""Unit tests — object keys, path safety, document magic (no I/O services)."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from services.author.app import _magic_ok
from services.shared.config import DEFAULT_CAMP_ID
from services.shared import resolve_safe, workspace_path
from services.storage import artifact_key, document_key, snapshot_prefix


class ObjectKeyTests(unittest.TestCase):
    def test_document_key_shape(self):
        key = document_key(DEFAULT_CAMP_ID, "doc-1", "abc123", "notes.docx")
        self.assertEqual(key, f"documents/{DEFAULT_CAMP_ID}/doc-1/abc123/notes.docx")

    def test_document_key_strips_path(self):
        key = document_key("c", "d", "sha", "../../evil.pdf")
        self.assertNotIn("..", key)
        self.assertTrue(key.endswith("evil.pdf"))

    def test_snapshot_prefix(self):
        p = snapshot_prefix("camp", "learner", "snap-9")
        self.assertEqual(p, "workspaces/camp/learner/snapshots/snap-9")

    def test_artifact_key(self):
        k = artifact_key("camp", "u1", "sub1", "preview/index.html")
        self.assertEqual(k, "artifacts/camp/u1/sub1/index.html")


class MagicTests(unittest.TestCase):
    def test_pdf_magic(self):
        self.assertTrue(_magic_ok("a.pdf", b"%PDF-1.7...."))
        self.assertFalse(_magic_ok("a.pdf", b"notpdf"))

    def test_docx_magic(self):
        self.assertTrue(_magic_ok("a.docx", b"PK\x03\x04rest"))
        self.assertFalse(_magic_ok("a.docx", b"XX"))
        self.assertFalse(_magic_ok("a.docx", b"P"))  # too short

    def test_text_ok(self):
        self.assertTrue(_magic_ok("a.md", b"# hi"))
        self.assertTrue(_magic_ok("a.txt", b"hello"))


class SandboxTests(unittest.TestCase):
    def test_resolve_safe_ok(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "a.txt").write_text("x", encoding="utf-8")
            p = resolve_safe(root, "a.txt")
            self.assertTrue(p.is_file())

    def test_resolve_safe_escape(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            with self.assertRaises(ValueError):
                resolve_safe(root, "../etc/passwd")

    def test_workspace_path_sanitizes(self):
        p = workspace_path("camp/../x", "learner;rm")
        self.assertTrue(p.exists())
        # sanitized segments must not contain path separators from input
        self.assertNotIn("..", p.name)


if __name__ == "__main__":
    unittest.main()

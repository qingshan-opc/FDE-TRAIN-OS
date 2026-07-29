"""Sandbox / path safety unit tests."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from services.shared import resolve_safe, workspace_path


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
        self.assertIn("camp", str(p))
        self.assertTrue(p.exists())


if __name__ == "__main__":
    unittest.main()

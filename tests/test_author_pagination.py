"""Pagination helper unit tests."""

from services.author.pagination import offset_limit, page_meta, parse_page


def test_parse_page_defaults():
    assert parse_page(None, None) == (1, 20)


def test_parse_page_clamps():
    assert parse_page(0, 0) == (1, 20)
    assert parse_page(-3, 999) == (1, 100)
    assert parse_page("2", "50") == (2, 50)


def test_offset_limit():
    assert offset_limit(1, 20) == (0, 20)
    assert offset_limit(3, 10) == (20, 10)


def test_page_meta():
    meta = page_meta([{"id": 1}], total=42, page=2, page_size=10)
    assert meta == {"items": [{"id": 1}], "total": 42, "page": 2, "page_size": 10}

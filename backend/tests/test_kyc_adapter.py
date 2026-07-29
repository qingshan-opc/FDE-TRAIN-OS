"""KYC provider adapter unit tests (services.application.kyc) — no DB needed.

Covers the stub provider's contract, the http adapter's transport, the
mask_* helpers (the compliance-critical bit — raw ID/name must never reach
a DB write), and the `KYC_PROVIDER` env-driven factory.
"""

from __future__ import annotations

import inspect

import pytest

from services.application.kyc import (
    EnvKycProvider,
    StubKycProvider,
    get_kyc_provider,
    mask_id_tail,
    mask_name,
)


def test_stub_provider_starts_pending():
    result = StubKycProvider().start_verification("user-1", "https://example.com/return")
    assert result["status"] == "pending"
    assert result["provider_ref"].startswith("stub-")


def test_stub_provider_refs_are_unique():
    provider = StubKycProvider()
    a = provider.start_verification("user-1", "")
    b = provider.start_verification("user-1", "")
    assert a["provider_ref"] != b["provider_ref"]


@pytest.mark.parametrize(
    "name,expected",
    [
        (None, None),
        ("", None),
        ("张", "张"),
        ("张三", "张*"),
        ("张三丰", "张**"),
        ("John", "J***"),
    ],
)
def test_mask_name(name, expected):
    assert mask_name(name) == expected


@pytest.mark.parametrize(
    "id_number,expected",
    [
        (None, None),
        ("", None),
        ("123", "***"),
        ("110101199001011234", "011234"),
    ],
)
def test_mask_id_tail(id_number, expected):
    assert mask_id_tail(id_number) == expected


def test_matches_id_tail_legacy_four_digits():
    from services.application.kyc import matches_id_tail

    assert matches_id_tail("011234", "1234") is True
    assert matches_id_tail("011234", "011234") is True
    assert matches_id_tail("011235", "1234") is False


def test_matches_name():
    from services.application.kyc import matches_name

    assert matches_name("张三", "张*") is True
    assert matches_name("李四", "张*") is False


def test_get_kyc_provider_defaults_to_stub(monkeypatch):
    monkeypatch.delenv("KYC_PROVIDER", raising=False)
    provider = get_kyc_provider()
    assert isinstance(provider, StubKycProvider)
    assert provider.name == "stub"


def test_get_kyc_provider_env_selects_http(monkeypatch):
    monkeypatch.setenv("KYC_PROVIDER", "http")
    monkeypatch.setenv("KYC_HTTP_URL", "https://kyc.example.com")
    provider = get_kyc_provider()
    assert isinstance(provider, EnvKycProvider)
    assert provider.name == "http"


def test_get_kyc_provider_override_wins_over_env(monkeypatch):
    monkeypatch.setenv("KYC_PROVIDER", "http")
    provider = get_kyc_provider("stub")
    assert isinstance(provider, StubKycProvider)


def test_env_provider_raises_without_base_url():
    provider = EnvKycProvider("")
    with pytest.raises(RuntimeError):
        provider.start_verification("user-1", "")


def test_env_provider_signature_cannot_carry_raw_identity_fields():
    """Contract check: there is no parameter through which a raw ID number
    or face image could flow into any KycProvider.start_verification."""
    sig = inspect.signature(EnvKycProvider.start_verification)
    assert set(sig.parameters) == {"self", "user_id", "return_url"}


def test_env_provider_start_verification_success(monkeypatch):
    calls: dict = {}

    class _FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"provider_ref": "vendor-ref-1", "status": "pending"}

    class _FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def post(self, url, json=None):
            calls["url"] = url
            calls["json"] = json
            return _FakeResponse()

    import httpx

    monkeypatch.setattr(httpx, "Client", _FakeClient)
    provider = EnvKycProvider("https://kyc.example.com")
    result = provider.start_verification("user-42", "https://app/return")

    assert result == {"provider_ref": "vendor-ref-1", "status": "pending"}
    assert calls["url"] == "https://kyc.example.com/start"
    assert calls["json"] == {"user_id": "user-42", "return_url": "https://app/return"}


def test_env_provider_transport_failure_raises_not_silently_verified(monkeypatch):
    class _FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def post(self, url, json=None):
            raise ConnectionError("boom")

    import httpx

    monkeypatch.setattr(httpx, "Client", _FakeClient)
    provider = EnvKycProvider("https://kyc.example.com")
    with pytest.raises(RuntimeError):
        provider.start_verification("user-1", "")

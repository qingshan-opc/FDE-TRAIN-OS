"""WeChat nickname Latin-1 mojibake repair."""

from services.wechat_mp.profile import decode_wechat_text


def test_decode_wechat_mojibake_name():
    # Screenshot 「好友邀请：å¾é¹」 is UTF-8 bytes shown as Latin-1.
    assert decode_wechat_text("å¾é¹") == "徐鹇"
    assert decode_wechat_text("å¾é¸¿") == "徐鸿"


def test_decode_wechat_keeps_cjk_and_ascii():
    assert decode_wechat_text("徐鸿") == "徐鸿"
    assert decode_wechat_text("Alice") == "Alice"
    assert decode_wechat_text("") == ""
    assert decode_wechat_text(None) == ""

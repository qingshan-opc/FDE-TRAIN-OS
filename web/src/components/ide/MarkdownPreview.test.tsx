import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MarkdownPreview } from "./MarkdownPreview";

describe("MarkdownPreview sanitize", () => {
  it("renders markdown and strips script tags", () => {
    const { container } = render(
      <MarkdownPreview source={"# Title\n\n<script>alert(1)</script>\n\n**bold**"} />,
    );
    expect(container.querySelector("h1")?.textContent).toBe("Title");
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("bold");
  });
});

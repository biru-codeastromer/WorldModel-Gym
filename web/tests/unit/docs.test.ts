import { describe, expect, it } from "vitest";

import {
  DOCS_SECTIONS,
  DOC_SLUGS,
  getDocGroups,
  getDocSection,
  getSectionAnchors
} from "@/content/docs";

describe("docs content registry", () => {
  it("exposes a slug for every section, all unique", () => {
    expect(DOC_SLUGS.length).toBe(DOCS_SECTIONS.length);
    expect(new Set(DOC_SLUGS).size).toBe(DOC_SLUGS.length);
  });

  it("ships the core sections", () => {
    for (const slug of ["overview", "quickstart", "concepts", "submitting-runs", "deployment"]) {
      expect(DOC_SLUGS).toContain(slug);
      expect(getDocSection(slug)?.slug).toBe(slug);
    }
  });

  it("returns undefined for unknown slugs", () => {
    expect(getDocSection("does-not-exist")).toBeUndefined();
  });

  it("gives every section a title, kicker, summary and group", () => {
    for (const section of DOCS_SECTIONS) {
      expect(section.title).toBeTruthy();
      expect(section.kicker).toBeTruthy();
      expect(section.summary).toBeTruthy();
      expect(section.group).toBeTruthy();
      expect(section.blocks.length).toBeGreaterThan(0);
    }
  });

  it("groups sections without dropping any", () => {
    const groups = getDocGroups();
    const total = groups.reduce((n, g) => n + g.sections.length, 0);
    expect(total).toBe(DOCS_SECTIONS.length);
  });

  it("extracts unique heading anchors per section", () => {
    for (const section of DOCS_SECTIONS) {
      const anchors = getSectionAnchors(section);
      const ids = anchors.map((a) => a.id);
      expect(new Set(ids).size).toBe(ids.length);
      anchors.forEach((a) => {
        expect(a.id).toMatch(/^[a-z0-9-]+$/);
        expect(a.text).toBeTruthy();
      });
    }
  });

  it("keeps code blocks non-empty with a language", () => {
    for (const section of DOCS_SECTIONS) {
      for (const block of section.blocks) {
        if (block.kind === "code") {
          expect(block.code.trim().length).toBeGreaterThan(0);
          expect(block.language).toBeTruthy();
        }
      }
    }
  });
});

import { describe, it, expect } from "vitest";
import path from "path";
import { resolveUploadPath, isInlineSafe } from "./uploadPath";

const UPLOADS = path.resolve("/srv/app/uploads");

describe("resolveUploadPath", () => {
  it("resolves an ordinary filename inside the uploads directory", () => {
    const result = resolveUploadPath(UPLOADS, "a1b2c3.png");
    expect(result).toBe(path.join(UPLOADS, "a1b2c3.png"));
  });

  // Express decodes %2f before the handler sees it, so these are the strings
  // that actually arrive from a request like /objects/uploads/..%2f..%2f.env
  it.each([
    "../package.json",
    "../../.env",
    "../../../../../../etc/passwd",
    "subdir/../../escape.txt",
    "..",
  ])("rejects traversal attempt %s", (attempt) => {
    expect(resolveUploadPath(UPLOADS, attempt)).toBeNull();
  });

  it("rejects an absolute path that points elsewhere", () => {
    // path.resolve(base, "/etc/passwd") discards base entirely.
    expect(resolveUploadPath(UPLOADS, path.resolve("/etc/passwd"))).toBeNull();
  });

  it("allows traversal that stays within the directory", () => {
    const result = resolveUploadPath(UPLOADS, "sub/../kept.png");
    expect(result).toBe(path.join(UPLOADS, "kept.png"));
  });

  it("does not treat a sibling directory with a shared prefix as inside", () => {
    // Guards the `startsWith` check: "/srv/app/uploads-evil" must not pass
    // just because it begins with "/srv/app/uploads".
    expect(resolveUploadPath(UPLOADS, "../uploads-evil/x.png")).toBeNull();
  });
});

describe("isInlineSafe", () => {
  it.each([".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf"])(
    "serves %s inline",
    (ext) => {
      expect(isInlineSafe(`/srv/app/uploads/file${ext}`)).toBe(true);
    }
  );

  it.each([".html", ".htm", ".svg", ".xml", ".js", ""])(
    "forces download for %s",
    (ext) => {
      // .html and .svg are the ones that would otherwise execute script in the
      // app's own origin.
      expect(isInlineSafe(`/srv/app/uploads/file${ext}`)).toBe(false);
    }
  );

  it("ignores extension casing", () => {
    expect(isInlineSafe("/srv/app/uploads/PHOTO.PNG")).toBe(true);
    expect(isInlineSafe("/srv/app/uploads/PAYLOAD.SVG")).toBe(false);
  });
});

import path from "path";

/**
 * Resolve a user-supplied upload filename to an absolute path, or `null` if it
 * would escape the uploads directory.
 *
 * Express URL-decodes route params, so `filename` can still contain "../"
 * even though the route pattern matches a single path segment (a request for
 * `..%2f..%2fetc%2fpasswd` matches, then decodes into a traversal). Checking
 * the raw string is not enough either, since `path.join` normalizes "../"
 * away and produces a clean-looking path outside the directory — so the
 * containment check has to happen on the resolved result.
 */
export function resolveUploadPath(
  uploadsDir: string,
  filename: string
): string | null {
  const base = path.resolve(uploadsDir);
  const resolved = path.resolve(base, filename);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    return null;
  }
  return resolved;
}

/**
 * Formats that cannot execute script in the app's origin, and so are safe to
 * render inline. Anything else — notably .html and .svg — must be sent as an
 * attachment, otherwise an uploaded file becomes stored XSS.
 */
const INLINE_SAFE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".pdf",
]);

export function isInlineSafe(filePath: string): boolean {
  return INLINE_SAFE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

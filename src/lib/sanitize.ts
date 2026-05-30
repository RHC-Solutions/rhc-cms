import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize HTML coming from the CMS richtext block before rendering with
 * dangerouslySetInnerHTML. Strips scripts, event handlers, and javascript:
 * URLs while keeping a safe set of structural and inline tags.
 */
export function sanitizeRichText(input: unknown): string {
  if (typeof input !== 'string' || input.length === 0) return '';
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr', 'div', 'span',
      'strong', 'em', 'b', 'i', 'u', 's',
      'ul', 'ol', 'li',
      'blockquote', 'pre', 'code',
      'a', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    ALLOWED_ATTR: [
      'href', 'name', 'target', 'rel',
      'src', 'alt', 'width', 'height', 'loading',
      'class', 'id', 'style',
    ],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
  });
}

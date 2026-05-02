import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window as unknown as Window);

// Allowed tags for attendance content (minimal set for safety)
const ALLOWED_TAGS = [
    'a', 'b', 'br', 'div', 'em', 'i', 'li', 'ol', 'p', 'span', 'strong', 'u', 'ul',
];

// Allowed attributes for attendance content
const ALLOWED_ATTRS = ['href', 'target', 'rel'];

// Configure DOMPurify with strict settings for attendance
const purify = DOMPurify.extend({
    ALLOWED_TAGS,
    ALLOWED_ATTRS,
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target', 'rel'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'form', 'input', 'button', 'textarea', 'select', 'option', 'link', 'meta'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'autofocus', 'oninput'],
});

function escapeHtmlAttribute(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

export function sanitizeAttendanceHtml(content: string): string {
    if (!content || typeof content !== 'string') {
        return '';
    }

    // Remove null bytes and comments first
    let sanitized = content.replaceAll('\u0000', '').replace(/<!--[\s\S]*?-->/g, '');

    // Use DOMPurify for XSS protection
    sanitized = purify.sanitize(sanitized, {
        RETURN_TRUSTED_TYPE: false,
    }) as string;

    // Post-process: validate link hrefs (DOMPurify may allow unsafe protocols)
    sanitized = sanitized.replace(
        /<a\s+href="([^"]*)"[^>]*>/gi,
        (_match, href: string) => {
            const normalizedHref = (href || '').toLowerCase().trim();
            const isSafeHref = normalizedHref.length > 0 && (
                normalizedHref.startsWith('http://') ||
                normalizedHref.startsWith('https://') ||
                normalizedHref.startsWith('mailto:') ||
                normalizedHref.startsWith('tel:') ||
                normalizedHref.startsWith('/') ||
                normalizedHref.startsWith('#')
            );

            if (isSafeHref) {
                const safeRel = 'noopener noreferrer';
                const safeTarget = normalizedHref.startsWith('/') || normalizedHref.startsWith('#')
                    ? ''
                    : ' target="_blank" rel="noopener noreferrer"';
                return `<a href="${escapeHtmlAttribute(href)}"${safeTarget}>`;
            }

            return '<a>';
        }
    );

    return sanitized.trim();
}
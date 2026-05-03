const ALLOWED_ATTENDANCE_HTML_TAGS = new Set(['a', 'b', 'br', 'div', 'em', 'i', 'li', 'ol', 'p', 'span', 'strong', 'u', 'ul']);
const ATTENDANCE_DROP_TAGS = ['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'form', 'input', 'button', 'textarea', 'select', 'option'];

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

    let sanitized = content.replaceAll('\u0000', '').replace(/<!--[\s\S]*?-->/g, '');

    for (const tag of ATTENDANCE_DROP_TAGS) {
        const pairedTagPattern = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
        const singleTagPattern = new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi');
        sanitized = sanitized.replace(pairedTagPattern, '');
        sanitized = sanitized.replace(singleTagPattern, '');
    }

    sanitized = sanitized.replace(/<\s*(\/?)\s*([a-z0-9-]+)([^>]*)>/gi, (_match, closingSlash: string, rawTag: string, rawAttributes: string) => {
        const tag = rawTag.toLowerCase();
        if (!ALLOWED_ATTENDANCE_HTML_TAGS.has(tag)) {
            return '';
        }

        if (closingSlash) {
            return tag === 'br' ? '' : `</${tag}>`;
        }

        if (tag === 'br') {
            return '<br>';
        }

        if (tag === 'a') {
            const hrefMatch = rawAttributes.match(/\shref\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
            const href = (hrefMatch?.[2] ?? hrefMatch?.[3] ?? hrefMatch?.[4] ?? '').trim();
            const normalizedHref = href.toLowerCase();
            const isSafeHref = href.length > 0
                && (
                    normalizedHref.startsWith('http://')
                    || normalizedHref.startsWith('https://')
                    || normalizedHref.startsWith('mailto:')
                    || normalizedHref.startsWith('tel:')
                    || href.startsWith('/')
                    || href.startsWith('#')
                );

            return isSafeHref
                ? `<a href="${escapeHtmlAttribute(href)}" rel="noopener noreferrer" target="_blank">`
                : '<a>';
        }

        return `<${tag}>`;
    });

    return sanitized.trim();
}

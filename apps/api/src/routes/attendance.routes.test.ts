import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeAttendanceHtml } from './attendance-html.js';

test('sanitizeAttendanceHtml removes dangerous tags and attributes while keeping basic formatting', () => {
    const sanitized = sanitizeAttendanceHtml(
        '<p onclick="alert(1)">Oi <strong>time</strong><script>alert(1)</script><img src=x onerror=alert(1) /></p>'
    );

    assert.equal(sanitized, '<p>Oi <strong>time</strong></p>');
});

test('sanitizeAttendanceHtml preserves safe links and hardens anchor attributes', () => {
    const sanitized = sanitizeAttendanceHtml('<a href="https://example.com" onclick="alert(1)">abrir</a>');

    assert.equal(sanitized, '<a href="https://example.com" rel="noopener noreferrer" target="_blank">abrir</a>');
});

test('sanitizeAttendanceHtml strips unsafe protocols from links', () => {
    const sanitized = sanitizeAttendanceHtml('<a href="javascript:alert(1)">malicioso</a>');

    assert.equal(sanitized, '<a>malicioso</a>');
});

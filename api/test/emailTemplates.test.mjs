import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMAIL_TEMPLATES, PREVIEW_VARIABLES, renderEmailTemplate, validateEmailTemplate, shortOrderNumber, safeEmailUrl } from '../dist/services/emailTemplates.js';

test('all default templates validate and render short order numbers in both versions', () => {
  for (const [key, definition] of Object.entries(EMAIL_TEMPLATES)) {
    const template = validateEmailTemplate(key, definition.defaults);
    const result = renderEmailTemplate(template, PREVIEW_VARIABLES, definition.button ? 'https://example.test/account' : undefined);
    assert.ok(result.subject); assert.ok(result.html.startsWith('<!doctype html>'));
    assert.doesNotMatch(result.body, /{{|undefined/);
    if (definition.variables.includes('order_number')) assert.match(result.body, /4bb1e295/);
    if (definition.button) { assert.match(result.html, /href="https:\/\/example.test\/account"/); assert.match(result.body, /https:\/\/example.test\/account/); }
  }
  assert.equal(shortOrderNumber('4bb1e295-3fe5-4978-884f-0d899a2df8ea'), '4bb1e295');
});
test('user content and template markup are escaped, and substitutions run once', () => {
  const template = { ...EMAIL_TEMPLATES.contact.defaults, body: '{{message}}\n\n<b>{{name}}</b>' };
  const result = renderEmailTemplate(template, { message: '<img src=x onerror=alert(1)>{{name}}', name: '<script>bad</script>' });
  assert.doesNotMatch(result.html, /<script>|<img|<b>/);
  assert.match(result.html, /&lt;img/); assert.match(result.body, /{{name}}/);
});
test('invalid placeholders, missing fields and multiline subjects are rejected', () => {
  const defaults = EMAIL_TEMPLATES.password_reset.defaults;
  for (const patch of [{ body: '{{invalid}}' }, { body: '{{name}' }, { buttonText: '' }, { subject: 'hello\r\nBcc: private@example.test' }, { body: '' }]) {
    assert.throws(() => validateEmailTemplate('password_reset', { ...defaults, ...patch }));
  }
});
test('buttons reject unsafe links and preserve reset tokens in safe links', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,x', 'https://user:pass@example.test']) {
    assert.equal(safeEmailUrl(url), undefined);
    const result = renderEmailTemplate(EMAIL_TEMPLATES.password_reset.defaults, PREVIEW_VARIABLES, url);
    assert.doesNotMatch(result.html, /<a /);
  }
  const result = renderEmailTemplate(EMAIL_TEMPLATES.password_reset.defaults, PREVIEW_VARIABLES, 'https://example.test/account/reset-password#token=abc');
  assert.match(result.body, /#token=abc/); assert.match(result.html, /#token=abc/);
});

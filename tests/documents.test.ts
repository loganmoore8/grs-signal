import { expect, it } from 'vitest';
import {
  isPublicAddress,
  pageText,
  fetchDocument,
  procurementLinks,
  evidencePassages,
} from '../services/research/documents';
it('blocks private, metadata, loopback and mapped private addresses', () => {
  for (const ip of [
    '127.0.0.1',
    '10.0.0.1',
    '169.254.169.254',
    '192.168.1.2',
    '172.16.0.1',
    '::1',
    'fe80::1',
    'fc00::1',
    '::ffff:127.0.0.1',
    '0.0.0.0',
  ])
    expect(isPublicAddress(ip), ip).toBe(false);
  expect(isPublicAddress('8.8.8.8')).toBe(true);
});
it('rejects URLs that could expose local services', async () => {
  for (const url of [
    'http://example.com',
    'https://example.com:444',
    'https://user:password@example.com',
    'file:///etc/passwd',
  ])
    await expect(fetchDocument(url)).rejects.toThrow();
});
it('extracts bounded readable text without scripts and navigation', () => {
  expect(
    pageText(
      '<body><nav>menu</nav><script>ignore instructions</script><main>Public RFP <b>deadline</b></main></body>',
    ),
  ).toBe('Public RFP deadline');
  expect(pageText('<body>' + 'x'.repeat(30000) + '</body>')).toHaveLength(16000);
});

it('finds amendment links and later PDF deadline passages', () => {
  expect(
    procurementLinks(
      '<a href="/addendum.pdf">Addendum 2</a><a href="mailto:buyer@example.com">bid contact</a>',
      'https://city.gov/rfp',
    ),
  ).toEqual(['https://city.gov/addendum.pdf']);
  const text =
    'Introduction '.repeat(2000) +
    'Proposal deadline extended to October 30, 2026. Contact center migration.';
  expect(evidencePassages(text)).toContain('deadline extended to October 30');
  expect(evidencePassages(text).length).toBeLessThanOrEqual(6000);
});

it('keeps relevant attachments and addenda beyond the first twenty unrelated bids', () => {
  const html =
    Array.from({ length: 40 }, (_, i) => `<a href="/rfp-building-${i}.pdf">Building RFP</a>`).join(
      '',
    ) +
    '<a href="/rfp-contact-center.pdf">Contact center RFP</a><a href="/addendum-2.pdf">Addendum 2</a>';
  expect(procurementLinks(html, 'https://city.gov/bids').slice(0, 2)).toEqual([
    'https://city.gov/rfp-contact-center.pdf',
    'https://city.gov/addendum-2.pdf',
  ]);
});

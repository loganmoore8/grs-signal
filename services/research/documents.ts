import { request } from 'node:https';
import { lookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
import { load } from 'cheerio';
import { getDocumentProxy } from 'unpdf';
export type SourceDocument = {
  url: string;
  text: string;
  fetched: boolean;
  checkedAt: string;
  title: string;
  links?: string[];
};
export function isPublicAddress(address: string) {
  try {
    let parsed = ipaddr.parse(address);
    if (parsed.kind() === 'ipv6' && (parsed as ipaddr.IPv6).isIPv4MappedAddress())
      parsed = (parsed as ipaddr.IPv6).toIPv4Address();
    return parsed.range() === 'unicast';
  } catch {
    return false;
  }
}
export function pageText(html: string, limit = 16000) {
  const $ = load(html);
  $('script,style,noscript,nav,footer,header,svg').remove();
  return $('body').text().replace(/\s+/g, ' ').trim().slice(0, limit);
}
export async function fetchDocument(
  address: string,
  redirects = 0,
  signal = AbortSignal.timeout(7000),
): Promise<{ url: string; text: string; links?: string[] }> {
  const url = new URL(address);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    (url.port && url.port !== '443') ||
    redirects > 3
  )
    throw new Error('Unsupported source URL');
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address)))
    throw new Error('Nonpublic source address');
  const target = addresses[0]!;
  const result = await new Promise<{ location?: string; body?: Buffer; pdf?: boolean }>(
    (resolve, reject) => {
      const req = request(
        url,
        {
          headers: {
            'user-agent': 'GRS-Signal/1.0 procurement-research',
            accept: 'text/html,text/plain,application/pdf',
          },
          // Pin the validated address to prevent DNS rebinding between validation and connection.
          lookup: (_hostname, _options, callback) => callback(null, target.address, target.family),
          signal,
          family: target.family,
        },
        (res) => {
          if (
            res.statusCode &&
            [301, 302, 303, 307, 308].includes(res.statusCode) &&
            res.headers.location
          ) {
            res.resume();
            resolve({ location: res.headers.location });
            return;
          }
          if (
            res.statusCode !== 200 ||
            !/(?:text\/(?:html|plain)|application\/pdf)/i.test(res.headers['content-type'] || '')
          ) {
            res.resume();
            reject(new Error('Source is unavailable or not an HTML/text document'));
            return;
          }
          const chunks: Buffer[] = [];
          let size = 0;
          res.on('data', (chunk) => {
            size += chunk.length;
            if (size > 8000000) req.destroy(new Error('Source exceeds size limit'));
            else chunks.push(chunk);
          });
          res.on('end', () =>
            resolve({
              body: Buffer.concat(chunks),
              pdf: /application\/pdf/i.test(res.headers['content-type'] || ''),
            }),
          );
          res.on('error', reject);
        },
      );
      req.on('error', reject);
      req.end();
    },
  );
  if (result.location)
    return fetchDocument(new URL(result.location, url).href, redirects + 1, signal);
  if (result.pdf && result.body) {
    const pdf = await getDocumentProxy(new Uint8Array(result.body), { isEvalSupported: false });
    let text = '';
    try {
      for (let page = 1; page <= Math.min(pdf.numPages, 40) && text.length < 96000; page++) {
        if (signal.aborted) throw new Error('Document extraction timed out');
        const content = await (await pdf.getPage(page)).getTextContent();
        text += content.items.map((item) => ('str' in item ? item.str : '')).join(' ') + ' ';
      }
    } finally {
      await pdf.destroy();
    }
    return { url: url.href, text: text.replace(/\s+/g, ' ').trim().slice(0, 96000) };
  }
  const html = result.body?.toString('utf8') || '';
  return { url: url.href, text: pageText(html, 96000), links: procurementLinks(html, url.href) };
}

export function procurementLinks(html: string, base: string) {
  const $ = load(html),
    links = new Set<string>();
  $('a[href]').each((_, a) => {
    const href = $(a).attr('href') || '';
    if (
      !/rfp|solicitation|addend|amend|procurement|bid|proposal|attachment|download/i.test(
        $(a).text() + ' ' + href,
      )
    )
      return;
    try {
      const u = new URL(href, base);
      if (u.protocol === 'https:' && !u.username && !u.password) {
        u.hash = '';
        links.add(u.href);
      }
    } catch {
      /* Ignore malformed links. */
    }
  });
  // Prioritize scope documents and amendments before truncating a busy bid index.
  const rank = (url: string) =>
    (/contact[-_%20]*(?:center|centre)|call[-_%20]*center|ccaas|ivr/i.test(url) ? 4 : 0) +
    (/addend|amend/i.test(url) ? 2 : 0);
  return [...links].sort((a, b) => rank(b) - rank(a)).slice(0, 30);
}
// Keep the opening context and later relevant passages, not just the first PDF pages.
export function evidencePassages(text: string, limit = 6000) {
  if (text.length <= limit) return text;
  let result = text.slice(0, 1800);
  let end = 1800;
  const pattern =
    /contact.center|CCaaS|Amazon Connect|IVR|chatbot|generative AI|citizen|constituent|CRM|knowledge management|cloud modern|cloud migrat|deadline|due date|closing date|proposal.{0,30}due|addend|amend|extended|cancel|awarded/gi;
  for (const match of text.matchAll(pattern)) {
    if (result.length >= limit) break;
    const start = Math.max(end, match.index! - 220);
    const stop = Math.min(text.length, match.index! + 500);
    if (stop <= end) continue;
    result += '\n[separate source passage]\n' + text.slice(start, stop);
    end = stop;
  }
  return result.slice(0, limit);
}

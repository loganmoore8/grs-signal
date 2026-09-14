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
export function pageText(html: string) {
  const $ = load(html);
  $('script,style,noscript,nav,footer,header,svg').remove();
  return $('body').text().replace(/\s+/g, ' ').trim().slice(0, 16000);
}
export async function fetchDocument(
  address: string,
  redirects = 0,
  signal = AbortSignal.timeout(7000),
): Promise<{ url: string; text: string }> {
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
            if (size > 2000000) req.destroy(new Error('Source exceeds size limit'));
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
      for (let page = 1; page <= Math.min(pdf.numPages, 15) && text.length < 16000; page++) {
        if (signal.aborted) throw new Error('Document extraction timed out');
        const content = await (await pdf.getPage(page)).getTextContent();
        text += content.items.map((item) => ('str' in item ? item.str : '')).join(' ') + ' ';
      }
    } finally {
      await pdf.destroy();
    }
    return { url: url.href, text: text.replace(/\s+/g, ' ').trim().slice(0, 16000) };
  }
  return { url: url.href, text: pageText(result.body?.toString('utf8') || '') };
}

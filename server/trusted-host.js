import net from 'node:net';

// DNS rebinding savunması: yalnızca localhost, IP adresi veya .local adıyla gelen
// isteklere izin verilir. Başka bir alan adı bu makineye çözümlense bile reddedilir.
export function isTrustedHost(hostHeader) {
  if (typeof hostHeader !== 'string' || hostHeader === '') return false;
  let host = hostHeader.toLowerCase();
  if (host.startsWith('[')) {
    const end = host.indexOf(']');
    if (end === -1) return false;
    host = host.slice(1, end);
  } else if (net.isIP(host) === 0) {
    host = host.replace(/:\d+$/, '');
  }
  return host === 'localhost' || net.isIP(host) !== 0 || (host.endsWith('.local') && host.length > '.local'.length);
}

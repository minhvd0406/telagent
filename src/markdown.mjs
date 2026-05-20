const TEXT_ESCAPE = /[.!\-()#+=|{}>\\[\]]/g;
const URL_ESCAPE = /[)\\]/g;

function tokenize(text) {
  const out = [];
  let i = 0;
  let start = 0;
  const flush = (end) => {
    if (end > start) out.push({ type: 'text', value: text.slice(start, end) });
  };
  while (i < text.length) {
    if (text.startsWith('```', i)) {
      const end = text.indexOf('```', i + 3);
      if (end === -1) break;
      flush(i);
      out.push({ type: 'code', value: text.slice(i, end + 3) });
      i = end + 3;
      start = i;
      continue;
    }
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1);
      if (end === -1) { i++; continue; }
      flush(i);
      out.push({ type: 'code', value: text.slice(i, end + 1) });
      i = end + 1;
      start = i;
      continue;
    }
    if (text[i] === '[') {
      const b = text.indexOf(']', i + 1);
      if (b !== -1 && text[b + 1] === '(') {
        const p = text.indexOf(')', b + 2);
        if (p !== -1) {
          flush(i);
          out.push({ type: 'link', label: text.slice(i + 1, b), url: text.slice(b + 2, p) });
          i = p + 1;
          start = i;
          continue;
        }
      }
    }
    i++;
  }
  flush(text.length);
  return out;
}

function markerCount(tokens, ch) {
  let n = 0;
  for (const token of tokens) {
    if (token.type !== 'text') continue;
    for (let i = 0; i < token.value.length; i++) {
      if (token.value[i] === '\\') { i++; continue; }
      if (token.value[i] === ch) n++;
    }
  }
  return n;
}

export function escapeMarkdownV2(text) {
  const tokens = tokenize(String(text)).map((token) => {
    if (token.type !== 'text') return token;
    return { ...token, value: token.value.replace(/\*\*([^\n*]+?)\*\*/g, '*$1*').replace(/^(#{1,6})\s+(.+)$/gm, '*$2*') };
  });
  const extra = ['*', '_', '~', '`'].filter((ch) => markerCount(tokens, ch) % 2 === 1);
  const re = extra.length
    ? new RegExp(`[.!\\-()#+=|{}>\\\\\\[\\]${extra.map((c) => '\\' + c).join('')}]`, 'g')
    : TEXT_ESCAPE;
  return tokens.map((token) => {
    if (token.type === 'code') return token.value;
    if (token.type === 'link') {
      return `[${token.label.replace(re, '\\$&')}](${token.url.replace(URL_ESCAPE, '\\$&')})`;
    }
    return token.value.replace(re, '\\$&');
  }).join('');
}

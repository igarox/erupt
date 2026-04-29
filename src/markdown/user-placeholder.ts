const USER_TOKEN = '{{USER}}';
const TOKEN_RE = /\{\{USER\}\}/g;

export function substituteUserPlaceholder(el: HTMLElement, name: string): void {
  const replacement = name.trim() || USER_TOKEN;
  walkTextNodes(el, replacement);
}

function walkTextNodes(node: Node, replacement: string): void {
  if (isCodeOrPre(node)) return;

  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    if (text.includes(USER_TOKEN)) {
      node.textContent = text.replace(TOKEN_RE, replacement);
    }
    return;
  }

  for (const child of Array.from(node.childNodes)) {
    walkTextNodes(child, replacement);
  }
}

function isCodeOrPre(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  const tag = (node as Element).tagName;
  return tag === 'CODE' || tag === 'PRE';
}

export function getAttr(el: Element, name: string): string | undefined {
  const val = el.getAttribute(name);
  return val !== null ? val : undefined;
}

export function getFloatAttr(el: Element, name: string, fallback: number = 0): number {
  const val = el.getAttribute(name);
  if (val === null) return fallback;
  const num = parseFloat(val);
  return isNaN(num) ? fallback : num;
}

export function getChildElements(el: Element, tagName: string): Element[] {
  const results: Element[] = [];
  for (let i = 0; i < el.children.length; i++) {
    const child = el.children[i];
    if (child.localName === tagName || child.tagName === tagName) {
      results.push(child);
    }
  }
  return results;
}

export function getFirstChild(el: Element, tagName: string): Element | null {
  for (let i = 0; i < el.children.length; i++) {
    const child = el.children[i];
    if (child.localName === tagName || child.tagName === tagName) {
      return child;
    }
  }
  return null;
}

export function getAllDescendants(el: Element, tagName: string): Element[] {
  const results: Element[] = [];
  const all = el.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    if (all[i].localName === tagName) {
      results.push(all[i]);
    }
  }
  return results;
}

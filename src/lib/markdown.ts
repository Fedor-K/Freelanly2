import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { slugify } from '@/lib/utils';

export interface TocItem {
  level: number;
  text: string;
  id: string;
}

// Blog content is Markdown produced by the content-autopilot pipeline (AI) or
// the admin. It is NOT trusted raw HTML — sanitize the rendered output so a
// prompt-injected / compromised article can't inject <script> or onerror XSS.
const SANITIZE_OPTS: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'ul', 'ol', 'li',
    'blockquote', 'strong', 'em', 'b', 'i', 'u', 's', 'del', 'code', 'pre',
    'hr', 'br', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'img', 'figure', 'figcaption',
  ],
  allowedAttributes: {
    a: ['href', 'name', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    code: ['class'],
    span: ['class'],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
    '*': ['id'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    // Force safe rel on every link (prevents tabnabbing / referrer leak).
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
  },
};

/**
 * Inject id="<slug>" into h2/h3 so the table of contents can anchor-link.
 * Uses the same slugify as extractToc() so ids match the ToC items.
 */
function addHeadingIds(html: string): string {
  return html.replace(
    /<(h[2-3])([^>]*)>([\s\S]*?)<\/\1>/gi,
    (match, tag: string, attrs: string, inner: string) => {
      if (/\bid=/.test(attrs)) return match;
      const text = inner.replace(/<[^>]*>/g, '').trim();
      if (!text) return match;
      return `<${tag}${attrs} id="${slugify(text)}">${inner}</${tag}>`;
    }
  );
}

/** Render AI/admin Markdown to sanitized HTML with heading anchors. */
export function renderMarkdown(md: string): string {
  const rawHtml = marked.parse(md, { async: false }) as string;
  return sanitizeHtml(addHeadingIds(rawHtml), SANITIZE_OPTS);
}

/** Build a table of contents from Markdown ## / ### headings. */
export function extractToc(md: string): TocItem[] {
  const items: TocItem[] = [];
  const re = /^(#{2,3})\s+(.+?)\s*#*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    const level = m[1].length;
    const text = m[2].replace(/[*_`]/g, '').trim();
    if (text) items.push({ level, text, id: slugify(text) });
  }
  return items;
}

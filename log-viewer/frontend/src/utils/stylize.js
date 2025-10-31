/**
 * Stylize - Log line styling and highlighting utility with ANSI color support
 */
export class Stylize {
  constructor(styleMap) {
    if (typeof styleMap === 'undefined' || !styleMap.length) {
      styleMap = [
        { keyword: 'ERROR', style: 'color: red; font-weight: bold;' },
        { keyword: 'WARN', style: 'color: yellow;' },
        { keyword: 'INFO', style: 'color: limegreen;' },
        { keyword: 'DEBUG', style: 'color: cyan;' },
        { keyword: 'TRACE', style: 'color: blue;' },
      ];
    }

    this._map = styleMap;
    this._initAnsiColors();
  }

  _initAnsiColors() {
    // ANSI color code to CSS color mapping
    this.ansiColors = {
      // Standard colors (30-37, 40-47)
      '30': '#000000', '40': '#000000', // black
      '31': '#cd3131', '41': '#cd3131', // red
      '32': '#0dbc79', '42': '#0dbc79', // green
      '33': '#e5e510', '43': '#e5e510', // yellow
      '34': '#2472c8', '44': '#2472c8', // blue
      '35': '#bc3fbc', '45': '#bc3fbc', // magenta
      '36': '#11a8cd', '46': '#11a8cd', // cyan
      '37': '#e5e5e5', '47': '#e5e5e5', // white

      // Bright colors (90-97, 100-107)
      '90': '#666666', '100': '#666666', // bright black (gray)
      '91': '#f14c4c', '101': '#f14c4c', // bright red
      '92': '#23d18b', '102': '#23d18b', // bright green
      '93': '#f5f543', '103': '#f5f543', // bright yellow
      '94': '#3b8eea', '104': '#3b8eea', // bright blue
      '95': '#d670d6', '105': '#d670d6', // bright magenta
      '96': '#29b8db', '106': '#29b8db', // bright cyan
      '97': '#ffffff', '107': '#ffffff', // bright white
    };
  }

  get map() {
    return this._map;
  }

  set map(styleMap) {
    this._map = styleMap;
  }

  esc(string) {
    const entityMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '`': '&#x60;',
      '=': '&#x3D;',
      '/': '&#x2F;',
    };

    return String(string).replace(/[&<>"'`=\/]/g, (s) => entityMap[s]);
  }

  hash(string) {
    let hash = 0;

    if (string.length === 0) {
      return hash;
    }

    for (let i = 0; i < string.length; i++) {
      const chr = string.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }

    return hash;
  }

  set(keyword, style) {
    // @todo Check if it exists, and update it
    this._map.push({
      keyword: keyword,
      style: style,
    });
  }

  /**
   * Parse ANSI escape codes and convert to HTML with CSS styling
   */
  parseAnsi(line) {
    // Check if line contains ANSI codes
    if (!line.includes('\x1b[') && !line.includes('\u001b[')) {
      return this.esc(line);
    }

    let result = '';
    let currentStyles = {
      color: null,
      bgColor: null,
      bold: false,
      dim: false,
      italic: false,
      underline: false,
    };

    // Regular expression to match ANSI escape sequences
    // Matches: ESC[<codes>m where codes is semicolon-separated numbers
    const ansiRegex = /\x1b\[([0-9;]*)m/g;
    let lastIndex = 0;
    let match;

    while ((match = ansiRegex.exec(line)) !== null) {
      // Add text before this escape code
      if (match.index > lastIndex) {
        const text = line.substring(lastIndex, match.index);
        result += this._wrapWithStyles(this.esc(text), currentStyles);
      }

      // Parse the codes
      const codes = match[1] ? match[1].split(';') : ['0'];

      for (let code of codes) {
        code = code.trim();

        if (code === '' || code === '0') {
          // Reset all styles
          currentStyles = {
            color: null,
            bgColor: null,
            bold: false,
            dim: false,
            italic: false,
            underline: false,
          };
        } else if (code === '1') {
          currentStyles.bold = true;
        } else if (code === '2') {
          currentStyles.dim = true;
        } else if (code === '3') {
          currentStyles.italic = true;
        } else if (code === '4') {
          currentStyles.underline = true;
        } else if (code === '22') {
          currentStyles.bold = false;
          currentStyles.dim = false;
        } else if (code === '23') {
          currentStyles.italic = false;
        } else if (code === '24') {
          currentStyles.underline = false;
        } else if (code === '39') {
          currentStyles.color = null;
        } else if (code === '49') {
          currentStyles.bgColor = null;
        } else if (this.ansiColors[code]) {
          // Foreground colors (30-37, 90-97)
          if (code.startsWith('3') || code.startsWith('9')) {
            currentStyles.color = this.ansiColors[code];
          }
          // Background colors (40-47, 100-107)
          else if (code.startsWith('4') || code.startsWith('10')) {
            currentStyles.bgColor = this.ansiColors[code];
          }
        }
      }

      lastIndex = ansiRegex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < line.length) {
      const text = line.substring(lastIndex);
      result += this._wrapWithStyles(this.esc(text), currentStyles);
    }

    return result || this.esc(line);
  }

  /**
   * Wrap text with HTML span and CSS styles
   */
  _wrapWithStyles(text, styles) {
    if (!text) return '';

    const styleAttrs = [];

    if (styles.color) {
      styleAttrs.push(`color: ${styles.color}`);
    }
    if (styles.bgColor) {
      styleAttrs.push(`background-color: ${styles.bgColor}`);
    }
    if (styles.bold) {
      styleAttrs.push('font-weight: bold');
    }
    if (styles.dim) {
      styleAttrs.push('opacity: 0.6');
    }
    if (styles.italic) {
      styleAttrs.push('font-style: italic');
    }
    if (styles.underline) {
      styleAttrs.push('text-decoration: underline');
    }

    if (styleAttrs.length > 0) {
      return `<span style="${styleAttrs.join('; ')}">${text}</span>`;
    }

    return text;
  }

  parse(line) {
    // First, parse ANSI codes
    const ansiParsed = this.parseAnsi(line);

    // Then apply keyword-based styling if no ANSI codes were found
    // (Skip keyword styling if ANSI codes were present to avoid double-escaping)
    if (line.includes('\x1b[') || line.includes('\u001b[')) {
      return ansiParsed;
    }

    // Apply keyword-based styling
    for (let i = 0; i < this._map.length; i++) {
      let { keyword, style } = this._map[i];
      let match, re;

      if (match = keyword.match(new RegExp('^/(.+?)/([gimy]*)$'))) {
        re = new RegExp(match[1], match[2]);
      } else {
        re = new RegExp(keyword);
      }

      if (re.test(line)) {
        return '<span class="stylized k' + this.hash(keyword) + ' h' + this.hash(line) + '" style="' + style + '">' + this.esc(line) + '</span>';
      }
    }

    // No styling applied, just escape
    return this.esc(line);
  }
}

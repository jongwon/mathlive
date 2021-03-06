/**
 * This module contains metrics regarding fonts and individual symbols. The sigma
 * and xi variables, as well as the METRICS_MAP map contain data extracted from
 * TeX, TeX font metrics, and the TTF files. These data are then exposed via the
 * `metrics` variable and the getCharacterMetrics function.
 */
import METRICS_MAP from './font-metrics-data';

// This METRICS_MAP contains a mapping from font name and character code to character
// metrics, including height, depth, italic correction, and skew (kern from the
// character to the corresponding \skewchar)
// This map is generated via `make metrics`. It should not be changed manually.

interface CharacterMetrics {
  defaultMetrics: boolean;
  depth: number;
  height: number;
  italic: number;
  skew: number;
}
// Const hangulRegex = /[\uAC00-\uD7AF]/;

// This regex combines
// - Hiragana: [\u3040-\u309F]
// - Katakana: [\u30A0-\u30FF]
// - CJK ideograms: [\u4E00-\u9FAF]
// - Hangul syllables: [\uAC00-\uD7AF]
// Notably missing are half width Katakana and Romaji glyphs.
const cjkRegex = /[\u3040-\u309F]|[\u30A0-\u30FF]|[\u4E00-\u9FAF]|[\uAC00-\uD7AF]/;

/*
 *
 * In TeX, there are actually three sets of dimensions, one for each of
 * textstyle, scriptstyle, and scriptscriptstyle.  These are provided in the
 * the arrays below, in that order.
 *
 * The font metrics are stored in fonts cmsy10, cmsy7, and cmsy5 respectively.
 * This was determined by running the following script:
 *``` bash
      latex -interaction=nonstopmode \
      '\documentclass{article}\usepackage{amsmath}\begin{document}' \
      '$a$ \expandafter\show\the\textfont2' \
      '\expandafter\show\the\scriptfont2' \
      '\expandafter\show\the\scriptscriptfont2' \
      '\stop'
  ```
 * The metrics themselves were retrieved using the following commands:
 * ``` bash
      tftopl cmsy10
      tftopl cmsy7
      tftopl cmsy5
    ```
 *
 * The output of each of these commands is quite lengthy.  The only part we
 * care about is the FONTDIMEN section. Each value is measured in EMs.
 * @memberof module:fontMetrics
 */
export const SIGMAS = {
  slant: [0.25, 0.25, 0.25], // Sigma1
  space: [0, 0, 0], // Sigma2
  stretch: [0, 0, 0], // Sigma3
  shrink: [0, 0, 0], // Sigma4
  xHeight: [0.431, 0.431, 0.431], // Sigma5
  quad: [1, 1.171, 1.472], // Sigma6
  extraSpace: [0, 0, 0], // Sigma7
  num1: [0.677, 0.732, 0.925], // Sigma8
  num2: [0.394, 0.384, 0.387], // Sigma9
  num3: [0.444, 0.471, 0.504], // Sigma10
  denom1: [0.686, 0.752, 1.025], // Sigma11
  denom2: [0.345, 0.344, 0.532], // Sigma12
  sup1: [0.413, 0.503, 0.504], // Sigma13
  sup2: [0.363, 0.431, 0.404], // Sigma14
  sup3: [0.289, 0.286, 0.294], // Sigma15
  sub1: [0.15, 0.143, 0.2], // Sigma16
  sub2: [0.247, 0.286, 0.4], // Sigma17
  supDrop: [0.386, 0.353, 0.494], // Sigma18
  subDrop: [0.05, 0.071, 0.1], // Sigma19
  delim1: [2.39, 1.7, 1.98], // Sigma20
  delim2: [1.01, 1.157, 1.42], // Sigma21
  axisHeight: [0.25, 0.25, 0.25], // Sigma22
};

// These font metrics are extracted from TeX by using
// \font\a=cmex10
// \showthe\fontdimenX\a
// where X is the corresponding variable number. These correspond to the font
// parameters of the extension fonts (family 3). See the TeXbook, page 433
// const xi1 = 0; // Slant per pt
// const xi2 = 0; // Interword space
// const xi3 = 0; // Interword stretch
// const xi4 = 0; // Interword shrink
// const xi5 = 0.431; // x-height
// const xi6 = 1; // Quad width
// const xi7 = 0; // Extra space
const xi8 = 0.04; // Default rule thickness, TexBook p.390
const xi9 = 0.111;
const xi10 = 0.166;
const xi11 = 0.2;
const xi12 = 0.6;
export const xi13 = 0.1;
// Note: xi14: offset from baseline for superscript TexBook p. 179
// Note: xi16: offset from baseline for subscript

// This value determines how large a pt is, for metrics which are defined in
// terms of pts.
// This value is also used in katex.less; if you change it make sure the values
// match.
const ptPerEm = 10;

// A table of size -> font size for the different sizing functions
export const SIZING_MULTIPLIER = {
  size1: 0.5,
  size2: 0.7,
  size3: 0.8,
  size4: 0.9,
  size5: 1.0,
  size6: 1.2,
  size7: 1.44,
  size8: 1.728,
  size9: 2.074,
  size10: 2.488,
};

/*
 * This is just a mapping from common names to real metrics
 */
export const METRICS = {
  defaultRuleThickness: xi8,
  bigOpSpacing1: xi9,
  bigOpSpacing2: xi10,
  bigOpSpacing3: xi11,
  bigOpSpacing4: xi12,
  bigOpSpacing5: xi13,
  ptPerEm,
  pxPerEm: (ptPerEm * 4) / 3, // A CSS pt is fixed at 1.333px
  // The space between adjacent `|` columns in an array definition. From
  // article.cls.txt:455
  doubleRuleSep: 2 / ptPerEm,
  arraycolsep: 5 / ptPerEm,
  baselineskip: 12 / ptPerEm,
  arrayrulewidth: 0.4 / ptPerEm,
  fboxsep: 3 / ptPerEm, // From letter.dtx:1626
  fboxrule: 0.4 / ptPerEm, // From letter.dtx:1627
};

// These are very rough approximations.  We default to Times New Roman which
// should have Latin-1 and Cyrillic characters, but may not depending on the
// operating system.  The metrics do not account for extra height from the
// accents.  In the case of Cyrillic characters which have both ascenders and
// descenders we prefer approximations with ascenders, primarily to prevent
// the fraction bar or root line from intersecting the glyph.
// TODO(kevinb) allow union of multiple glyph metrics for better accuracy.
const extraCharacterMap = {
  '\u00A0': '\u0020', // NON-BREAKING SPACE is like space
  '\u200B': '\u0020', // ZERO WIDTH SPACE is like space
  // Latin-1
  'Å': 'A',
  'Ç': 'C',
  'Ð': 'D',
  'Þ': 'o',
  'å': 'a',
  'ç': 'c',
  'ð': 'd',
  'þ': 'o',

  // Cyrillic
  'А': 'A',
  'Б': 'B',
  'В': 'B',
  'Г': 'F',
  'Д': 'A',
  'Е': 'E',
  'Ж': 'K',
  'З': '3',
  'И': 'N',
  'Й': 'N',
  'К': 'K',
  'Л': 'N',
  'М': 'M',
  'Н': 'H',
  'О': 'O',
  'П': 'N',
  'Р': 'P',
  'С': 'C',
  'Т': 'T',
  'У': 'y',
  'Ф': 'O',
  'Х': 'X',
  'Ц': 'U',
  'Ч': 'h',
  'Ш': 'W',
  'Щ': 'W',
  'Ъ': 'B',
  'Ы': 'X',
  'Ь': 'B',
  'Э': '3',
  'Ю': 'X',
  'Я': 'R',
  'а': 'a',
  'б': 'b',
  'в': 'a',
  'г': 'r',
  'д': 'y',
  'е': 'e',
  'ж': 'm',
  'з': 'e',
  'и': 'n',
  'й': 'n',
  'к': 'n',
  'л': 'n',
  'м': 'm',
  'н': 'n',
  'о': 'o',
  'п': 'n',
  'р': 'p',
  'с': 'c',
  'т': 'o',
  'у': 'y',
  'ф': 'b',
  'х': 'x',
  'ц': 'n',
  'ч': 'n',
  'ш': 'w',
  'щ': 'w',
  'ъ': 'a',
  'ы': 'm',
  'ь': 'a',
  'э': 'e',
  'ю': 'm',
  'я': 'r',
};

/**
 * This function is a convenience function for looking up information in the
 * METRICS_MAP table. It takes a character as a string, and a font name.
 *
 * Note: the `width` property may be undefined if fontMetricsData.js wasn't
 * built using `Make extended_metrics`.
 * @param fontName e.g. 'Main-Regular', 'Typewriter-Regular', etc...
 */
export function getCharacterMetrics(
  codepoint: number,
  fontName: string
): CharacterMetrics {
  // Console.assert(character.length === 1);
  console.assert(METRICS_MAP[fontName], 'Unknown font "' + fontName + '"');

  const metrics = METRICS_MAP[fontName][codepoint];

  if (metrics) {
    return {
      defaultMetrics: false,
      depth: metrics[0],
      height: metrics[1],
      italic: metrics[2],
      skew: metrics[3],
    };
  }

  if (codepoint === 11034) {
    // Placeholder character
    return {
      defaultMetrics: true,
      depth: 0.2,
      height: 0.8,
      italic: 0,
      skew: 0,
    };
  }

  const char = String.fromCodePoint(codepoint);

  if (char in extraCharacterMap) {
    codepoint = extraCharacterMap[char].codePointAt(0);
  } else if (cjkRegex.test(codepoint[0])) {
    codepoint = 77; // 'M'.codepointAt(0);
    return {
      defaultMetrics: true,
      depth: 0.2,
      height: 0.9,
      italic: 0,
      skew: 0,
    };
  }
  // Console.warn(
  //     'No metrics for ' +
  //     '"' + character + '" (U+' + ('000000' + ch.toString(16)).substr(-6) + ')' +
  //     ' in font "' + fontName + '"');
  // Assume default values.
  // depth + height should be less than 1.0 em

  return {
    defaultMetrics: true,
    depth: 0.2,
    height: 0.7,
    italic: 0,
    skew: 0,
  };
}

/**
 *
 * @param value If value is a string, it may be suffixed
 * with a unit, which will override the `unit` paramter
 */
export function convertDimenToEm(
  value: number | string,
  unit: string,
  precision = Number.NaN
): number {
  if (typeof value === 'string') {
    const m = value.match(/([-+]?[\d.]*)\s*([a-zA-Z]+)/);
    if (!m) {
      value = Number.parseFloat(value);
    } else {
      value = Number.parseFloat(m[1]);
      unit = m[2].toLowerCase();
    }
  }

  // If the units are missing, TeX assumes 'pt'
  const f =
    {
      pt: 1,
      mm: 7227 / 2540,
      cm: 7227 / 254,
      ex: 35271 / 8192,
      px: 3 / 4,
      em: METRICS.ptPerEm,
      bp: 803 / 800,
      dd: 1238 / 1157,
      pc: 12,
      in: 72.27,
      mu: 10 / 18,
    }[unit] || 1;

  if (Number.isFinite(precision)) {
    const factor = 10 ** precision;
    return Math.round((value / METRICS.ptPerEm) * f * factor) / factor;
  }

  return (value / METRICS.ptPerEm) * f;
}

export function convertDimenToPx(value: string | number, unit: string): number {
  return convertDimenToEm(value, unit) * (4 / 3) * METRICS.ptPerEm;
}

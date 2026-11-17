// The Ə75 layout: 81 keys in a 75 % arrangement, Azerbaijani (Latin) legends, and the same keys written in the
// alphabets Azerbaijani used before. One unit (u) = one key pitch = 19.05 mm. x grows to the right, z towards
// the typist; the key area spans x -8..8 and z -3.125..3.125.
//
// Old alphabets: en.wikipedia.org/wiki/Azerbaijani_alphabet, table "Azerbaijani alphabets, 1922–present"
// (1922–1933 column for 1929, 1939–1958 column for 1939) and the Arabic-script letter table. Each key keeps its
// sound; only the letter changes.

export const ERA = { NOW: 0, AR: 1, Y29: 2, CYR: 3, Y91: 4 };

const AR = { A: 'ا', B: 'ب', C: 'ج', Ç: 'چ', D: 'د', E: 'ئ', Ə: 'ه', F: 'ف', G: 'گ', Ğ: 'غ', H: 'ح', X: 'خ', I: 'ؽ', İ: 'ی', J: 'ژ', K: 'ک', Q: 'ق', L: 'ل', M: 'م', N: 'ن', O: 'و', Ö: 'ؤ', P: 'پ', R: 'ر', S: 'س', Ş: 'ش', T: 'ت', U: 'ۇ', Ü: 'ۆ', V: 'و', Y: 'ی', Z: 'ز' };
// 1922–1933 Latin. 'Į' stands for the I with descender, which has no code point; atlas.js draws it.
const Y29 = { A: 'A', B: 'B', C: 'C', Ç: 'Ç', D: 'D', E: 'E', Ə: 'Ə', F: 'F', G: 'Ƣ', Ğ: 'G', H: 'H', X: 'X', I: 'Į', İ: 'I', J: 'Ƶ', K: 'Q', Q: 'K', L: 'L', M: 'M', N: 'N', O: 'O', Ö: 'Ɵ', P: 'P', R: 'R', S: 'S', Ş: 'Ɜ', T: 'T', U: 'Y', Ü: 'U', V: 'V', Y: 'J', Z: 'Z' };
// 1939–1958 Cyrillic
const CYR = { A: 'А', B: 'Б', C: 'Ҹ', Ç: 'Ч', D: 'Д', E: 'Э', Ə: 'Ә', F: 'Ф', G: 'Ҝ', Ğ: 'Ғ', H: 'Һ', X: 'Х', I: 'Ы', İ: 'И', J: 'Ж', K: 'К', Q: 'Г', L: 'Л', M: 'М', N: 'Н', O: 'О', Ö: 'Ө', P: 'П', R: 'Р', S: 'С', Ş: 'Ш', T: 'Т', U: 'У', Ü: 'Ү', V: 'В', Y: 'Й', Z: 'З' };
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

// rows: [z centre, row index for the sculpted profile]
const ROWZ = [-2.625, -1.375, -0.375, 0.625, 1.625, 2.625];

// [code, legend, width, gapBefore, kind]   kind: a = alpha cap, m = modifier cap, x = the Ə accent
const ROWS = [
  [['Escape', 'esc', 1, 0, 'm'], ['F1', 'F1', 1, 0.25, 'a'], ['F2', 'F2', 1, 0, 'a'], ['F3', 'F3', 1, 0, 'a'], ['F4', 'F4', 1, 0, 'a'],
    ['F5', 'F5', 1, 0.25, 'm'], ['F6', 'F6', 1, 0, 'm'], ['F7', 'F7', 1, 0, 'm'], ['F8', 'F8', 1, 0, 'm'],
    ['F9', 'F9', 1, 0.25, 'a'], ['F10', 'F10', 1, 0, 'a'], ['F11', 'F11', 1, 0, 'a'], ['F12', 'F12', 1, 0, 'a'], ['Delete', 'del', 1, 0.25, 'm']],
  [['Backquote', '`', 1, 0, 'a'], ['Digit1', '1', 1, 0, 'a'], ['Digit2', '2', 1, 0, 'a'], ['Digit3', '3', 1, 0, 'a'], ['Digit4', '4', 1, 0, 'a'],
    ['Digit5', '5', 1, 0, 'a'], ['Digit6', '6', 1, 0, 'a'], ['Digit7', '7', 1, 0, 'a'], ['Digit8', '8', 1, 0, 'a'], ['Digit9', '9', 1, 0, 'a'],
    ['Digit0', '0', 1, 0, 'a'], ['Minus', '-', 1, 0, 'a'], ['Equal', '=', 1, 0, 'a'], ['Backspace', '⌫', 2, 0, 'm'], ['Home', 'home', 1, 0, 'm']],
  [['Tab', '⇥', 1.5, 0, 'm'], ['KeyQ', 'Q', 1, 0, 'a'], ['KeyW', 'Ü', 1, 0, 'a'], ['KeyE', 'E', 1, 0, 'a'], ['KeyR', 'R', 1, 0, 'a'],
    ['KeyT', 'T', 1, 0, 'a'], ['KeyY', 'Y', 1, 0, 'a'], ['KeyU', 'U', 1, 0, 'a'], ['KeyI', 'İ', 1, 0, 'a'], ['KeyO', 'O', 1, 0, 'a'],
    ['KeyP', 'P', 1, 0, 'a'], ['BracketLeft', 'Ö', 1, 0, 'a'], ['BracketRight', 'Ğ', 1, 0, 'a'], ['Backslash', '\\', 1.5, 0, 'a'], ['PageUp', 'pg up', 1, 0, 'm']],
  [['CapsLock', '⇪', 1.75, 0, 'm'], ['KeyA', 'A', 1, 0, 'a'], ['KeyS', 'S', 1, 0, 'a'], ['KeyD', 'D', 1, 0, 'a'], ['KeyF', 'F', 1, 0, 'a'],
    ['KeyG', 'G', 1, 0, 'a'], ['KeyH', 'H', 1, 0, 'a'], ['KeyJ', 'J', 1, 0, 'a'], ['KeyK', 'K', 1, 0, 'a'], ['KeyL', 'L', 1, 0, 'a'],
    ['Semicolon', 'I', 1, 0, 'a'], ['Quote', 'Ə', 1, 0, 'x'], ['Enter', '⏎', 2.25, 0, 'm'], ['PageDown', 'pg dn', 1, 0, 'm']],
  [['ShiftLeft', '⇧', 2.25, 0, 'm'], ['KeyZ', 'Z', 1, 0, 'a'], ['KeyX', 'X', 1, 0, 'a'], ['KeyC', 'C', 1, 0, 'a'], ['KeyV', 'V', 1, 0, 'a'],
    ['KeyB', 'B', 1, 0, 'a'], ['KeyN', 'N', 1, 0, 'a'], ['KeyM', 'M', 1, 0, 'a'], ['Comma', 'Ç', 1, 0, 'a'], ['Period', 'Ş', 1, 0, 'a'],
    ['Slash', '.', 1, 0, 'a'], ['ShiftRight', '⇧', 1.75, 0, 'm'], ['ArrowUp', '↑', 1, 0, 'm'], ['End', 'end', 1, 0, 'm']],
  [['ControlLeft', 'ctrl', 1.25, 0, 'm'], ['MetaLeft', '◆', 1.25, 0, 'm'], ['AltLeft', 'alt', 1.25, 0, 'm'], ['Space', 'HƏRF', 6.25, 0, 'm'],
    ['AltRight', 'alt', 1, 0, 'm'], ['Fn', 'fn', 1, 0, 'm'], ['ControlRight', 'ctrl', 1, 0, 'm'], ['ArrowLeft', '←', 1, 0, 'm'],
    ['ArrowDown', '↓', 1, 0, 'm'], ['ArrowRight', '→', 1, 0, 'm']],
];

// what each key types (unshifted, shifted) in the Azerbaijani Latin layout (Microsoft KBDAZEL)
const TYPE = {
  Backquote: ['`', '~'], Digit1: ['1', '!'], Digit2: ['2', '"'], Digit3: ['3', '№'], Digit4: ['4', ';'], Digit5: ['5', '%'], Digit6: ['6', ':'],
  Digit7: ['7', '?'], Digit8: ['8', '*'], Digit9: ['9', '('], Digit0: ['0', ')'], Minus: ['-', '_'], Equal: ['=', '+'],
  KeyQ: ['q', 'Q'], KeyW: ['ü', 'Ü'], KeyE: ['e', 'E'], KeyR: ['r', 'R'], KeyT: ['t', 'T'], KeyY: ['y', 'Y'], KeyU: ['u', 'U'], KeyI: ['i', 'İ'],
  KeyO: ['o', 'O'], KeyP: ['p', 'P'], BracketLeft: ['ö', 'Ö'], BracketRight: ['ğ', 'Ğ'], Backslash: ['\\', '/'],
  KeyA: ['a', 'A'], KeyS: ['s', 'S'], KeyD: ['d', 'D'], KeyF: ['f', 'F'], KeyG: ['g', 'G'], KeyH: ['h', 'H'], KeyJ: ['j', 'J'], KeyK: ['k', 'K'],
  KeyL: ['l', 'L'], Semicolon: ['ı', 'I'], Quote: ['ə', 'Ə'], KeyZ: ['z', 'Z'], KeyX: ['x', 'X'], KeyC: ['c', 'C'], KeyV: ['v', 'V'],
  KeyB: ['b', 'B'], KeyN: ['n', 'N'], KeyM: ['m', 'M'], Comma: ['ç', 'Ç'], Period: ['ş', 'Ş'], Slash: ['.', ','], Space: [' ', ' '],
};

// sculpted (Cherry-like) profile per row: cap height and the slope of its top (dy/dz, + = front edge higher)
export const ROW_H = [0.5, 0.47, 0.44, 0.42, 0.44, 0.44];
export const ROW_SLOPE = [-0.2, -0.13, -0.06, 0, 0.07, 0.12];
export const WIDTHS = [1, 1.25, 1.5, 1.75, 2, 2.25, 6.25];

export const KEYS = [];
ROWS.forEach((row, r) => {
  let x = -8;
  for (const [code, legend, w, gap, kind] of row) {
    x += gap;
    const k = { i: KEYS.length, code, legend, w, x: x + w / 2, z: ROWZ[r], row: r, kind, wi: WIDTHS.indexOf(w), type: TYPE[code] || null };
    const L = legend.length === 1 && AR[legend] ? legend : null;
    const d = /^[0-9]$/.test(legend) ? legend : null;
    k.era = [legend, legend, legend, legend, legend];
    if (L) { k.era[ERA.AR] = AR[L]; k.era[ERA.Y29] = Y29[L]; k.era[ERA.CYR] = CYR[L]; k.era[ERA.Y91] = L === 'Ə' ? 'Ä' : L; }
    if (d) k.era[ERA.AR] = FA_DIGITS[+d];
    k.letter = !!L || !!d;
    KEYS.push(k);
    x += w;
  }
});
export const BY_CODE = Object.fromEntries(KEYS.map((k) => [k.code, k]));
export const SCHWA = BY_CODE.Quote;
// the rotary knob sits where the 16th key of the function row would be
export const KNOB = { x: 7.5, z: ROWZ[0] };

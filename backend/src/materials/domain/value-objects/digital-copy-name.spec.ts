import { extractDigitalFolderName } from './digital-copy-name';

describe('extractDigitalFolderName (HU-140)', () => {
  it.each([null, undefined, '', '   ', '/', '\\'])(
    'returns null for empty or root-only value %p',
    (value) => {
      expect(extractDigitalFolderName(value)).toBeNull();
    },
  );

  it.each(['C:\\', 'Z:', 'D:/'])(
    'returns null for bare drive letter %s',
    (value) => {
      expect(extractDigitalFolderName(value)).toBeNull();
    },
  );

  it.each([
    '\\\\servidor',
    '\\\\servidor\\Multimedia',
    '//servidor/Multimedia',
  ])('returns null for bare UNC host or share %s', (value) => {
    expect(extractDigitalFolderName(value)).toBeNull();
  });

  it('extracts only the leaf folder name from a Windows full path', () => {
    const path =
      'C:\\trackhive\\docs_simulados\\Aha\\Fondo - Notarías\\Notarías\\1ra - Notaria Primera de Barranquilla - 1815 a 1979\\1931 - Esc 1-1290 (12) +\\1ra-1931 - Esc 0001-0109 - Ene';

    expect(extractDigitalFolderName(path)).toBe(
      '1ra-1931 - Esc 0001-0109 - Ene',
    );
  });

  it('ignores trailing backslashes and forward slashes', () => {
    expect(
      extractDigitalFolderName('Z:\\Aha\\Fondo - Periódicos\\1925-03 Marzo\\'),
    ).toBe('1925-03 Marzo');
    expect(
      extractDigitalFolderName('/mnt/archive/notarias/1ra-1931 - Ene/'),
    ).toBe('1ra-1931 - Ene');
  });

  it('extracts the leaf folder from a UNC path with a subfolder', () => {
    expect(
      extractDigitalFolderName('\\\\servidor\\Multimedia\\Aha\\1902'),
    ).toBe('1902');
  });

  it('returns the value itself when it is already a plain folder name', () => {
    expect(extractDigitalFolderName('1ra-1931 - Esc 0001-0109 - Ene')).toBe(
      '1ra-1931 - Esc 0001-0109 - Ene',
    );
  });
});

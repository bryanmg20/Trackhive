import { InvalidMaterialReviewReasonError } from '../errors/invalid-material-review-reason.error';
import {
  hasValidDigitalCopy,
  parseMaterialReviewReason,
  resolveMaterialDigitalCopy,
} from './material-digital-copy';

describe('material-digital-copy (HU-139, HU-140)', () => {
  describe('hasValidDigitalCopy', () => {
    it.each([
      'C:\\trackhive\\docs_simulados\\Aha\\1931\\1ra-1931 - Esc 0001-0109 - Ene',
      '\\\\servidor\\Multimedia\\Aha\\1902',
      '/mnt/archive/notarias/1ra-1931 - Ene/',
    ])('returns true for path with leaf folder %s', (path) => {
      expect(hasValidDigitalCopy(path)).toBe(true);
    });

    it.each([
      null,
      undefined,
      '',
      '   ',
      'C:\\',
      'Z:',
      '\\\\servidor',
      '\\\\servidor\\Multimedia',
    ])('returns false for empty or root-only path %p', (path) => {
      expect(hasValidDigitalCopy(path)).toBe(false);
    });
  });

  describe('parseMaterialReviewReason', () => {
    it.each([null, undefined])('returns null for %p', (value) => {
      expect(parseMaterialReviewReason(value)).toBeNull();
    });

    it.each(['NO_PATTERN', 'DUPLICATE_CODE'] as const)(
      'accepts valid reason %s',
      (reason) => {
        expect(parseMaterialReviewReason(reason)).toBe(reason);
      },
    );

    it('throws InvalidMaterialReviewReasonError for unknown reasons', () => {
      expect(() => parseMaterialReviewReason('DESCONOCIDO')).toThrow(
        InvalidMaterialReviewReasonError,
      );
    });
  });

  describe('resolveMaterialDigitalCopy', () => {
    it('extracts folder name and marks hasDigitalCopy when path has a leaf folder', () => {
      expect(
        resolveMaterialDigitalCopy({
          digitalPath:
            'C:\\trackhive\\docs_simulados\\Aha\\1931\\1ra-1931 - Esc 0001-0109 - Ene',
          reviewReason: null,
        }),
      ).toEqual({
        hasDigitalCopy: true,
        digitalFolderName: '1ra-1931 - Esc 0001-0109 - Ene',
        needsReview: false,
        reviewReason: null,
      });
    });

    it.each([null, 'C:\\', '\\\\servidor\\Multimedia'])(
      'reports no digital copy for %p',
      (digitalPath) => {
        expect(
          resolveMaterialDigitalCopy({ digitalPath, reviewReason: null }),
        ).toEqual({
          hasDigitalCopy: false,
          digitalFolderName: null,
          needsReview: false,
          reviewReason: null,
        });
      },
    );

    it.each(['NO_PATTERN', 'DUPLICATE_CODE'] as const)(
      'marks needsReview when reviewReason is %s',
      (reviewReason) => {
        expect(
          resolveMaterialDigitalCopy({
            digitalPath: '\\\\servidor\\Multimedia\\Aha\\1902',
            reviewReason,
          }),
        ).toEqual({
          hasDigitalCopy: true,
          digitalFolderName: '1902',
          needsReview: true,
          reviewReason,
        });
      },
    );

    it('throws InvalidMaterialReviewReasonError when reviewReason is invalid', () => {
      expect(() =>
        resolveMaterialDigitalCopy({
          digitalPath: '\\\\servidor\\Multimedia\\Aha\\1902',
          reviewReason: 'OTRO',
        }),
      ).toThrow(InvalidMaterialReviewReasonError);
    });
  });
});

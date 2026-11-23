import { summarizeDigitalCopies } from './digital-copy';

describe('summarizeDigitalCopies (HU-139)', () => {
  it('says every material has a digital copy when all of them do', () => {
    expect(
      summarizeDigitalCopies([
        { hasDigitalCopy: true, status: 'DISPONIBLE' },
        { hasDigitalCopy: true, status: 'EN_USO' },
      ]),
    ).toEqual({
      allMaterialsHaveDigitalCopy: true,
      anyMaterialNotConsultable: false,
    });
  });

  it('says not every material has a copy when one lacks it', () => {
    expect(
      summarizeDigitalCopies([
        { hasDigitalCopy: true, status: 'DISPONIBLE' },
        { hasDigitalCopy: false, status: 'DISPONIBLE' },
      ]).allMaterialsHaveDigitalCopy,
    ).toBe(false);
  });

  it('does not count a request without catalog materials as having every copy', () => {
    expect(summarizeDigitalCopies([])).toEqual({
      allMaterialsHaveDigitalCopy: false,
      anyMaterialNotConsultable: false,
    });
  });

  it('flags a material that is not consultable, even with its copy', () => {
    expect(
      summarizeDigitalCopies([
        { hasDigitalCopy: true, status: 'DISPONIBLE' },
        { hasDigitalCopy: true, status: 'NO_CONSULTABLE' },
      ]),
    ).toEqual({
      allMaterialsHaveDigitalCopy: true,
      anyMaterialNotConsultable: true,
    });
  });

  it('does not flag a material being restored: the restoration affects the original, not the copy', () => {
    expect(
      summarizeDigitalCopies([
        { hasDigitalCopy: true, status: 'EN_RESTAURACION' },
      ]),
    ).toEqual({
      allMaterialsHaveDigitalCopy: true,
      anyMaterialNotConsultable: false,
    });
  });
});

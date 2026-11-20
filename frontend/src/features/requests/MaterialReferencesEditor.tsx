import { useState } from 'react';
import {
  describeReference,
  REFERENCE_DEED_NUMBER_MAX_LENGTH,
  REFERENCE_DESCRIPTION_MAX_LENGTH,
  REFERENCE_DESCRIPTION_MIN_LENGTH,
  REFERENCE_MIN_YEAR,
  REFERENCE_NOTARY_MAX_LENGTH,
} from './api/material-references';
import type {
  MaterialReferenceKind,
  MaterialReferencePayload,
} from './api/material-references';
import styles from './MaterialReferencesEditor.module.css';

interface MaterialReferencesEditorProps {
  // Prefix of the element ids, so two editors never collide
  idPrefix: string;
  references: MaterialReferencePayload[];
  onChange: (references: MaterialReferencePayload[]) => void;
  disabled?: boolean;
}

type DraftErrors = Partial<
  Record<'notary' | 'year' | 'deedNumber' | 'description', string>
>;

/**
 * «Solicitar material que no está en el catálogo» (HU-09.2): when the
 * material does not appear in the search, the requester describes it. A
 * notarial protocol by notary, year and deed number; any other material by
 * free text. The staff associates the catalog material later.
 */
export function MaterialReferencesEditor({
  idPrefix,
  references,
  onChange,
  disabled = false,
}: MaterialReferencesEditorProps) {
  const [kind, setKind] = useState<MaterialReferenceKind>('PROTOCOLO_NOTARIAL');
  const [notary, setNotary] = useState('');
  const [year, setYear] = useState('');
  const [deedNumber, setDeedNumber] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<DraftErrors>({});
  const currentYear = new Date().getFullYear();
  const id = (name: string) => `${idPrefix}-${name}`;

  function buildDraft(): MaterialReferencePayload | DraftErrors {
    if (kind === 'TEXTO_LIBRE') {
      const text = description.trim();
      return text.length >= REFERENCE_DESCRIPTION_MIN_LENGTH
        ? { kind, description: text }
        : {
            description: `Describa el material con al menos ${REFERENCE_DESCRIPTION_MIN_LENGTH} caracteres.`,
          };
    }
    const draftErrors: DraftErrors = {};
    const parsedYear = Number(year);
    if (!notary.trim()) {
      draftErrors.notary = 'Indique la notaría.';
    }
    if (
      !/^\d{4}$/.test(year.trim()) ||
      parsedYear < REFERENCE_MIN_YEAR ||
      parsedYear > currentYear
    ) {
      draftErrors.year = `Indique un año entre ${REFERENCE_MIN_YEAR} y ${currentYear}.`;
    }
    if (!deedNumber.trim()) {
      draftErrors.deedNumber = 'Indique el número de escritura.';
    }
    return Object.keys(draftErrors).length > 0
      ? draftErrors
      : {
          kind,
          notary: notary.trim(),
          year: parsedYear,
          deedNumber: deedNumber.trim(),
        };
  }

  function add() {
    const draft = buildDraft();
    if (!('kind' in draft)) {
      setErrors(draft);
      return;
    }
    onChange([...references, draft]);
    setErrors({});
    setNotary('');
    setYear('');
    setDeedNumber('');
    setDescription('');
  }

  function remove(index: number) {
    onChange(references.filter((_, position) => position !== index));
  }

  const describedBy = (name: keyof DraftErrors) =>
    errors[name] ? id(`${name}-error`) : undefined;

  const fieldError = (name: keyof DraftErrors) =>
    errors[name] ? (
      <p className={styles.fieldError} id={id(`${name}-error`)} role="alert">
        {errors[name]}
      </p>
    ) : null;

  return (
    <section
      className={styles.editor}
      aria-labelledby={id('title')}
      data-testid="material-references"
    >
      <h3 id={id('title')} className={styles.title}>
        ¿No encuentra el material? Descríbalo
      </h3>
      <p className={styles.hint}>
        Si el documento no aparece en el buscador, escriba una referencia. El
        CLENA lo digitaliza y lo asocia a su solicitud.
      </p>

      {references.length > 0 ? (
        <ul className={styles.list} aria-label="Referencias agregadas">
          {references.map((reference, index) => (
            <li className={styles.item} key={`${index}-${describeReference(reference)}`}>
              <span>{describeReference(reference)}</span>
              <button
                type="button"
                className={styles.remove}
                onClick={() => remove(index)}
                disabled={disabled}
                aria-label={`Quitar referencia ${describeReference(reference)}`}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <fieldset className={styles.kind} disabled={disabled}>
        <legend>Tipo de material</legend>
        <label>
          <input
            type="radio"
            name={id('kind')}
            value="PROTOCOLO_NOTARIAL"
            checked={kind === 'PROTOCOLO_NOTARIAL'}
            onChange={() => {
              setKind('PROTOCOLO_NOTARIAL');
              setErrors({});
            }}
          />
          Protocolo notarial
        </label>
        <label>
          <input
            type="radio"
            name={id('kind')}
            value="TEXTO_LIBRE"
            checked={kind === 'TEXTO_LIBRE'}
            onChange={() => {
              setKind('TEXTO_LIBRE');
              setErrors({});
            }}
          />
          Otro material
        </label>
      </fieldset>

      {kind === 'PROTOCOLO_NOTARIAL' ? (
        <div className={styles.grid}>
          <div className={styles.field}>
            <label htmlFor={id('notary')}>Notaría</label>
            <input
              id={id('notary')}
              value={notary}
              maxLength={REFERENCE_NOTARY_MAX_LENGTH}
              placeholder="Ej.: Notaría Primera de Barranquilla"
              disabled={disabled}
              aria-invalid={errors.notary ? true : undefined}
              aria-describedby={describedBy('notary')}
              onChange={(event) => setNotary(event.target.value)}
            />
            {fieldError('notary')}
          </div>
          <div className={styles.field}>
            <label htmlFor={id('year')}>Año</label>
            <input
              id={id('year')}
              inputMode="numeric"
              value={year}
              maxLength={4}
              placeholder="Ej.: 1950"
              disabled={disabled}
              aria-invalid={errors.year ? true : undefined}
              aria-describedby={describedBy('year')}
              onChange={(event) => setYear(event.target.value)}
            />
            {fieldError('year')}
          </div>
          <div className={styles.field}>
            <label htmlFor={id('deed')}>Número de escritura</label>
            <input
              id={id('deed')}
              value={deedNumber}
              maxLength={REFERENCE_DEED_NUMBER_MAX_LENGTH}
              placeholder="Ej.: 245"
              disabled={disabled}
              aria-invalid={errors.deedNumber ? true : undefined}
              aria-describedby={describedBy('deedNumber')}
              onChange={(event) => setDeedNumber(event.target.value)}
            />
            {fieldError('deedNumber')}
          </div>
        </div>
      ) : (
        <div className={styles.field}>
          <label htmlFor={id('description')}>Descripción del material</label>
          <textarea
            id={id('description')}
            value={description}
            maxLength={REFERENCE_DESCRIPTION_MAX_LENGTH}
            placeholder="Ej.: El Heraldo, 15-03-1950"
            rows={2}
            disabled={disabled}
            aria-invalid={errors.description ? true : undefined}
            aria-describedby={describedBy('description')}
            onChange={(event) => setDescription(event.target.value)}
          />
          {fieldError('description')}
        </div>
      )}

      <button
        type="button"
        className={styles.add}
        onClick={add}
        disabled={disabled}
      >
        Agregar referencia
      </button>
    </section>
  );
}

import { useId } from 'react';
import type { ComponentProps } from 'react';
import {
  AGE_RANGES,
  AGE_RANGE_LABELS,
  POPULATION_GROUPS,
} from './characterization';
import styles from './ProfilePage.module.css';

interface CharacterizationFieldsProps {
  municipalityInput: ComponentProps<'input'>;
  ageRangeInput: ComponentProps<'select'>;
  populationGroupInput: ComponentProps<'select'>;
  errors?: {
    municipality?: string;
    ageRange?: string;
    populationGroup?: string;
  };
}

export function CharacterizationFields({
  municipalityInput,
  ageRangeInput,
  populationGroupInput,
  errors = {},
}: CharacterizationFieldsProps) {
  const id = useId();
  return (
    <fieldset className={styles.fields}>
      <legend>Datos de caracterización</legend>
      <p>
        Se guardan con el solicitante; no tendrá que repetirlos en cada
        solicitud.
      </p>
      <div className={styles.field}>
        <label htmlFor={`${id}-municipality`}>Municipio o distrito</label>
        <input
          {...municipalityInput}
          id={`${id}-municipality`}
          maxLength={120}
          autoComplete="address-level2"
          required
          aria-invalid={Boolean(errors.municipality)}
          aria-describedby={
            errors.municipality ? `${id}-municipality-error` : undefined
          }
        />
        {errors.municipality && (
          <p id={`${id}-municipality-error`} role="alert">
            {errors.municipality}
          </p>
        )}
      </div>
      <div className={styles.field}>
        <label htmlFor={`${id}-age`}>Rango de edad</label>
        <select
          {...ageRangeInput}
          id={`${id}-age`}
          required
          aria-invalid={Boolean(errors.ageRange)}
          aria-describedby={errors.ageRange ? `${id}-age-error` : undefined}
        >
          <option value="">Seleccione un rango</option>
          {AGE_RANGES.map((range, index) => (
            <option value={range} key={range}>
              {AGE_RANGE_LABELS[index]}
            </option>
          ))}
        </select>
        {errors.ageRange && (
          <p id={`${id}-age-error`} role="alert">
            {errors.ageRange}
          </p>
        )}
      </div>
      <div className={styles.field}>
        <label htmlFor={`${id}-group`}>Grupo poblacional (opcional)</label>
        <select
          {...populationGroupInput}
          id={`${id}-group`}
          aria-invalid={Boolean(errors.populationGroup)}
          aria-describedby={
            errors.populationGroup ? `${id}-group-error` : undefined
          }
        >
          <option value="">SIN SELECCIONAR</option>
          {POPULATION_GROUPS.map((group) => (
            <option value={group.value} key={group.value}>
              {group.label}
            </option>
          ))}
        </select>
        {errors.populationGroup && (
          <p id={`${id}-group-error`} role="alert">
            {errors.populationGroup}
          </p>
        )}
      </div>
    </fieldset>
  );
}

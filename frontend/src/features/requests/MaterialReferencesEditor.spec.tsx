import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { MaterialReferencePayload } from './api/material-references';
import { MaterialReferencesEditor } from './MaterialReferencesEditor';

function Harness({
  onChange,
}: {
  onChange: (references: MaterialReferencePayload[]) => void;
}) {
  const [references, setReferences] = useState<MaterialReferencePayload[]>([]);
  return (
    <MaterialReferencesEditor
      idPrefix="test"
      references={references}
      onChange={(next) => {
        setReferences(next);
        onChange(next);
      }}
    />
  );
}

describe('MaterialReferencesEditor (HU-09.2)', () => {
  it('adds a notarial protocol by notary, year and deed number', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.type(screen.getByLabelText('Notaría'), 'Notaría Primera');
    await user.type(screen.getByLabelText('Año'), '1950');
    await user.type(screen.getByLabelText('Número de escritura'), '245');
    await user.click(screen.getByRole('button', { name: 'Agregar referencia' }));

    expect(onChange).toHaveBeenLastCalledWith([
      {
        kind: 'PROTOCOLO_NOTARIAL',
        notary: 'Notaría Primera',
        year: 1950,
        deedNumber: '245',
      },
    ]);
    expect(
      screen.getByText('Protocolo notarial: Notaría Primera, año 1950, escritura 245'),
    ).toBeInTheDocument();
    // The fields are emptied for the next reference
    expect(screen.getByLabelText('Notaría')).toHaveValue('');
  });

  it('explains what is missing and adds nothing', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.type(screen.getByLabelText('Año'), '1300');
    await user.click(screen.getByRole('button', { name: 'Agregar referencia' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('Indique la notaría.')).toBeInTheDocument();
    expect(screen.getByText(/Indique un año entre 1500/)).toBeInTheDocument();
    expect(
      screen.getByText('Indique el número de escritura.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Notaría')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('adds free text for any other material and removes it', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(screen.getByLabelText('Otro material'));
    await user.type(
      screen.getByLabelText('Descripción del material'),
      'El Heraldo, 15-03-1950',
    );
    await user.click(screen.getByRole('button', { name: 'Agregar referencia' }));
    expect(onChange).toHaveBeenLastCalledWith([
      { kind: 'TEXTO_LIBRE', description: 'El Heraldo, 15-03-1950' },
    ]);

    await user.click(
      screen.getByRole('button', {
        name: 'Quitar referencia El Heraldo, 15-03-1950',
      }),
    );
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(
      screen.queryByRole('list', { name: 'Referencias agregadas' }),
    ).not.toBeInTheDocument();
  });
});

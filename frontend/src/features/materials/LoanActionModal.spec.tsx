import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LoanActionModal } from './LoanActionModal';

function Harness({
  submitting = false,
  onCancel,
}: {
  submitting?: boolean;
  onCancel?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Registrar entrega
      </button>
      {open ? (
        <LoanActionModal
          mode="deliver"
          materialTitle="Acta 1"
          materialCatalogCode="TH-DOC-0001"
          submitting={submitting}
          error={null}
          onConfirm={vi.fn()}
          onCancel={() => {
            onCancel?.();
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

describe('LoanActionModal', () => {
  it('opens as a modal dialog with the focus on its first field', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Registrar entrega' }));

    const dialog = screen.getByRole('dialog', {
      name: 'Registrar entrega de material',
    });
    expect(dialog.tagName).toBe('DIALOG');
    expect(dialog).toHaveAttribute('open');
    expect(screen.getByLabelText('Observaciones (opcional)')).toHaveFocus();
  });

  it('closes with Escape and returns the focus to the button that opened it', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<Harness onCancel={onCancel} />);
    const opener = screen.getByRole('button', { name: 'Registrar entrega' });

    await user.click(opener);
    await user.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('ignores Escape while the action is being saved', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<Harness submitting onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: 'Registrar entrega' }));
    await user.keyboard('{Escape}');

    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveAttribute('open');
  });
});

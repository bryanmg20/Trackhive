import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { createMemoryRouter, Link, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { UNSAVED_CHANGES_MESSAGE, UnsavedChangesGuard } from './UnsavedChangesGuard';

function Form() {
  const [value, setValue] = useState('');
  return (
    <main>
      <UnsavedChangesGuard when={value !== ''} />
      <label htmlFor="note">Nota</label>
      <input id="note" value={value} onChange={(e) => setValue(e.target.value)} />
      <Link to="/otra">Otra pantalla</Link>
    </main>
  );
}

function renderForm() {
  const router = createMemoryRouter(
    [
      { path: '/form', element: <Form /> },
      { path: '/otra', element: <h1>Otra</h1> },
    ],
    { initialEntries: ['/form'] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe('UnsavedChangesGuard', () => {
  it('lets the person leave freely while nothing was typed', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm');
    renderForm();

    await user.click(screen.getByRole('link', { name: 'Otra pantalla' }));

    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Otra' })).toBeInTheDocument();
  });

  it('asks before leaving with unsaved data and stays when the person declines', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const router = renderForm();

    await user.type(screen.getByLabelText('Nota'), 'Acta');
    await user.click(screen.getByRole('link', { name: 'Otra pantalla' }));

    expect(confirm).toHaveBeenCalledWith(UNSAVED_CHANGES_MESSAGE);
    expect(router.state.location.pathname).toBe('/form');
    expect(screen.getByLabelText('Nota')).toHaveValue('Acta');
  });

  it('leaves when the person accepts losing the changes', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderForm();

    await user.type(screen.getByLabelText('Nota'), 'Acta');
    await user.click(screen.getByRole('link', { name: 'Otra pantalla' }));

    expect(
      await screen.findByRole('heading', { name: 'Otra' }),
    ).toBeInTheDocument();
  });

  it('asks the browser to confirm closing or reloading the tab', async () => {
    const user = userEvent.setup();
    renderForm();

    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    await user.type(screen.getByLabelText('Nota'), 'Acta');
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { PageHeader } from '../layout/PageHeader';
import { RouteFocus } from './RouteFocus';

function Screen({ title, linkTo }: { title: string; linkTo?: string }) {
  return (
    <main>
      <PageHeader titleId="t" title={title} />
      {linkTo ? <Link to={linkTo}>Ir</Link> : null}
    </main>
  );
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <RouteFocus />
      <Routes>
        <Route path="/" element={<Navigate replace to="/uno" />} />
        <Route path="/uno" element={<Screen title="Uno" linkTo="/dos" />} />
        <Route path="/dos" element={<Screen title="Dos" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RouteFocus and the page title', () => {
  beforeEach(() => {
    document.title = '';
  });

  it('names the browser tab after the screen', () => {
    renderAt('/uno');

    expect(document.title).toBe('Uno · Trackhive');
  });

  it('moves the focus to the new screen heading and renames the tab', async () => {
    const user = userEvent.setup();
    renderAt('/uno');

    await user.click(screen.getByRole('link', { name: 'Ir' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Dos' })).toHaveFocus();
    expect(document.title).toBe('Dos · Trackhive');
  });

  it('leaves the focus alone on a redirect at first load', () => {
    renderAt('/');

    expect(screen.getByRole('heading', { level: 1, name: 'Uno' })).not.toHaveFocus();
    expect(document.body).toHaveFocus();
    expect(document.title).toBe('Uno · Trackhive');
  });
});

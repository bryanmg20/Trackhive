import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DigitalCopyCell } from './DigitalCopyCell';
import { ReviewBadge } from './ReviewBadge';

function renderCell(props: Parameters<typeof DigitalCopyCell>[0]) {
  return render(
    <table>
      <tbody>
        <tr>
          <DigitalCopyCell {...props} />
        </tr>
      </tbody>
    </table>,
  );
}

describe('ReviewBadge', () => {
  it('renders nothing when needsReview is false or omitted', () => {
    const { container } = render(<ReviewBadge needsReview={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the review reason label for NO_PATTERN and DUPLICATE_CODE', () => {
    const { rerender } = render(
      <ReviewBadge needsReview reviewReason="NO_PATTERN" />,
    );
    expect(
      screen.getByText('Para revisión: Sin código válido'),
    ).toBeInTheDocument();

    rerender(<ReviewBadge needsReview reviewReason="DUPLICATE_CODE" />);
    expect(
      screen.getByText('Para revisión: Código duplicado'),
    ).toBeInTheDocument();

    rerender(<ReviewBadge needsReview reviewReason={null} />);
    expect(screen.getByText('Para revisión')).toBeInTheDocument();
  });
});

describe('DigitalCopyCell', () => {
  it('shows public digital availability without folder name or review badge', () => {
    const { rerender } = renderCell({
      hasDigitalCopy: true,
      digitalFolderName: '1ra-1931 - Esc 0001-0109 - Ene',
      needsReview: true,
      reviewReason: 'NO_PATTERN',
    });

    const cell = screen.getByRole('cell');
    expect(
      within(cell).getByText('Sí · Disponible en digital'),
    ).toBeInTheDocument();
    expect(
      within(cell).queryByText('1ra-1931 - Esc 0001-0109 - Ene'),
    ).not.toBeInTheDocument();
    expect(within(cell).queryByText(/revisión/i)).not.toBeInTheDocument();
    expect(within(cell).queryByRole('link')).not.toBeInTheDocument();
    expect(within(cell).queryByRole('button')).not.toBeInTheDocument();

    rerender(
      <table>
        <tbody>
          <tr>
            <DigitalCopyCell hasDigitalCopy={false} />
          </tr>
        </tbody>
      </table>,
    );
    expect(within(screen.getByRole('cell')).getByText('No')).toBeInTheDocument();
  });

  it('shows folder name and review badge for staff mode when available', () => {
    const { rerender } = renderCell({
      hasDigitalCopy: true,
      showDetails: true,
      digitalFolderName: '1925-03 Marzo',
      needsReview: true,
      reviewReason: 'NO_PATTERN',
    });

    const cell = screen.getByRole('cell');
    expect(within(cell).getByText('Sí')).toBeInTheDocument();
    expect(within(cell).getByText('1925-03 Marzo')).toBeInTheDocument();
    expect(
      within(cell).getByText('Para revisión: Sin código válido'),
    ).toBeInTheDocument();

    rerender(
      <table>
        <tbody>
          <tr>
            <DigitalCopyCell
              hasDigitalCopy={false}
              showDetails
              digitalFolderName="1925-03 Marzo"
              needsReview={false}
            />
          </tr>
        </tbody>
      </table>,
    );
    expect(within(screen.getByRole('cell')).getByText('No')).toBeInTheDocument();
    expect(
      within(screen.getByRole('cell')).queryByText('1925-03 Marzo'),
    ).not.toBeInTheDocument();
  });
});

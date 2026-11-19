import { MaterialNotInUseError } from '../errors/material-not-in-use.error';
import { MaterialLoan } from './material-loan.entity';

describe('MaterialLoan', () => {
  const handedOverAt = new Date('2026-11-19T14:00:00.000Z');
  const returnedAt = new Date('2026-11-19T16:30:00.000Z');

  it('creates an open loan when delivered', () => {
    const loan = MaterialLoan.deliver({
      id: 'loan-1',
      materialId: 'material-1',
      appointmentId: 'appointment-1',
      handedOverById: 'staff-1',
      deliveryNotes: 'Entregado con guantes',
      now: handedOverAt,
    });

    expect(loan.isOpen).toBe(true);
    expect(loan.handedOverAt).toEqual(handedOverAt);
    expect(loan.handedOverById).toBe('staff-1');
    expect(loan.deliveryNotes).toBe('Entregado con guantes');
    expect(loan.returnedAt).toBeNull();
    expect(loan.returnedById).toBeNull();
    expect(loan.returnNotes).toBeNull();
  });

  it('registers the return and keeps the original loan immutable', () => {
    const open = MaterialLoan.deliver({
      id: 'loan-1',
      materialId: 'material-1',
      appointmentId: 'appointment-1',
      handedOverById: 'staff-1',
      deliveryNotes: null,
      now: handedOverAt,
    });

    const closed = open.registerReturn('staff-2', 'En buen estado', returnedAt);

    expect(open.isOpen).toBe(true);
    expect(closed.isOpen).toBe(false);
    expect(closed.returnedAt).toEqual(returnedAt);
    expect(closed.returnedById).toBe('staff-2');
    expect(closed.returnNotes).toBe('En buen estado');
  });

  it('clamps returnedAt to handedOverAt if clock skew produces an earlier instant', () => {
    const open = MaterialLoan.deliver({
      id: 'loan-1',
      materialId: 'material-1',
      appointmentId: 'appointment-1',
      handedOverById: 'staff-1',
      deliveryNotes: null,
      now: handedOverAt,
    });

    const earlier = new Date(handedOverAt.getTime() - 1000);
    const closed = open.registerReturn('staff-2', null, earlier);

    expect(closed.returnedAt).toEqual(handedOverAt);
  });

  it('throws MaterialNotInUseError when trying to return an already closed loan', () => {
    const closed = MaterialLoan.deliver({
      id: 'loan-1',
      materialId: 'material-1',
      appointmentId: 'appointment-1',
      handedOverById: 'staff-1',
      deliveryNotes: null,
      now: handedOverAt,
    }).registerReturn('staff-2', null, returnedAt);

    expect(() => closed.registerReturn('staff-3', null, returnedAt)).toThrow(
      MaterialNotInUseError,
    );
  });
});

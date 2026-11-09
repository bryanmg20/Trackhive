import { useState } from 'react';
import type { FormEvent } from 'react';
import { createRequest } from './api/create-request';

export function NewRequestPage() {
  const [materialIds, setMaterialIds] = useState('');
  const [reason, setReason] = useState('');
  const [desiredDate, setDesiredDate] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<'PRESENCIAL' | 'DIGITAL'>('PRESENCIAL');
  const [message, setMessage] = useState('');
  const [trackingCode, setTrackingCode] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setTrackingCode('');
    try {
      const result = await createRequest({
        materialIds: materialIds.split(',').map((id) => id.trim()).filter(Boolean),
        reason,
        desiredDate,
        deliveryMode,
      });
      setTrackingCode(result.trackingCode);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible radicar la solicitud.');
    }
  }

  return (
    <main>
      <h1>Radicar solicitud de consulta</h1>
      <form onSubmit={submit}>
        <label htmlFor="materials">IDs de materiales</label>
        <input id="materials" required value={materialIds} onChange={(event) => setMaterialIds(event.target.value)} />

        <label htmlFor="reason">Motivo</label>
        <textarea id="reason" required minLength={10} value={reason} onChange={(event) => setReason(event.target.value)} />

        <label htmlFor="desired-date">Fecha deseada</label>
        <input id="desired-date" type="date" required value={desiredDate} onChange={(event) => setDesiredDate(event.target.value)} />

        <fieldset>
          <legend>Modalidad de entrega</legend>
          <label><input type="radio" name="delivery" value="PRESENCIAL" checked={deliveryMode === 'PRESENCIAL'} onChange={() => setDeliveryMode('PRESENCIAL')} />Presencial</label>
          <label><input type="radio" name="delivery" value="DIGITAL" checked={deliveryMode === 'DIGITAL'} onChange={() => setDeliveryMode('DIGITAL')} />Digital</label>
        </fieldset>

        <button type="submit">Enviar solicitud</button>
      </form>
      {message ? <p role="alert">{message}</p> : null}
      {trackingCode ? <p role="status">Solicitud radicada. Código: {trackingCode}</p> : null}
    </main>
  );
}

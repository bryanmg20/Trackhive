import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ROUTES } from '../../routes';
import {
  MATERIAL_STATUS_LABELS,
  MATERIAL_TYPE_LABELS,
} from '../materials/api/search-materials';
import searchStyles from '../materials/MaterialSearchPage.module.css';
import { SiteNav } from '../navigation/SiteNav';
import type { ChangeRequestStatusResult } from './api/change-request-status';
import { getRequest } from './api/get-request';
import type { RequestDetail } from './api/get-request';
import { REQUEST_STATUS_LABELS, RequestsApiError } from './api/list-requests';
import { ChangeRequestStatusForm } from './ChangeRequestStatusForm';
import styles from './RequestDetailPage.module.css';

const NETWORK_ERROR_MESSAGE =
  'No pudimos conectar con el servidor. Revise su conexión e inténtelo de nuevo.';

const DELIVERY_LABELS = { PRESENCIAL: 'Presencial', DIGITAL: 'Digital' };
const ORIGIN_LABELS: Record<string, string> = {
  WEB: 'Página web',
  PRESENCIAL: 'Presencial',
  CORREO: 'Correo',
};
const REQUESTER_TYPE_LABELS: Record<string, string> = {
  INVESTIGADOR: 'Investigador',
  ESTUDIANTE: 'Estudiante',
  DOCENTE: 'Docente',
  CIUDADANO: 'Ciudadano',
  ENTIDAD: 'Entidad',
};
const ITEM_STATUS_LABELS: Record<string, string> = {
  PENDIENTE: 'Pendiente de búsqueda',
  LOCALIZADO: 'Localizado',
  NO_LOCALIZADO: 'No localizado',
  NO_APTO: 'No apto para consulta',
};

interface DetailResponse {
  id: string;
  request: RequestDetail | null;
  error: RequestsApiError | null;
}

/** "2026-12-01" -> "01/12/2026". Date-only text: no time zone conversion. */
function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

interface FieldProps {
  label: string;
  value: string | null;
  wide?: boolean;
}

function Field({ label, value, wide }: FieldProps) {
  return (
    <div className={`${styles.field} ${wide ? styles.wide : ''}`}>
      <dt>{label}</dt>
      <dd>{value || 'No indica'}</dd>
    </div>
  );
}

/** Staff screen (HU-13): the full detail of one request. */
export function RequestDetailPage() {
  const { id = '' } = useParams();
  // The answer remembers which id it belongs to: while they differ, it is loading
  const [response, setResponse] = useState<DetailResponse | null>(null);

  useEffect(() => {
    let ignore = false;
    getRequest(id)
      .then((request) => {
        if (!ignore) setResponse({ id, request, error: null });
      })
      .catch((caught: unknown) => {
        if (ignore) return;
        setResponse({
          id,
          request: null,
          error:
            caught instanceof RequestsApiError
              ? caught
              : new RequestsApiError(NETWORK_ERROR_MESSAGE, 0),
        });
      });
    return () => {
      ignore = true;
    };
  }, [id]);

  const isLoading = response?.id !== id;
  const request = isLoading ? null : response.request;
  const error = isLoading ? null : response.error;

  // After a status change (HU-15) the page shows the new status and its next
  // transitions without loading the request again
  function applyStatusChange(result: ChangeRequestStatusResult) {
    setResponse((current) =>
      current?.request?.id === result.id
        ? {
            ...current,
            request: {
              ...current.request,
              status: result.status,
              allowedTransitions: result.allowedTransitions,
            },
          }
        : current,
    );
  }

  return (
    <div className={searchStyles.shell}>
      <header className={searchStyles.topbar}>
        <p className={searchStyles.wordmark}>
          Trackhive<span className={searchStyles.wordmarkDot}>.</span>
        </p>
        <p className={searchStyles.topbarTag}>CLENA · Personal</p>
        <SiteNav />
      </header>

      <main className={searchStyles.main}>
        <Link className={styles.back} to={ROUTES.requests}>
          ‹ Volver a solicitudes
        </Link>

        <div aria-live="polite" aria-busy={isLoading}>
          {isLoading ? <p className={searchStyles.muted}>Cargando…</p> : null}

          {error ? (
            <div className={searchStyles.error} role="alert">
              <p>
                {error.status === 401
                  ? 'Su sesión no es válida o venció.'
                  : error.status === 404 || error.status === 400
                    ? 'No encontramos esa solicitud.'
                    : error.message}
              </p>
              {error.status === 401 ? (
                <Link to={ROUTES.login}>Iniciar sesión</Link>
              ) : null}
            </div>
          ) : null}
        </div>

        {request ? (
          <article aria-labelledby="request-title">
            <p className={searchStyles.eyebrow}>Detalle de la solicitud</p>
            <div className={styles.heading}>
              <h1 id="request-title" className={searchStyles.title}>
                {request.trackingCode}
              </h1>
              <span className={styles.badge} data-status={request.status}>
                {REQUEST_STATUS_LABELS[request.status]}
              </span>
            </div>

            <div className={styles.sections}>
              <ChangeRequestStatusForm
                key={request.id}
                request={request}
                onChanged={applyStatusChange}
              />

              <section className={styles.card} aria-labelledby="sec-requester">
                <h2 id="sec-requester" className={styles.cardTitle}>
                  Solicitante
                </h2>
                <dl className={styles.fields}>
                  <Field label="Nombre" value={request.requester.name} />
                  <Field label="Correo" value={request.requester.email} />
                  <Field label="Teléfono" value={request.requester.phone} />
                  <Field
                    label="Tipo de solicitante"
                    value={
                      REQUESTER_TYPE_LABELS[request.requester.requesterType] ??
                      request.requester.requesterType
                    }
                  />
                  <Field
                    label="Institución"
                    value={request.requester.institution}
                  />
                  <Field
                    label="Documento"
                    value={
                      request.requester.documentNumber
                        ? `${request.requester.documentType ?? ''} ${request.requester.documentNumber}`.trim()
                        : null
                    }
                  />
                </dl>
              </section>

              <section className={styles.card} aria-labelledby="sec-request">
                <h2 id="sec-request" className={styles.cardTitle}>
                  Solicitud
                </h2>
                <dl className={styles.fields}>
                  <Field
                    label="Estado"
                    value={REQUEST_STATUS_LABELS[request.status]}
                  />
                  <Field
                    label="Fecha deseada"
                    value={formatDate(request.desiredDate)}
                  />
                  <Field
                    label="Fecha acordada"
                    value={
                      request.committedDate
                        ? formatDate(request.committedDate)
                        : null
                    }
                  />
                  <Field
                    label="Radicada"
                    value={formatDate(request.registeredAt)}
                  />
                  <Field
                    label="Entrega"
                    value={DELIVERY_LABELS[request.deliveryMode]}
                  />
                  <Field
                    label="Canal"
                    value={
                      ORIGIN_LABELS[request.originChannel] ??
                      request.originChannel
                    }
                  />
                  <Field label="Motivo" value={request.reason} wide />
                  <Field
                    label="Descripción de lo requerido"
                    value={request.requirementDescription}
                    wide
                  />
                  {request.rejectionReason ? (
                    <Field
                      label="Motivo del rechazo"
                      value={request.rejectionReason}
                      wide
                    />
                  ) : null}
                </dl>
              </section>

              <section className={styles.card} aria-labelledby="sec-materials">
                <h2 id="sec-materials" className={styles.cardTitle}>
                  Material solicitado
                </h2>
                <ul className={styles.materialList}>
                  {request.materials.map((material) => (
                    <li key={material.id} className={styles.material}>
                      <strong>{material.title}</strong>
                      <span className={styles.meta}>
                        {material.catalogCode} ·{' '}
                        {MATERIAL_TYPE_LABELS[material.materialType]}
                        {material.author ? ` · ${material.author}` : ''}
                      </span>
                      <span>
                        Estado del material:{' '}
                        {MATERIAL_STATUS_LABELS[material.status]}
                      </span>
                      <span className={styles.meta}>
                        Ubicación: {material.location.depot} ·{' '}
                        {material.location.shelf} · {material.location.box}
                      </span>
                      <span>
                        Búsqueda:{' '}
                        {ITEM_STATUS_LABELS[material.itemStatus] ??
                          material.itemStatus}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </article>
        ) : null}
      </main>
    </div>
  );
}

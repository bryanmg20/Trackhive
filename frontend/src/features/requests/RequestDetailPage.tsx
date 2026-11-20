import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ROUTES } from '../../routes';
import {
  MATERIAL_STATUS_LABELS,
  MATERIAL_TYPE_LABELS,
  MaterialsApiError,
} from '../materials/api/search-materials';
import {
  deliverAppointmentMaterial,
  formatBogotaDateTime,
  returnMaterial,
  todayInBogotaIso,
} from '../materials/api/material-loans';
import { LoanActionModal } from '../materials/LoanActionModal';
import type { LoanActionMode } from '../materials/LoanActionModal';
import { AppLayout } from '../layout/AppLayout';
import searchStyles from '../materials/MaterialSearchPage.module.css';
import type { ChangeRequestStatusResult } from './api/change-request-status';
import { getRequest } from './api/get-request';
import type {
  RequestDetail,
  RequestDetailAppointmentMaterial,
} from './api/get-request';
import { REQUEST_STATUS_LABELS, RequestsApiError } from './api/list-requests';
import { ChangeRequestStatusForm } from './ChangeRequestStatusForm';
import styles from './RequestDetailPage.module.css';
import { RequestHistory } from './RequestHistory';
import { RequestReferencesSection } from './RequestReferencesSection';
import { ScheduleAppointmentForm } from './ScheduleAppointmentForm';

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
  // Each status change adds a row to the history (HU-17): reload it
  const [historyVersion, setHistoryVersion] = useState(0);
  const [detailVersion, setDetailVersion] = useState(0);
  const [loanDialog, setLoanDialog] = useState<{
    mode: LoanActionMode;
    appointmentId: string;
    material: RequestDetailAppointmentMaterial;
  } | null>(null);
  const [loanSubmitting, setLoanSubmitting] = useState(false);
  const [loanError, setLoanError] = useState<string | null>(null);
  const [loanNotice, setLoanNotice] = useState<string | null>(null);

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
  }, [id, detailVersion]);

  async function handleConfirmLoanAction(notes: string | undefined) {
    if (!loanDialog) return;
    setLoanSubmitting(true);
    setLoanError(null);
    setLoanNotice(null);
    try {
      const { mode, appointmentId, material } = loanDialog;
      const saved =
        mode === 'deliver'
          ? await deliverAppointmentMaterial({
              appointmentId,
              materialId: material.id,
              notes,
            })
          : await returnMaterial({
              materialId: material.id,
              notes,
            });
      setLoanDialog(null);
      setLoanNotice(
        mode === 'deliver'
          ? `Entrega registrada para «${material.title}» (${formatBogotaDateTime(saved.handedOverAt)}). El material quedó en uso.`
          : `Devolución registrada para «${material.title}»${saved.returnedAt ? ` (${formatBogotaDateTime(saved.returnedAt)})` : ''}. El material volvió a estar disponible.`,
      );
      setDetailVersion((version) => version + 1);
    } catch (caught: unknown) {
      if (caught instanceof MaterialsApiError) {
        setLoanError(
          caught.status === 401
            ? 'Su sesión no es válida o venció. Inicie sesión de nuevo.'
            : caught.message,
        );
      } else {
        setLoanError(NETWORK_ERROR_MESSAGE);
      }
    } finally {
      setLoanSubmitting(false);
    }
  }

  const isLoading = response?.id !== id;
  const request = isLoading ? null : response.request;
  const error = isLoading ? null : response.error;

  // After a status change (HU-15) or an appointment (HU-18) the page shows the
  // new status and its next transitions without loading the request again
  function applyStatusChange(
    result: Pick<
      ChangeRequestStatusResult,
      'id' | 'status' | 'allowedTransitions'
    > &
      Partial<Pick<ChangeRequestStatusResult, 'rejectionReason'>>,
  ) {
    setHistoryVersion((version) => version + 1);
    setResponse((current) =>
      current?.request?.id === result.id
        ? {
            ...current,
            request: {
              ...current.request,
              status: result.status,
              allowedTransitions: result.allowedTransitions,
              // Shows the «Motivo del rechazo» field right after rejecting (HU-16)
              // An appointment (HU-18) sends none: the request is not rejected
              rejectionReason: result.rejectionReason ?? null,
              activeAppointment:
                result.status === 'AGENDADA'
                  ? current.request.activeAppointment
                  : null,
            },
          }
        : current,
    );
  }

  return (
    <AppLayout>
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
            <ScheduleAppointmentForm
              key={`appointment-${request.id}`}
              request={request}
              onScheduled={applyStatusChange}
            />

            <ChangeRequestStatusForm
              key={request.id}
              request={request}
              onChanged={applyStatusChange}
            />

            {request.activeAppointment ? (
              <section
                className={styles.card}
                aria-labelledby="sec-active-appointment"
              >
                <h2 id="sec-active-appointment" className={styles.cardTitle}>
                  Cita programada · entrega y devolución en sala
                </h2>
                <p className={styles.meta}>
                  Fecha: {formatDate(request.activeAppointment.date)} · Horario
                  de {request.activeAppointment.serviceHours.opensAt} a{' '}
                  {request.activeAppointment.serviceHours.closesAt}
                </p>

                {loanNotice ? (
                  <p className={styles.notice} role="status">
                    {loanNotice}
                  </p>
                ) : null}

                <ul className={styles.materialList}>
                  {request.activeAppointment.materials.map((material) => {
                    const isToday =
                      request.activeAppointment?.date === todayInBogotaIso();
                    const canDeliver =
                      request.activeAppointment?.status === 'PROGRAMADA' &&
                      isToday &&
                      !material.activeLoan &&
                      material.status === 'DISPONIBLE';
                    const canReturn = Boolean(material.activeLoan);

                    return (
                      <li key={material.id} className={styles.material}>
                        <strong>{material.title}</strong>
                        <span className={styles.meta}>
                          {material.catalogCode} · Estado:{' '}
                          {MATERIAL_STATUS_LABELS[material.status]}
                        </span>
                        {material.activeLoan ? (
                          <span>
                            Entregado{' '}
                            {formatBogotaDateTime(
                              material.activeLoan.handedOverAt,
                            )}{' '}
                            por {material.activeLoan.handedOverBy.name}
                          </span>
                        ) : material.lastLoan?.returnedAt ? (
                          <span>
                            Última devolución:{' '}
                            {formatBogotaDateTime(material.lastLoan.returnedAt)}
                            {material.lastLoan.returnedBy
                              ? ` · recibió ${material.lastLoan.returnedBy.name}`
                              : ''}
                          </span>
                        ) : null}
                        {canDeliver || canReturn ? (
                          <div className={styles.loanActions}>
                            {canDeliver ? (
                              <button
                                type="button"
                                className={styles.loanButton}
                                onClick={() => {
                                  setLoanError(null);
                                  setLoanDialog({
                                    mode: 'deliver',
                                    appointmentId:
                                      request.activeAppointment!.id,
                                    material,
                                  });
                                }}
                                aria-label={`Registrar entrega de ${material.title}`}
                              >
                                Registrar entrega
                              </button>
                            ) : null}
                            {canReturn ? (
                              <button
                                type="button"
                                className={styles.loanReturnButton}
                                onClick={() => {
                                  setLoanError(null);
                                  setLoanDialog({
                                    mode: 'return',
                                    appointmentId:
                                      request.activeAppointment!.id,
                                    material,
                                  });
                                }}
                                aria-label={`Registrar devolución de ${material.title}`}
                              >
                                Registrar devolución
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

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

            <section className={styles.card} aria-labelledby="sec-history">
              <h2 id="sec-history" className={styles.cardTitle}>
                Historial de estados
              </h2>
              <RequestHistory
                key={`${request.id}-${historyVersion}`}
                requestId={request.id}
                label={`Historial de estados de ${request.trackingCode}`}
              />
            </section>

            <section className={styles.card} aria-labelledby="sec-materials">
              <h2 id="sec-materials" className={styles.cardTitle}>
                Material solicitado
              </h2>
              {request.materials.length === 0 ? (
                <p className={searchStyles.muted}>
                  Aún no hay material del catálogo: la solicitud solo trae
                  referencias escritas.
                </p>
              ) : null}
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
                    <span>
                      Búsqueda:{' '}
                      {ITEM_STATUS_LABELS[material.itemStatus] ??
                        material.itemStatus}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {request.references.length > 0 ? (
              <RequestReferencesSection
                requestId={request.id}
                references={request.references}
                canResolveReferences={request.canResolveReferences}
                onResolved={() => {
                  setDetailVersion((version) => version + 1);
                  setHistoryVersion((version) => version + 1);
                }}
              />
            ) : null}
          </div>
        </article>
      ) : null}

      {loanDialog ? (
        <LoanActionModal
          mode={loanDialog.mode}
          materialTitle={loanDialog.material.title}
          materialCatalogCode={loanDialog.material.catalogCode}
          submitting={loanSubmitting}
          error={loanError}
          onConfirm={handleConfirmLoanAction}
          onCancel={() => setLoanDialog(null)}
        />
      ) : null}
    </AppLayout>
  );
}

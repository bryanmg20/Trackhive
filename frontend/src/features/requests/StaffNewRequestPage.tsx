import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ROUTES } from '../../routes';
import { SiteNav } from '../navigation/SiteNav';
import { createRequestOnBehalf } from './api/create-request-on-behalf';
import type {
  DeliveryMode,
  RequesterPayload,
} from './api/create-request-on-behalf';
import { findRequesterByEmail } from './api/find-requester';
import type { RequesterProfile } from './api/find-requester';
import { RequestApiError } from './api/request-api-error';
import { readMaterialIds } from './selected-materials';
import type { SelectedMaterial } from './selected-materials';
import shellStyles from '../materials/MaterialSearchPage.module.css';
import styles from './StaffNewRequestPage.module.css';

interface NewRequestLocationState {
  materials?: SelectedMaterial[];
}

type LookupState =
  | { status: 'idle' }
  | { status: 'searching'; email: string }
  | { status: 'found'; email: string; profile: RequesterProfile }
  | { status: 'new'; email: string }
  | { status: 'error'; email: string; message: string; expired: boolean };

type FieldKey =
  | 'email'
  | 'firstName'
  | 'middleName'
  | 'lastName'
  | 'secondLastName'
  | 'phone'
  | 'requesterType'
  | 'institution'
  | 'documentType'
  | 'documentNumber'
  | 'reason'
  | 'desiredDate'
  | 'deliveryMode'
  | 'materials';

type FieldErrors = Partial<Record<FieldKey, string>>;

interface ContactData {
  firstName: string;
  middleName: string;
  lastName: string;
  secondLastName: string;
  phone: string;
  requesterType: string;
  institution: string;
  documentType: string;
  documentNumber: string;
}

interface Receipt {
  trackingCode: string;
  requesterName: string;
  desiredDate: string;
  deliveryMode: DeliveryMode;
  materialCount: number;
}

const EMPTY_CONTACT: ContactData = {
  firstName: '',
  middleName: '',
  lastName: '',
  secondLastName: '',
  phone: '',
  requesterType: 'CIUDADANO',
  institution: '',
  documentType: '',
  documentNumber: '',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REASON_MIN_LENGTH = 10;
const REASON_MAX_LENGTH = 2000;

const DETAIL_FIELD_BY_API: Record<string, FieldKey> = {
  email: 'email',
  'requester.email': 'email',
  'requester.firstName': 'firstName',
  'requester.middleName': 'middleName',
  'requester.lastName': 'lastName',
  'requester.secondLastName': 'secondLastName',
  'requester.phone': 'phone',
  'requester.requesterType': 'requesterType',
  'requester.institution': 'institution',
  'requester.documentType': 'documentType',
  'requester.documentNumber': 'documentNumber',
  reason: 'reason',
  desiredDate: 'desiredDate',
  deliveryMode: 'deliveryMode',
  materialIds: 'materials',
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function fullName(
  profile: Pick<
    RequesterProfile,
    'firstName' | 'middleName' | 'lastName' | 'secondLastName'
  >,
): string {
  return [
    profile.firstName,
    profile.middleName,
    profile.lastName,
    profile.secondLastName,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' ');
}

function ContactField({
  id,
  label,
  value,
  onChange,
  error,
  required = false,
  type = 'text',
  autoComplete,
  inputMode,
  maxLength,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  type?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'tel' | 'email';
  maxLength?: number;
  hint?: string;
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className={styles.field}>
      <label htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        aria-required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ') ||
          undefined
        }
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
      />
      {hint ? (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className={styles.fieldError} id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function StaffNewRequestPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const selectedMaterialIds = readMaterialIds(searchParams);
  const knownMaterials =
    (location.state as NewRequestLocationState | null)?.materials ?? [];
  const selectedMaterials = selectedMaterialIds.map(
    (id) =>
      knownMaterials.find((material) => material.id === id) ?? {
        id,
        title: 'Material seleccionado',
        catalogCode: id,
      },
  );

  const [email, setEmail] = useState('');
  const [lookup, setLookup] = useState<LookupState>({ status: 'idle' });
  const [contact, setContact] = useState<ContactData>(EMPTY_CONTACT);
  const [reason, setReason] = useState('');
  const [desiredDate, setDesiredDate] = useState('');
  const [deliveryMode, setDeliveryMode] =
    useState<DeliveryMode>('PRESENCIAL');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const foundResultRef = useRef<HTMLDivElement>(null);
  const firstNameRef = useRef<HTMLInputElement>(null);
  const formErrorRef = useRef<HTMLDivElement>(null);
  const receiptHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (lookup.status === 'found') {
      foundResultRef.current?.focus();
    }
    if (lookup.status === 'new') {
      firstNameRef.current?.focus();
    }
  }, [lookup.status]);

  useEffect(() => {
    if (formError) {
      formErrorRef.current?.focus();
    }
  }, [formError]);

  useEffect(() => {
    if (receipt) {
      receiptHeadingRef.current?.focus();
    }
  }, [receipt]);

  function updateContact(field: keyof ContactData, value: string) {
    setContact((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  function changeEmail(value: string) {
    setEmail(value);
    setFieldErrors((current) => ({ ...current, email: undefined }));

    if (
      lookup.status !== 'idle' &&
      normalizeEmail(value) !== lookup.email
    ) {
      // The lookup belongs to the previous email: ask for it again.
      setLookup({ status: 'idle' });
    }
  }

  async function searchRequester(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeEmail(email);

    if (!normalized) {
      setFieldErrors((current) => ({
        ...current,
        email: 'Escriba el correo del solicitante.',
      }));
      emailInputRef.current?.focus();
      return;
    }
    if (!EMAIL_PATTERN.test(normalized)) {
      setFieldErrors((current) => ({
        ...current,
        email: 'El correo no tiene un formato válido.',
      }));
      emailInputRef.current?.focus();
      return;
    }

    setFieldErrors((current) => ({ ...current, email: undefined }));
    setLookup({ status: 'searching', email: normalized });
    setSessionExpired(false);

    try {
      const profile = await findRequesterByEmail(normalized);
      if (profile) {
        setLookup({ status: 'found', email: normalized, profile });
      } else {
        setLookup({ status: 'new', email: normalized });
      }
    } catch (error) {
      const message =
        error instanceof RequestApiError
          ? error.status === 401
            ? 'Su sesión no es válida o venció. Inicie sesión de nuevo.'
            : error.message
          : 'No pudimos buscar el solicitante. Inténtelo de nuevo.';
      setLookup({
        status: 'error',
        email: normalized,
        message,
        expired: error instanceof RequestApiError && error.status === 401,
      });
    }
  }

  function validateForm(normalizedEmail: string): FieldErrors {
    const errors: FieldErrors = {};

    if (selectedMaterialIds.length === 0) {
      errors.materials = 'Elija al menos un material en el buscador.';
    }

    if (lookup.status === 'idle' || lookup.status === 'searching') {
      errors.email = 'Busque el correo antes de registrar la solicitud.';
    } else if (lookup.status === 'error') {
      errors.email =
        'No pudimos verificar el correo. Búsquelo de nuevo antes de continuar.';
    } else if (lookup.email !== normalizedEmail) {
      errors.email = 'El correo cambió. Búsquelo de nuevo.';
    }

    if (lookup.status === 'new') {
      if (!contact.firstName.trim()) {
        errors.firstName = 'El primer nombre es obligatorio.';
      }
      if (!contact.lastName.trim()) {
        errors.lastName = 'El primer apellido es obligatorio.';
      }
    }

    if (!reason.trim()) {
      errors.reason = 'Escriba el motivo de la consulta.';
    } else if (reason.trim().length < REASON_MIN_LENGTH) {
      errors.reason = `El motivo debe tener al menos ${REASON_MIN_LENGTH} caracteres.`;
    } else if (reason.trim().length > REASON_MAX_LENGTH) {
      errors.reason = `El motivo no puede superar los ${REASON_MAX_LENGTH} caracteres.`;
    }

    if (!desiredDate) {
      errors.desiredDate = 'Elija la fecha deseada.';
    }

    return errors;
  }

  function buildRequester(normalizedEmail: string): RequesterPayload {
    if (lookup.status === 'found') {
      const { profile } = lookup;
      return {
        email: profile.email,
        ...(profile.userId ? { userId: profile.userId } : {}),
      };
    }

    const trimmed = (value: string) => {
      const result = value.trim();
      return result === '' ? undefined : result;
    };

    return {
      email: normalizedEmail,
      firstName: contact.firstName.trim(),
      middleName: trimmed(contact.middleName),
      lastName: contact.lastName.trim(),
      secondLastName: trimmed(contact.secondLastName),
      phone: trimmed(contact.phone),
      requesterType: contact.requesterType || undefined,
      institution: trimmed(contact.institution),
      documentType: contact.documentType || undefined,
      documentNumber: trimmed(contact.documentNumber),
    };
  }

  function applyServerError(error: RequestApiError): boolean {
    const errors: FieldErrors = {};

    for (const detail of error.details) {
      const field = DETAIL_FIELD_BY_API[detail.field];
      if (field && !errors[field] && detail.messages[0]) {
        errors[field] = detail.messages[0];
      }
    }

    if (error.code === 'INVALID_DESIRED_DATE') {
      errors.desiredDate = error.message;
    } else if (
      error.code === 'REQUESTER_NAME_REQUIRED' &&
      !errors.firstName &&
      !errors.lastName
    ) {
      errors.firstName = error.message;
    } else if (
      error.code === 'REQUESTER_EMAIL_REQUIRED' ||
      error.code === 'REQUESTER_EMAIL_MISMATCH'
    ) {
      errors.email = error.message;
    } else if (
      error.code === 'REQUEST_MATERIAL_NOT_FOUND' ||
      error.code === 'REQUEST_MATERIALS_REQUIRED'
    ) {
      errors.materials = error.message;
    }

    if (Object.keys(errors).length === 0) {
      return false;
    }

    setFieldErrors(errors);
    return true;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setSessionExpired(false);

    const normalizedEmail = normalizeEmail(email);
    const errors = validateForm(normalizedEmail);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    const requester = buildRequester(normalizedEmail);

    try {
      const result = await createRequestOnBehalf({
        materialIds: selectedMaterialIds,
        reason: reason.trim(),
        desiredDate,
        deliveryMode,
        requester,
      });
      setReceipt({
        trackingCode: result.trackingCode,
        requesterName:
          lookup.status === 'found'
            ? fullName(lookup.profile)
            : `${contact.firstName} ${contact.lastName}`.trim(),
        desiredDate,
        deliveryMode,
        materialCount: selectedMaterialIds.length,
      });
    } catch (error) {
      if (error instanceof RequestApiError) {
        if (error.status === 401) {
          setSessionExpired(true);
          setFormError(
            'Su sesión no es válida o venció. Inicie sesión de nuevo.',
          );
        } else if (!applyServerError(error)) {
          setFormError(error.message);
        }
      } else {
        setFormError(
          'No fue posible registrar la solicitud. Inténtelo de nuevo.',
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function registerAnother() {
    setReceipt(null);
    setEmail('');
    setLookup({ status: 'idle' });
    setContact(EMPTY_CONTACT);
    setReason('');
    setDesiredDate('');
    setDeliveryMode('PRESENCIAL');
    setFieldErrors({});
    setFormError('');
    setSessionExpired(false);
    window.setTimeout(() => emailInputRef.current?.focus(), 0);
  }

  const isLookupBusy = lookup.status === 'searching';
  const showContactFields = lookup.status === 'new';
  const showFoundProfile = lookup.status === 'found';

  return (
    <div className={shellStyles.shell}>
      <header className={shellStyles.topbar}>
        <p className={shellStyles.wordmark}>
          Trackhive<span className={shellStyles.wordmarkDot}>.</span>
        </p>
        <p className={shellStyles.topbarTag}>CLENA · Personal</p>
        <SiteNav />
      </header>

      <main className={shellStyles.main}>
        <section className={styles.hero} aria-labelledby="staff-request-title">
          <p className={shellStyles.eyebrow}>Mostrador · Solicitud</p>
          <h1 id="staff-request-title" className={shellStyles.title}>
            Ficha de solicitud
          </h1>
          <p className={styles.lede}>
            Para personas que llegan o llaman sin cuenta. Busque el correo,
            elija el material y entregue el código de seguimiento.
          </p>
          <p className={styles.backRow}>
            <Link className={styles.backLink} to={ROUTES.staffMaterials}>
              ‹ Volver al estado del material
            </Link>
          </p>
        </section>

        {receipt ? (
          <section className={styles.receipt} aria-labelledby="receipt-title">
            <div className={styles.receiptMark} aria-hidden="true">
              Recibida
            </div>
            <p className={styles.eyebrow}>Comprobante de mostrador</p>
            <h2
              id="receipt-title"
              className={styles.receiptTitle}
              ref={receiptHeadingRef}
              tabIndex={-1}
            >
              Solicitud registrada
            </h2>
            <p className={styles.receiptBody}>
              Entregue este código al solicitante para que pueda seguir su
              solicitud.
            </p>
            <p className={styles.receiptCode} role="status">
              {receipt.trackingCode}
            </p>
            <dl className={styles.receiptData}>
              <div>
                <dt>Solicitante</dt>
                <dd>{receipt.requesterName}</dd>
              </div>
              <div>
                <dt>Fecha deseada</dt>
                <dd>{receipt.desiredDate}</dd>
              </div>
              <div>
                <dt>Modalidad</dt>
                <dd>{receipt.deliveryMode === 'DIGITAL' ? 'Digital' : 'Presencial'}</dd>
              </div>
              <div>
                <dt>Materiales</dt>
                <dd>
                  {receipt.materialCount === 1
                    ? '1 material'
                    : `${receipt.materialCount} materiales`}
                </dd>
              </div>
            </dl>
            <div className={styles.actions}>
              <button
                className={styles.primary}
                type="button"
                onClick={registerAnother}
              >
                Registrar otra solicitud
              </button>
              <Link className={styles.secondaryLink} to={ROUTES.staffMaterials}>
                Buscar otro material
              </Link>
            </div>
          </section>
        ) : (
          <div className={styles.layout}>
            <section
              className={styles.card}
              aria-labelledby="requester-title"
            >
              <p className={styles.step}>01 · Solicitante</p>
              <h2 id="requester-title" className={styles.sectionTitle}>
                ¿Quién solicita?
              </h2>
              <p className={styles.sectionIntro}>
                Si ya está registrado, sus datos aparecen aquí y no se vuelven
                a pedir.
              </p>

              <form
                className={styles.lookupForm}
                onSubmit={(event) => void searchRequester(event)}
                noValidate
              >
                <div className={styles.lookupRow}>
                  <div className={styles.field}>
                    <label htmlFor="requester-email">
                      Correo del solicitante
                      <span aria-hidden="true"> *</span>
                    </label>
                    <input
                      id="requester-email"
                      ref={emailInputRef}
                      type="email"
                      value={email}
                      onChange={(event) => changeEmail(event.target.value)}
                      required
                      aria-required="true"
                      aria-invalid={
                        fieldErrors.email ? true : undefined
                      }
                      aria-describedby={
                        fieldErrors.email ? 'requester-email-error' : undefined
                      }
                      autoComplete="email"
                      inputMode="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      maxLength={160}
                    />
                    {fieldErrors.email ? (
                      <p
                        className={styles.fieldError}
                        id="requester-email-error"
                        role="alert"
                      >
                        {fieldErrors.email}
                      </p>
                    ) : null}
                  </div>
                  <button
                    className={styles.lookupButton}
                    type="submit"
                    disabled={isLookupBusy}
                  >
                    {isLookupBusy ? 'Buscando…' : 'Buscar'}
                  </button>
                </div>
              </form>

              {lookup.status === 'error' ? (
                <div className={styles.lookupError} role="alert">
                  <p>{lookup.message}</p>
                  {lookup.expired ? (
                    <Link to={ROUTES.login}>Iniciar sesión</Link>
                  ) : null}
                </div>
              ) : null}

              {showFoundProfile ? (
                <div
                  className={styles.found}
                  ref={foundResultRef}
                  tabIndex={-1}
                  role="status"
                >
                  <p className={styles.stamp}>Encontrado</p>
                  <p className={styles.foundName}>
                    {fullName(lookup.profile)}
                  </p>
                  <dl className={styles.foundData}>
                    <div>
                      <dt>Correo</dt>
                      <dd>{lookup.profile.email}</dd>
                    </div>
                    {lookup.profile.phone ? (
                      <div>
                        <dt>Teléfono</dt>
                        <dd>{lookup.profile.phone}</dd>
                      </div>
                    ) : null}
                    {lookup.profile.requesterType ? (
                      <div>
                        <dt>Tipo</dt>
                        <dd>{lookup.profile.requesterType}</dd>
                      </div>
                    ) : null}
                    {lookup.profile.institution ? (
                      <div>
                        <dt>Institución</dt>
                        <dd>{lookup.profile.institution}</dd>
                      </div>
                    ) : null}
                    {lookup.profile.documentNumber ? (
                      <div>
                        <dt>Documento</dt>
                        <dd>
                          {lookup.profile.documentType
                            ? `${lookup.profile.documentType} `
                            : ''}
                          {lookup.profile.documentNumber}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  <p className={styles.hint}>
                    Datos tomados de la cuenta registrada.
                  </p>
                </div>
              ) : null}

              {showContactFields ? (
                <div className={styles.contact} aria-live="polite">
                  <p className={styles.stamp} data-state="new">
                    Nuevo solicitante
                  </p>
                  <p className={styles.sectionIntro}>
                    No encontramos ese correo. Complete sus datos de contacto.
                  </p>

                  <div className={styles.nameRow}>
                    <ContactField
                      id="requester-first-name"
                      label="Primer nombre"
                      value={contact.firstName}
                      onChange={(value) => updateContact('firstName', value)}
                      error={fieldErrors.firstName}
                      required
                      autoComplete="given-name"
                      maxLength={40}
                    />
                    <ContactField
                      id="requester-middle-name"
                      label="Segundo nombre"
                      value={contact.middleName}
                      onChange={(value) => updateContact('middleName', value)}
                      error={fieldErrors.middleName}
                      autoComplete="additional-name"
                      maxLength={40}
                    />
                    <ContactField
                      id="requester-last-name"
                      label="Primer apellido"
                      value={contact.lastName}
                      onChange={(value) => updateContact('lastName', value)}
                      error={fieldErrors.lastName}
                      required
                      autoComplete="family-name"
                      maxLength={40}
                    />
                    <ContactField
                      id="requester-second-last-name"
                      label="Segundo apellido"
                      value={contact.secondLastName}
                      onChange={(value) =>
                        updateContact('secondLastName', value)
                      }
                      error={fieldErrors.secondLastName}
                      autoComplete="additional-name"
                      maxLength={40}
                    />
                  </div>

                  <ContactField
                    id="requester-phone"
                    label="Teléfono de contacto"
                    type="tel"
                    value={contact.phone}
                    onChange={(value) => updateContact('phone', value)}
                    error={fieldErrors.phone}
                    autoComplete="tel"
                    inputMode="tel"
                    maxLength={20}
                    hint="Opcional. Útil si el CLENA necesita contactar al solicitante."
                  />

                  <details className={styles.additional}>
                    <summary>Datos adicionales (opcional)</summary>
                    <div className={styles.additionalBody}>
                      <div className={styles.field}>
                        <label htmlFor="requester-type">
                          Tipo de solicitante
                        </label>
                        <select
                          id="requester-type"
                          value={contact.requesterType}
                          onChange={(event) =>
                            updateContact('requesterType', event.target.value)
                          }
                          aria-invalid={
                            fieldErrors.requesterType ? true : undefined
                          }
                        >
                          <option value="CIUDADANO">Ciudadano</option>
                          <option value="INVESTIGADOR">Investigador</option>
                          <option value="ESTUDIANTE">Estudiante</option>
                          <option value="DOCENTE">Docente</option>
                          <option value="ENTIDAD">Entidad</option>
                        </select>
                        {fieldErrors.requesterType ? (
                          <p className={styles.fieldError} role="alert">
                            {fieldErrors.requesterType}
                          </p>
                        ) : null}
                      </div>

                      <ContactField
                        id="requester-institution"
                        label="Institución"
                        value={contact.institution}
                        onChange={(value) =>
                          updateContact('institution', value)
                        }
                        error={fieldErrors.institution}
                        autoComplete="organization"
                        maxLength={150}
                      />

                      <div className={styles.field}>
                        <label htmlFor="requester-document-type">
                          Tipo de documento
                        </label>
                        <select
                          id="requester-document-type"
                          value={contact.documentType}
                          onChange={(event) =>
                            updateContact(
                              'documentType',
                              event.target.value,
                            )
                          }
                          aria-invalid={
                            fieldErrors.documentType ? true : undefined
                          }
                        >
                          <option value="">Sin documento</option>
                          <option value="CC">Cédula de ciudadanía</option>
                          <option value="CE">Cédula de extranjería</option>
                          <option value="TI">Tarjeta de identidad</option>
                          <option value="PAS">Pasaporte</option>
                          <option value="NIT">NIT</option>
                        </select>
                        {fieldErrors.documentType ? (
                          <p className={styles.fieldError} role="alert">
                            {fieldErrors.documentType}
                          </p>
                        ) : null}
                      </div>

                      <ContactField
                        id="requester-document-number"
                        label="Número de documento"
                        value={contact.documentNumber}
                        onChange={(value) =>
                          updateContact('documentNumber', value)
                        }
                        error={fieldErrors.documentNumber}
                        maxLength={20}
                      />
                    </div>
                  </details>
                </div>
              ) : null}
            </section>

            <section
              className={styles.card}
              aria-labelledby="request-details-title"
            >
              <p className={styles.step}>02 · Solicitud</p>
              <h2 id="request-details-title" className={styles.sectionTitle}>
                Material y entrega
              </h2>

              <div className={styles.materials}>
                <div className={styles.materialsHeader}>
                  <h3 className={styles.subsectionTitle}>
                    Materiales elegidos:{' '}
                    {selectedMaterials.length === 1
                      ? '1'
                      : selectedMaterials.length}
                  </h3>
                  <Link className={styles.backLink} to={ROUTES.staffMaterials}>
                    {selectedMaterials.length > 0
                      ? 'Cambiar materiales'
                      : 'Elegir en el buscador'}
                  </Link>
                </div>

                {selectedMaterials.length > 0 ? (
                  <ul className={styles.materialList}>
                    {selectedMaterials.map((material) => (
                      <li className={styles.materialItem} key={material.id}>
                        <span className={styles.materialTitle}>
                          {material.title}
                        </span>
                        <span className={styles.materialCode}>
                          {material.catalogCode}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.emptyMaterials}>
                    Aún no ha elegido materiales. Búsquelos en el archivo y
                    pulse «Solicitar» o «Registrar solicitud».
                  </p>
                )}
                {fieldErrors.materials ? (
                  <p className={styles.fieldError} role="alert">
                    {fieldErrors.materials}
                  </p>
                ) : null}
              </div>

              <form
                className={styles.requestForm}
                onSubmit={(event) => void submit(event)}
                noValidate
                aria-busy={isSubmitting}
              >
                <div className={styles.field}>
                  <label htmlFor="staff-request-reason">
                    Motivo de la consulta
                    <span aria-hidden="true"> *</span>
                  </label>
                  <textarea
                    id="staff-request-reason"
                    value={reason}
                    onChange={(event) => {
                      setReason(event.target.value);
                      setFieldErrors((current) => ({
                        ...current,
                        reason: undefined,
                      }));
                    }}
                    required
                    aria-required="true"
                    aria-invalid={fieldErrors.reason ? true : undefined}
                    aria-describedby={
                      fieldErrors.reason
                        ? 'staff-request-reason-error'
                        : 'staff-request-reason-hint'
                    }
                    minLength={REASON_MIN_LENGTH}
                    maxLength={REASON_MAX_LENGTH}
                    rows={4}
                  />
                  <p className={styles.hint} id="staff-request-reason-hint">
                    Describa qué necesita consultar. Mínimo{' '}
                    {REASON_MIN_LENGTH} caracteres.
                  </p>
                  {fieldErrors.reason ? (
                    <p
                      className={styles.fieldError}
                      id="staff-request-reason-error"
                      role="alert"
                    >
                      {fieldErrors.reason}
                    </p>
                  ) : null}
                </div>

                <div className={styles.field}>
                  <label htmlFor="staff-request-date">
                    Fecha deseada
                    <span aria-hidden="true"> *</span>
                  </label>
                  <input
                    id="staff-request-date"
                    type="date"
                    value={desiredDate}
                    onChange={(event) => {
                      setDesiredDate(event.target.value);
                      setFieldErrors((current) => ({
                        ...current,
                        desiredDate: undefined,
                      }));
                    }}
                    required
                    aria-required="true"
                    aria-invalid={fieldErrors.desiredDate ? true : undefined}
                    aria-describedby={
                      fieldErrors.desiredDate
                        ? 'staff-request-date-error'
                        : 'staff-request-date-hint'
                    }
                  />
                  <p className={styles.hint} id="staff-request-date-hint">
                    El CLENA atiende de lunes a sábado. La fecha debe tener al
                    menos 10 días hábiles de anticipación.
                  </p>
                  {fieldErrors.desiredDate ? (
                    <p
                      className={styles.fieldError}
                      id="staff-request-date-error"
                      role="alert"
                    >
                      {fieldErrors.desiredDate}
                    </p>
                  ) : null}
                </div>

                <fieldset className={styles.delivery}>
                  <legend>Modalidad de entrega</legend>
                  <label className={styles.deliveryOption}>
                    <input
                      type="radio"
                      name="staff-delivery-mode"
                      value="PRESENCIAL"
                      checked={deliveryMode === 'PRESENCIAL'}
                      onChange={() => setDeliveryMode('PRESENCIAL')}
                    />
                    Presencial
                  </label>
                  <label className={styles.deliveryOption}>
                    <input
                      type="radio"
                      name="staff-delivery-mode"
                      value="DIGITAL"
                      checked={deliveryMode === 'DIGITAL'}
                      onChange={() => setDeliveryMode('DIGITAL')}
                    />
                    Digital
                  </label>
                </fieldset>

                {formError ? (
                  <div
                    className={styles.formError}
                    ref={formErrorRef}
                    role="alert"
                    tabIndex={-1}
                  >
                    <p>{formError}</p>
                    {sessionExpired ? (
                      <Link to={ROUTES.login}>Iniciar sesión</Link>
                    ) : null}
                  </div>
                ) : null}

                <button
                  className={styles.primary}
                  type="submit"
                  disabled={
                    isSubmitting ||
                    isLookupBusy ||
                    selectedMaterialIds.length === 0
                  }
                >
                  {isSubmitting ? 'Registrando…' : 'Registrar solicitud'}
                </button>
                {selectedMaterialIds.length === 0 ? (
                  <p className={styles.hint}>
                    Elija al menos un material en el buscador para habilitar el
                    registro.
                  </p>
                ) : null}
              </form>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

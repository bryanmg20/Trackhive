import type { UseFormRegisterReturn } from 'react-hook-form';
import {
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_POLICY_EFFECTIVE_DATE,
  PRIVACY_POLICY_VERSION,
} from './privacy-policy';
import styles from './PrivacyConsent.module.css';

interface PrivacyConsentProps {
  registration: UseFormRegisterReturn;
  error?: string;
}

export function PrivacyConsent({
  registration,
  error,
}: PrivacyConsentProps) {
  const errorId = error ? 'acceptedPrivacy-error' : undefined;

  return (
    <section className={styles.consent} aria-labelledby="privacy-title">
      <div className={styles.notice}>
        <div className={styles.noticeHeader}>
          <h2 className={styles.noticeTitle} id="privacy-title">
            Aviso de privacidad
          </h2>
          <p className={styles.version}>
            Versión {PRIVACY_POLICY_VERSION}
            <span aria-hidden="true"> · </span>
            vigente desde el {PRIVACY_POLICY_EFFECTIVE_DATE}
          </p>
        </div>

        <p className={styles.intro}>
          El CLENA usará su nombre completo y su correo electrónico para crear y
          administrar su cuenta, gestionar sus solicitudes de consulta y
          enviarle avisos sobre su estado. No solicitamos datos sensibles ni
          vendemos su información.
        </p>

        <details className={styles.fullText}>
          <summary className={styles.summary}>Leer aviso completo</summary>

          <div className={styles.fullTextBody}>
            <h3>1. Responsable del tratamiento</h3>
            <p>
              CLENA es el responsable del tratamiento de los datos personales
              que usted registra en Trackhive. Para cualquier consulta sobre
              este aviso puede escribir a{' '}
              <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>
                {PRIVACY_CONTACT_EMAIL}
              </a>
              .
            </p>

            <h3>2. Datos que tratamos</h3>
            <p>
              Nombre completo, correo electrónico, contraseña almacenada
              únicamente como hash, fecha de registro y la información de las
              solicitudes de consulta que usted radica. La confirmación de la
              contraseña solo se usa en su navegador y no se envía al servidor.
            </p>

            <h3>3. Para qué los usamos</h3>
            <ul>
              <li>Crear y administrar su cuenta de usuario público.</li>
              <li>
                Recibir, tramitar y hacer seguimiento a sus solicitudes de
                consulta del archivo.
              </li>
              <li>
                Enviarle notificaciones relacionadas con el estado de sus
                solicitudes.
              </li>
              <li>
                Mantener la seguridad del servicio y generar reportes con
                información agregada, sin identificar personas.
              </li>
            </ul>

            <h3>4. Sus derechos</h3>
            <p>
              De acuerdo con la Ley 1581 de 2012 y el Decreto 1377 de 2013,
              usted puede conocer, actualizar, rectificar y suprimir sus datos,
              así como revocar esta autorización. Para ejercer estos derechos
              escriba a{' '}
              <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>
                {PRIVACY_CONTACT_EMAIL}
              </a>
              . También puede solicitar la eliminación de su cuenta; en ese caso
              sus datos personales se anonimizan y se conservan las solicitudes
              sin información que lo identifique.
            </p>

            <h3>5. Conservación y seguridad</h3>
            <p>
              Los datos se conservan mientras su cuenta esté activa y durante
              los plazos legales aplicables. Aplicamos control de acceso por
              rol, almacenamos las contraseñas como hash y no incluimos datos
              personales en los registros del sistema.
            </p>

            <h3>6. Transferencias y cambios</h3>
            <p>
              No vendemos ni cedemos sus datos a terceros para fines publicitarios.
              Si este aviso cambia, publicaremos una nueva versión con su fecha
              de vigencia y se la informaremos antes de aplicar el cambio.
            </p>

            <p className={styles.acceptance}>
              Al marcar la casilla usted declara haber leído este aviso y
              autoriza el tratamiento de sus datos personales para las
              finalidades aquí descritas. Esta autorización es previa, expresa
              e informada.
            </p>
          </div>
        </details>
      </div>

      <label
        className={`${styles.checkboxRow} ${error ? styles.checkboxRowError : ''}`}
        htmlFor="acceptedPrivacy"
      >
        <input
          className={styles.checkbox}
          id="acceptedPrivacy"
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          {...registration}
        />
        <span className={styles.checkboxText}>
          Acepto el aviso de privacidad y autorizo el tratamiento de mis datos
          personales para las finalidades descritas.
        </span>
      </label>

      {error ? (
        <p className={styles.error} id={errorId}>
          <span className={styles.errorMark} aria-hidden="true">
            !
          </span>
          <span>{error}</span>
        </p>
      ) : null}
    </section>
  );
}

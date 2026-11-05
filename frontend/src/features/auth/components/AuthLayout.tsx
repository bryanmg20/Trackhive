import type { ReactNode } from 'react';
import styles from './AuthLayout.module.css';

interface AuthLayoutProps {
  children: ReactNode;
  spineLabel?: string;
}

export function AuthLayout({
  children,
  spineLabel = 'USUARIO PÚBLICO · REGISTRO',
}: AuthLayoutProps) {
  return (
    <main className={styles.page}>
      <aside className={styles.panel} aria-label="Presentación de Trackhive">
        <div className={styles.brand}>
          <p className={styles.wordmark}>
            Trackhive<span className={styles.wordmarkDot}>.</span>
          </p>
          <p className={styles.brandTag}>CLENA · Archivo</p>
        </div>

        <div className={styles.panelCopy}>
          <p className={styles.eyebrow}>Consulta documental</p>
          <p className={styles.statement}>
            Pida material.
            <br />
            Siga su <em>solicitud</em>.
          </p>
          <p className={styles.panelBody}>
            Una cuenta reúne sus solicitudes y su estado en un solo lugar.
          </p>
        </div>

        <p className={styles.panelMeta}>
          <span>Archivo</span>
          <span>Consulta</span>
          <span>Seguimiento</span>
        </p>
      </aside>

      <section className={styles.content}>
        <div className={styles.card}>
          <div className={styles.spine} aria-hidden="true">
            <span className={styles.spineText}>{spineLabel}</span>
          </div>
          <div className={styles.cardBody}>{children}</div>
        </div>
        <p className={styles.caption}>
          Trackhive · Sistema de consulta y seguimiento
        </p>
      </section>
    </main>
  );
}

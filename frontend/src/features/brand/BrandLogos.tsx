import clenaLogo from '../../assets/brand/clena.png';
import uninorteLogo from '../../assets/brand/uninorte.png';
import styles from './BrandLogos.module.css';

/**
 * CLENA and Universidad del Norte signatures, side by side with the same
 * visible height (52 px desktop, 36 px phone), as in the wireframes.
 * The original PNGs are in docs/wireframes/assets (LOGOS.md).
 */
export function BrandLogos() {
  return (
    <span className={styles.brand}>
      <img
        className={styles.clena}
        src={clenaLogo}
        alt="CLENA"
        width={278}
        height={61}
      />
      <span className={styles.divider} aria-hidden="true" />
      <img
        className={styles.uninorte}
        src={uninorteLogo}
        alt="Universidad del Norte"
        width={449}
        height={122}
      />
    </span>
  );
}

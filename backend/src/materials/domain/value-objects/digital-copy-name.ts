const DRIVE_ONLY = /^[A-Za-z]:$/;

/**
 * Extracts only the leaf folder name from a stored Everything path (HU-140),
 * never returning a drive letter, UNC host/share, or parent directories.
 */
export function extractDigitalFolderName(
  digitalPath: string | null | undefined,
): string | null {
  if (!digitalPath) {
    return null;
  }
  const trimmed = digitalPath.trim();
  if (trimmed === '') {
    return null;
  }
  const parts = trimmed.split(/[/\\]+/).filter((part) => part !== '');
  if (parts.length === 0) {
    return null;
  }
  // UNC path (\\server or \\server\share) without a subfolder below the share
  if (
    (trimmed.startsWith('\\\\') || trimmed.startsWith('//')) &&
    parts.length <= 2
  ) {
    return null;
  }
  const leaf = parts[parts.length - 1];
  if (DRIVE_ONLY.test(leaf)) {
    return null;
  }
  return leaf;
}

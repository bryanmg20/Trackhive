/** A folder or a file of the index (HU-135). */
export type DocumentKind = 'folder' | 'file';

/**
 * A result of Everything in Trackhive's own terms. The rest of Trackhive
 * (parse HU-136, sync HU-137) only sees this type, never the JSON of
 * Everything, which EverythingPageMapper translates.
 */
export interface DocumentRecord {
  name: string;
  // Folder that holds it, with `\`. Empty for the indexed root, whose name
  // is already its full path
  parentPath: string;
  // parentPath + `\` + name
  fullPath: string;
  kind: DocumentKind;
  // Bytes; Everything sends no size for folders
  size?: number;
  modifiedAt: Date;
}

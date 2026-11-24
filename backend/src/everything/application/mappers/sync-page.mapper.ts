import type {
  ReceivedSyncPage,
  SyncFolder,
} from '../../domain/value-objects/received-sync-page';
import type { DocumentRecord } from '../dto/document-record';

const SEPARATOR = '\\';

/**
 * Between the DocumentRecord of a page (HU-135) and the folders a run keeps
 * until it closes (HU-137). Only the folders are kept: the files of a page
 * never become materials (HU-136).
 */
export class SyncPageMapper {
  static toPage(
    number: number,
    records: DocumentRecord[],
    receivedAt: Date,
  ): ReceivedSyncPage {
    return {
      number,
      resultsCount: records.length,
      folders: records
        .filter((record) => record.kind === 'folder')
        .map((record) => ({
          fullPath: record.fullPath,
          modifiedAt: record.modifiedAt,
        })),
      receivedAt,
    };
  }

  /**
   * The folders of every page of the run, in page order, back as
   * DocumentRecord for LeafFolderParser, which needs them all at once.
   */
  static toRecords(pages: readonly ReceivedSyncPage[]): DocumentRecord[] {
    return pages.flatMap((page) =>
      page.folders.map((folder) => SyncPageMapper.toRecord(folder)),
    );
  }

  private static toRecord(folder: SyncFolder): DocumentRecord {
    const cut = folder.fullPath.lastIndexOf(SEPARATOR);
    return {
      name: cut < 0 ? folder.fullPath : folder.fullPath.slice(cut + 1),
      parentPath: cut < 0 ? '' : folder.fullPath.slice(0, cut),
      fullPath: folder.fullPath,
      kind: 'folder',
      modifiedAt: folder.modifiedAt,
    };
  }
}

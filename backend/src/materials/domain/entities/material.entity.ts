import { InvalidMaterialReviewReasonError } from '../errors/invalid-material-review-reason.error';
import { InvalidMaterialSourceError } from '../errors/invalid-material-source.error';
import { InvalidMaterialStatusError } from '../errors/invalid-material-status.error';
import { InvalidMaterialTypeError } from '../errors/invalid-material-type.error';
import { MaterialInUseError } from '../errors/material-in-use.error';
import { MaterialStatusNotManualError } from '../errors/material-status-not-manual.error';
import {
  isMaterialReviewReason,
  MaterialReviewReason,
} from '../enums/material-review-reason';
import { isMaterialSource, MaterialSource } from '../enums/material-source';
import {
  isManualMaterialStatus,
  isMaterialStatus,
  MaterialStatus,
} from '../enums/material-status';
import { isMaterialType, MaterialType } from '../enums/material-type';

export interface MaterialProps {
  id: string;
  catalogCode: string;
  title: string;
  materialType: MaterialType;
  author: string | null;
  collection: string;
  // Periodicals only (HU-06)
  publicationDate: Date | null;
  publisher: string | null;
  status: MaterialStatus;
  // HU-134. Defaults: MANUAL, without digital copy and never seen by a sync
  source?: MaterialSource;
  // Full path of the digital copy; internal, never sent by the API
  digitalPath?: string | null;
  lastSeenAt?: Date | null;
  // HU-137. Why the staff should review its code; null (default) = nothing
  reviewReason?: MaterialReviewReason | null;
  // Last status change (HU-08); null while it was never changed
  statusChangedAt?: Date | null;
  statusChangedBy?: string | null;
  statusChangeReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Material {
  public readonly id: string;
  public readonly catalogCode: string;
  public readonly title: string;
  public readonly materialType: MaterialType;
  public readonly author: string | null;
  public readonly collection: string;
  public readonly publicationDate: Date | null;
  public readonly publisher: string | null;
  public readonly status: MaterialStatus;
  public readonly source: MaterialSource;
  public readonly digitalPath: string | null;
  public readonly lastSeenAt: Date | null;
  public readonly reviewReason: MaterialReviewReason | null;
  public readonly statusChangedAt: Date | null;
  public readonly statusChangedBy: string | null;
  public readonly statusChangeReason: string | null;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(props: MaterialProps) {
    if (!isMaterialType(props.materialType)) {
      throw new InvalidMaterialTypeError();
    }
    if (!isMaterialStatus(props.status)) {
      throw new InvalidMaterialStatusError();
    }
    const source = props.source ?? 'MANUAL';
    if (!isMaterialSource(source)) {
      throw new InvalidMaterialSourceError();
    }
    const reviewReason = props.reviewReason ?? null;
    if (reviewReason !== null && !isMaterialReviewReason(reviewReason)) {
      throw new InvalidMaterialReviewReasonError();
    }

    this.id = props.id;
    this.catalogCode = props.catalogCode;
    this.title = props.title;
    this.materialType = props.materialType;
    this.author = props.author;
    this.collection = props.collection;
    this.publicationDate = props.publicationDate;
    this.publisher = props.publisher;
    this.status = props.status;
    this.source = source;
    this.digitalPath = props.digitalPath ?? null;
    this.lastSeenAt = props.lastSeenAt ?? null;
    this.reviewReason = reviewReason;
    this.statusChangedAt = props.statusChangedAt ?? null;
    this.statusChangedBy = props.statusChangedBy ?? null;
    this.statusChangeReason = props.statusChangeReason ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /**
   * The sync could not take its code from the folder name (HU-137): the
   * staff should review it.
   */
  get needsReview(): boolean {
    return this.reviewReason !== null;
  }

  /**
   * Returns a copy with the new status and who changed it, when and why (HU-08).
   * Since HU-72, EN_USO is managed exclusively via delivery and return, so it
   * cannot be chosen manually nor overwritten manually while in use.
   */
  changeStatus(
    status: MaterialStatus,
    changedBy: string,
    reason: string | null,
    now: Date = new Date(),
  ): Material {
    if (!isMaterialStatus(status)) {
      throw new InvalidMaterialStatusError();
    }
    if (!isManualMaterialStatus(status)) {
      throw new MaterialStatusNotManualError();
    }
    if (this.status === 'EN_USO') {
      throw new MaterialInUseError();
    }
    return new Material({
      ...this,
      status,
      statusChangedAt: now,
      statusChangedBy: changedBy,
      statusChangeReason: reason,
      updatedAt: now,
    });
  }
}

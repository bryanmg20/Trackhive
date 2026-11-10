import { InvalidMaterialStatusError } from '../errors/invalid-material-status.error';
import { InvalidMaterialTypeError } from '../errors/invalid-material-type.error';
import { isMaterialStatus, MaterialStatus } from '../material-status';
import { isMaterialType, MaterialType } from '../material-type';

// Physical location in the archive. Never shown to the PUBLICO role
export interface MaterialLocation {
  depot: string;
  shelf: string;
  box: string;
}

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
  location: MaterialLocation;
  status: MaterialStatus;
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
  public readonly location: MaterialLocation;
  public readonly status: MaterialStatus;
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

    this.id = props.id;
    this.catalogCode = props.catalogCode;
    this.title = props.title;
    this.materialType = props.materialType;
    this.author = props.author;
    this.collection = props.collection;
    this.publicationDate = props.publicationDate;
    this.publisher = props.publisher;
    this.location = props.location;
    this.status = props.status;
    this.statusChangedAt = props.statusChangedAt ?? null;
    this.statusChangedBy = props.statusChangedBy ?? null;
    this.statusChangeReason = props.statusChangeReason ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /** Returns a copy with the new status and who changed it, when and why (HU-08). */
  changeStatus(
    status: MaterialStatus,
    changedBy: string,
    reason: string | null,
    now: Date = new Date(),
  ): Material {
    if (!isMaterialStatus(status)) {
      throw new InvalidMaterialStatusError();
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

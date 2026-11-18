/** Current reading room capacity configuration (HU-20.1, RN-19). */
export interface RoomCapacityConfig {
  readonly dailyCapacity: number;
  readonly isDefault: boolean;
  readonly updatedAt: Date | null;
  readonly updatedBy: {
    readonly id: string;
    readonly firstName: string;
    readonly middleName: string | null;
    readonly lastName: string;
    readonly secondLastName: string | null;
  } | null;
}

/** Count of capacity-consuming appointments for a YYYY-MM-DD day. */
export interface DayOccupancyCount {
  readonly date: string;
  readonly occupied: number;
}

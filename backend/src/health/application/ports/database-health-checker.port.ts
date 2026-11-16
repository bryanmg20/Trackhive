export interface IDatabaseHealthChecker {
  isAvailable(): Promise<boolean>;
}

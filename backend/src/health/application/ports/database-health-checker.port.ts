export interface DatabaseHealthChecker {
  isAvailable(): Promise<boolean>;
}

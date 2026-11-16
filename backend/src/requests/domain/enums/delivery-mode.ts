export const DELIVERY_MODES = ['PRESENCIAL', 'DIGITAL'] as const;

export type DeliveryMode = (typeof DELIVERY_MODES)[number];

export function isDeliveryMode(value: string): value is DeliveryMode {
  return (DELIVERY_MODES as readonly string[]).includes(value);
}

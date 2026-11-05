/** Detalle de un campo que no pasó la validación de entrada. */
export interface ErrorDetail {
  field: string;
  messages: string[];
}

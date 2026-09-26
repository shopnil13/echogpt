/** Proof that one request unit was consumed; pass it back to QuotaService.refund if the work fails. */
export interface QuotaReservation {
  userId: string;
  periodStart: Date;
  limit: number;
  used: number;
  resetsAt: Date;
}

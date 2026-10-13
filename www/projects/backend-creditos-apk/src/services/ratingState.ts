// Customer DTO/sync fields derived from mobile_customer_rating_state (migration 014). Same rule as the
// web listing: null until the customer has been evaluated, except an active manual rating or a
// pre-014 numeric note without state (previous note = 'manual').
export const RATING_STATE_JOIN = `LEFT JOIN mobile_customer_rating_state rs
  ON rs.idglobal=c.idglobal AND rs.idcliente=c.idcliente`;

export const RATING_STATE_FIELDS = `CASE
    WHEN rs.manual_score IS NOT NULL AND rs.manual_until > UTC_TIMESTAMP(3) THEN 'manual'
    WHEN rs.idcliente IS NULL AND c.str_calificacion IN ('1','2','3','4','5','6','7','8','9','10') THEN 'manual'
    WHEN rs.evaluated_at IS NOT NULL THEN 'automatic' END AS ratingSource,
  IF(rs.evaluated_at IS NULL, NULL, rs.confidence) AS ratingConfidence`;

export const PENDING_EXPLANATION = 'Nota inicial neutral; evaluación matemática pendiente.';
export const PREVIOUS_NOTE_EXPLANATION = 'Nota anterior; evaluación matemática pendiente.';

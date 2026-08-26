import { z } from "zod";

/**
 * The rescue takes the payment row's id, not a Stripe Session id: the Session
 * is re-read from that row inside the action, so a replayed request cannot aim
 * the rescue at an arbitrary Session.
 */
export const adminPaymentIdSchema = z.uuid("Invalid payment id");

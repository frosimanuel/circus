/**
 * Ticket Pricing Utilities
 *
 * Fixed ticket price: 0.01 SOL per ticket
 */

export const TICKET_PRICE_SOL = 0.01;
export const TICKET_PRICE_LAMPORTS = 10_000_000;

/**
 * Convert SOL amount to number of tickets
 */
export function solToTickets(solAmount: number): number {
  return Math.floor(solAmount / TICKET_PRICE_SOL);
}

/**
 * Convert number of tickets to SOL amount
 */
export function ticketsToSol(tickets: number): number {
  return tickets * TICKET_PRICE_SOL;
}

/**
 * Convert lamports to number of tickets
 */
export function lamportsToTickets(lamports: number): number {
  return Math.floor(lamports / TICKET_PRICE_LAMPORTS);
}

/**
 * Convert number of tickets to lamports
 */
export function ticketsToLamports(tickets: number): number {
  return tickets * TICKET_PRICE_LAMPORTS;
}

/**
 * Validate if SOL amount is valid for ticket purchase
 * Must be exact multiple of ticket price
 * Uses lamports (integers) to avoid floating point precision issues
 */
export function isValidTicketAmount(solAmount: number): boolean {
  const LAMPORTS_PER_SOL = 1_000_000_000;
  const lamports = Math.round(solAmount * LAMPORTS_PER_SOL);
  const remainder = lamports % TICKET_PRICE_LAMPORTS;
  return remainder === 0;
}

/**
 * Get closest valid ticket amount (rounds down)
 */
export function getValidTicketAmount(solAmount: number): number {
  const tickets = solToTickets(solAmount);
  return ticketsToSol(tickets);
}

/**
 * Format ticket range for display
 * @param ticketStart First ticket number (0-indexed from contract)
 * @param ticketEnd Last ticket number (0-indexed from contract)
 * @returns Formatted string like "#1" or "#1-#5"
 */
export function formatTicketRange(ticketStart: number, ticketEnd: number): string {
  // Convert from 0-indexed to 1-indexed for display
  const displayStart = ticketStart + 1;
  const displayEnd = ticketEnd + 1;

  if (displayStart === displayEnd) {
    return `#${displayStart}`;
  }
  return `#${displayStart}-#${displayEnd}`;
}

/**
 * Get the number of tickets from a ticket range
 * @param ticketStart First ticket number (0-indexed)
 * @param ticketEnd Last ticket number (0-indexed)
 * @returns Total number of tickets
 */
export function getTicketCount(ticketStart: number, ticketEnd: number): number {
  return ticketEnd - ticketStart + 1;
}

/**
 * Check if user has any tickets
 * @param ticketStart First ticket number
 * @param ticketEnd Last ticket number
 * @returns True if user has tickets
 */
export function hasTickets(ticketStart: number, ticketEnd: number): boolean {
  return ticketStart >= 0 && ticketEnd >= ticketStart;
}

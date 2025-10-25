use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_lang::prelude::{AccountDeserialize, AccountSerialize};

declare_id!("AwJyUsRnuhMmvY5ft3HW5e96kbVcLXai1WGrn8GhLdNi");

// Fixed ticket price: 0.01 SOL = 10,000,000 lamports
pub const TICKET_PRICE_LAMPORTS: u64 = 10_000_000;

// Epoch duration in seconds (for testing: 2 minutes per epoch)
// In production, change to 1 week = 604800 seconds
pub const EPOCH_DURATION_SECONDS: i64 = 120; // 2 minutes for demo

#[program]
pub mod rafa {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, validator: Pubkey) -> Result<()> {
        let protocol_state = &mut ctx.accounts.protocol_state;
        protocol_state.admin = ctx.accounts.admin.key();
        protocol_state.validator = validator;
        protocol_state.current_round = 0;
        protocol_state.prize_seed_amount = 0;
        protocol_state.total_unclaimed_prizes = 0;
        protocol_state.bump = ctx.bumps.protocol_state;
        Ok(())
    }

    pub fn seed_prize(ctx: Context<SeedPrize>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        // Transfer lamports from admin to the protocol_state account (acts as MVP prize vault)
        let transfer_accounts = system_program::Transfer {
            from: ctx.accounts.admin.to_account_info(),
            to: ctx.accounts.protocol_state.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.system_program.to_account_info(), transfer_accounts);
        system_program::transfer(cpi_ctx, amount)?;

        // Track seeded amount in state for accounting
        let protocol_state = &mut ctx.accounts.protocol_state;
        protocol_state.prize_seed_amount = protocol_state
            .prize_seed_amount
            .checked_add(amount)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        Ok(())
    }

    pub fn init_round(ctx: Context<InitRound>, round_id: u64, start_epoch: u64) -> Result<()> {
        let round = &mut ctx.accounts.round_state;
        let protocol = &mut ctx.accounts.protocol_state;
        protocol.current_round = round_id;
        round.round_id = round_id;
        round.epoch_in_round = 1;
        round.start_epoch = start_epoch;
        round.end_epoch = 0;
        round.stake_account = ctx.accounts.stake_account.key();
        round.total_staked_lamports = 0;
        round.total_prize_lamports = 0;
        round.total_tickets_sold = 0;
        round.winner = None;
        round.winning_ticket = 0;
        round.is_complete = false;
        round.prize_claimed = false;
        round.vrf_request = None;
        round.bump = ctx.bumps.round_state;
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        // Enforce fixed ticket price: amount must be exact multiple of TICKET_PRICE_LAMPORTS
        require!(
            amount % TICKET_PRICE_LAMPORTS == 0,
            ErrorCode::InvalidTicketAmount
        );

        // Calculate number of tickets
        let num_tickets = amount / TICKET_PRICE_LAMPORTS;
        require!(num_tickets > 0, ErrorCode::InvalidAmount);

        let protocol = &ctx.accounts.protocol_state;
        let current_round_id = protocol.current_round;
        let protocol_key = protocol.key();

        // Derive round PDA
        let round_id_bytes = current_round_id.to_le_bytes();
        let round_pda_seeds = &[
            b"round" as &[u8],
            protocol_key.as_ref(),
            &round_id_bytes as &[u8],
        ];
        let (round_pda, _) = Pubkey::find_program_address(round_pda_seeds, ctx.program_id);

        // Get round state as AccountInfo (we need mutable access)
        let round_account = ctx.remaining_accounts.get(0)
            .ok_or(ErrorCode::MissingRoundAccount)?;

        // Check if round exists by checking if account is initialized
        let round_exists = round_account.data_len() > 0 && round_account.owner == ctx.program_id;

        if !round_exists {
            // AUTO-START: First buyer starts the round!
            msg!("🎪 First buyer! Auto-starting round #{}", current_round_id);

            // We cannot create the round account here since we're in remaining_accounts
            // The round must be created via init_round first OR we need to change account structure
            // For now, require round to be initialized (keep init_round for admin setup)
            return Err(ErrorCode::MissingRoundAccount.into());
        }

        require!(round_account.key() == round_pda, ErrorCode::InvalidRoundAccount);

        // Deserialize round state
        let mut round_data = round_account.try_borrow_mut_data()?;
        let mut round_slice: &[u8] = &round_data;
        let mut round_state = RoundState::try_deserialize(&mut round_slice)?;

        // AUTO-ADVANCE EPOCHS & AUTO-FINALIZE based on time
        let clock = Clock::get()?;
        let current_time_ms = clock.unix_timestamp as u64 * 1000;

        if !round_state.is_complete {
            let elapsed_ms = current_time_ms.saturating_sub(round_state.start_epoch);
            let epochs_passed = elapsed_ms / (EPOCH_DURATION_SECONDS as u64 * 1000);
            let target_epoch = std::cmp::min(epochs_passed as u8 + 1, 3);

            // Auto-advance epoch
            if target_epoch > round_state.epoch_in_round {
                msg!("⏰ Auto-advancing epoch {} → {}", round_state.epoch_in_round, target_epoch);
                round_state.epoch_in_round = target_epoch;
            }

            // Check if round should be finalized (epoch 3 ended)
            if round_state.epoch_in_round >= 3 {
                let epoch_3_end_ms = round_state.start_epoch + (3 * EPOCH_DURATION_SECONDS as u64 * 1000);

                if current_time_ms >= epoch_3_end_ms && round_state.total_tickets_sold > 0 {
                    // AUTO-FINALIZE: Select winner!
                    msg!("🎰 Auto-finalizing round #{}", current_round_id);

                    // Generate pseudo-random seed from clock
                    let seed = (clock.slot as u64)
                        .wrapping_mul(clock.unix_timestamp as u64)
                        .wrapping_add(clock.epoch);

                    let winning_ticket_number = seed % round_state.total_tickets_sold;

                    // Find winner from remaining_accounts (skip first which is round_state)
                    let mut winner_pubkey: Option<Pubkey> = None;
                    for user_ai in ctx.remaining_accounts.iter().skip(1) {
                        if user_ai.data_len() > 0 {
                            let user_data = user_ai.try_borrow_data()?;
                            let mut user_slice: &[u8] = &user_data;
                            if let Ok(user) = UserAccount::try_deserialize(&mut user_slice) {
                                if user.round_joined == current_round_id &&
                                   winning_ticket_number >= user.ticket_start &&
                                   winning_ticket_number <= user.ticket_end {
                                    winner_pubkey = Some(user.owner);
                                    msg!("🎉 Winner found: {} (ticket #{})", user.owner, winning_ticket_number);
                                    break;
                                }
                            }
                        }
                    }

                    if let Some(winner) = winner_pubkey {
                        // Calculate prize (use seed amount as prize for now)
                        let prize_amount = protocol.prize_seed_amount;

                        round_state.winner = Some(winner);
                        round_state.winning_ticket = winning_ticket_number;
                        round_state.total_prize_lamports = prize_amount;
                        round_state.end_epoch = current_time_ms;
                        round_state.is_complete = true;

                        // Note: ClaimTicket creation will be done in a separate instruction
                        // for now to keep this simpler
                        msg!("Round #{} complete! Winner: {}, Prize: {} lamports",
                             current_round_id, winner, prize_amount);
                    }
                }
            }
        }

        // If round is complete, block deposits
        if round_state.is_complete {
            msg!("❌ Round #{} is complete! Deposits blocked. Next round: #{}",
                 current_round_id, current_round_id + 1);

            // Serialize current round state before returning error
            let mut round_out: Vec<u8> = Vec::with_capacity(round_data.len());
            round_state.try_serialize(&mut round_out)?;
            let copy_len = core::cmp::min(round_out.len(), round_data.len());
            round_data[..copy_len].copy_from_slice(&round_out[..copy_len]);

            return Err(ErrorCode::RoundComplete.into());
        }

        // Block deposits if in epoch 3
        require!(round_state.epoch_in_round < 3, ErrorCode::DepositsClosedEpoch3);

        // Transfer lamports from user to protocol state (escrow)
        let transfer_accounts = system_program::Transfer {
            from: ctx.accounts.user.to_account_info(),
            to: ctx.accounts.protocol_state.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.system_program.to_account_info(), transfer_accounts);
        system_program::transfer(cpi_ctx, amount)?;

        // Assign ticket numbers: starting from current total
        let ticket_start = round_state.total_tickets_sold;
        let ticket_end = ticket_start + num_tickets - 1;

        // Update round total tickets and staked amount
        round_state.total_tickets_sold = round_state.total_tickets_sold
            .checked_add(num_tickets)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        round_state.total_staked_lamports = round_state.total_staked_lamports
            .checked_add(amount)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        // Serialize round state back
        let mut round_out: Vec<u8> = Vec::with_capacity(round_data.len());
        round_state.try_serialize(&mut round_out)?;
        let copy_len = core::cmp::min(round_out.len(), round_data.len());
        round_data[..copy_len].copy_from_slice(&round_out[..copy_len]);
        drop(round_data);

        // Update user account
        let user_acct = &mut ctx.accounts.user_account;
        user_acct.owner = ctx.accounts.user.key();

        // If user is joining a new round, reset their state
        if user_acct.round_joined != current_round_id && user_acct.round_joined != 0 {
            // Reset for new round
            user_acct.balance = 0;
            user_acct.ticket_start = 0;
            user_acct.ticket_end = 0;
            user_acct.snapshot_balances = [0; 3];
            user_acct.snapshots_recorded_mask = 0;
            user_acct.pending_withdrawal_amount = 0;
            user_acct.pending_withdrawal_round = 0;
        }

        // Update balance and tickets
        if user_acct.balance == 0 {
            // First deposit in this round
            user_acct.ticket_start = ticket_start;
            user_acct.ticket_end = ticket_end;
        } else {
            // Additional deposit - extend ticket range
            user_acct.ticket_end = ticket_end;
        }

        user_acct.balance = user_acct
            .balance
            .checked_add(amount)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        user_acct.bump = ctx.bumps.user_account;

        // Set round_joined if first time or new round
        if user_acct.round_joined == 0 || user_acct.round_joined != current_round_id {
            user_acct.round_joined = current_round_id;
        }

        msg!("✅ Deposited {} tickets ({} lamports). Tickets: #{}-#{}",
             num_tickets, amount, ticket_start, ticket_end);
        Ok(())
    }

    pub fn request_withdrawal(ctx: Context<RequestWithdrawal>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        let user_acct = &mut ctx.accounts.user_account;
        require!(user_acct.balance >= amount, ErrorCode::InvalidAmount);
        // Forfeit tickets for current round by zeroing mask for this round's remaining epochs
        user_acct.snapshots_recorded_mask = 0; // MVP simplification
        user_acct.balance = user_acct
            .balance
            .checked_sub(amount)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        user_acct.pending_withdrawal_amount = user_acct
            .pending_withdrawal_amount
            .checked_add(amount)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        user_acct.pending_withdrawal_round = ctx.accounts.protocol_state.current_round;
        Ok(())
    }

    pub fn take_snapshot_batch(ctx: Context<TakeSnapshotBatch>) -> Result<()> {
        let round = &ctx.accounts.round_state;
        let epoch_index: usize = match round.epoch_in_round {
            1 => 0,
            2 => 1,
            3 => 2,
            _ => return Err(ErrorCode::InvalidEpoch.into()),
        };

        for ai in ctx.remaining_accounts.iter() {
            // Deserialize from account data
            let mut data = ai.try_borrow_mut_data()?;
            let mut input_slice: &[u8] = &data;
            let mut user: UserAccount = match UserAccount::try_deserialize(&mut input_slice) {
                Ok(u) => u,
                Err(_) => continue, // skip non-UserAccount accounts
            };

            let mask_bit: u8 = 1u8 << epoch_index;
            if (user.snapshots_recorded_mask & mask_bit) == 0 {
                user.snapshot_balances[epoch_index] = user.balance;
                user.snapshots_recorded_mask |= mask_bit;

                let mut out: Vec<u8> = Vec::with_capacity(data.len());
                user.try_serialize(&mut out)?;
                let copy_len = core::cmp::min(out.len(), data.len());
                data[..copy_len].copy_from_slice(&out[..copy_len]);
            }
        }

        Ok(())
    }

    pub fn advance_epoch(ctx: Context<AdvanceEpoch>) -> Result<()> {
        let round = &mut ctx.accounts.round_state;
        require!(round.epoch_in_round < 3, ErrorCode::InvalidEpoch);
        round.epoch_in_round = round.epoch_in_round.saturating_add(1);
        Ok(())
    }

    pub fn select_winner_local(ctx: Context<SelectWinnerLocal>, seed: u64) -> Result<()> {
        let round = &mut ctx.accounts.round_state;

        // Require at least 1 ticket sold
        require!(round.total_tickets_sold > 0, ErrorCode::InvalidAmount);

        // Calculate winning ticket number: random number from 0 to total_tickets_sold-1
        let winning_ticket_number = seed % round.total_tickets_sold;

        // Find which user owns this ticket
        let mut winner: Option<Pubkey> = None;
        for ai in ctx.remaining_accounts.iter() {
            let data = ai.try_borrow_data()?;
            let mut input_slice: &[u8] = &data;
            let user: UserAccount = match UserAccount::try_deserialize(&mut input_slice) {
                Ok(u) => u,
                Err(_) => continue,
            };

            // Check if winning ticket is in this user's range
            if winning_ticket_number >= user.ticket_start && winning_ticket_number <= user.ticket_end {
                winner = Some(user.owner);
                msg!("Winner found: {} owns ticket #{}", user.owner, winning_ticket_number);
                break;
            }
        }

        let chosen = winner.ok_or(ErrorCode::InvalidAmount)?;
        msg!("select_winner_local: total_tickets={} winning_ticket={} winner={}",
             round.total_tickets_sold, winning_ticket_number, chosen);

        round.winner = Some(chosen);
        round.winning_ticket = winning_ticket_number;
        round.is_complete = true;
        Ok(())
    }

    /// Winner claims their prize (stake + prize pool) for ANY completed round
    /// Can be called anytime after round completes - doesn't block new rounds
    pub fn claim_prize(ctx: Context<ClaimPrize>, round_id: u64) -> Result<()> {
        let claim_ticket = &mut ctx.accounts.claim_ticket;
        let round = &ctx.accounts.round_state;
        let user_acct = &mut ctx.accounts.user_account;

        // Ensure round is complete
        require!(round.is_complete, ErrorCode::RoundNotComplete);

        // Calculate total payout from claim ticket
        let total_payout = claim_ticket.stake_amount
            .checked_add(claim_ticket.prize_amount)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        msg!("🎉 Claiming Round #{}: stake={} prize={} total={}",
             round_id, claim_ticket.stake_amount, claim_ticket.prize_amount, total_payout);

        // Calculate rent exemption minimum
        let min_rent = Rent::get()?.minimum_balance(8 + ProtocolState::SIZE);

        // Transfer funds from protocol to winner
        let protocol_lamports = ctx.accounts.protocol_state.to_account_info().lamports();
        let available_lamports = protocol_lamports.checked_sub(min_rent).unwrap_or(0);

        require!(available_lamports >= total_payout, ErrorCode::InsufficientFunds);

        **ctx.accounts.protocol_state.to_account_info().try_borrow_mut_lamports()? -= total_payout;
        **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? += total_payout;

        // Mark claim ticket as claimed
        claim_ticket.claimed = true;

        // Update protocol state
        let protocol = &mut ctx.accounts.protocol_state;
        protocol.total_unclaimed_prizes = protocol.total_unclaimed_prizes
            .saturating_sub(claim_ticket.prize_amount);

        // Mark prize as claimed in round state
        let round = &mut ctx.accounts.round_state;
        round.prize_claimed = true;

        // Reset user account if they were part of this round
        if user_acct.round_joined == round_id {
            user_acct.balance = 0;
            user_acct.ticket_start = 0;
            user_acct.ticket_end = 0;
        }

        msg!("✅ Prize claimed for Round #{}!", round_id);
        Ok(())
    }

    /// Process withdrawal for non-winners after round completes
    /// Losers can withdraw their stake from any completed round
    pub fn process_withdrawal(ctx: Context<ProcessWithdrawal>, round_id: u64) -> Result<()> {
        let round = &ctx.accounts.round_state;
        let user_acct = &mut ctx.accounts.user_account;

        // Ensure user is NOT the winner
        if let Some(winner) = round.winner {
            require!(winner != user_acct.owner, ErrorCode::WinnerMustClaim);
        }

        // Get withdrawal amount (pending + balance)
        let withdrawal_amount = user_acct.pending_withdrawal_amount
            .checked_add(user_acct.balance)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        require!(withdrawal_amount > 0, ErrorCode::NothingToWithdraw);

        msg!("💸 Withdrawing from Round #{}: user={} amount={}",
             round_id, user_acct.owner, withdrawal_amount);

        // Calculate rent exemption minimum
        let min_rent = Rent::get()?.minimum_balance(8 + ProtocolState::SIZE);

        // Transfer funds from protocol to user
        let protocol_lamports = ctx.accounts.protocol_state.to_account_info().lamports();
        let available_lamports = protocol_lamports.checked_sub(min_rent).unwrap_or(0);

        require!(available_lamports >= withdrawal_amount, ErrorCode::InsufficientFunds);

        **ctx.accounts.protocol_state.to_account_info().try_borrow_mut_lamports()? -= withdrawal_amount;
        **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? += withdrawal_amount;

        // Reset user account
        user_acct.balance = 0;
        user_acct.pending_withdrawal_amount = 0;
        user_acct.ticket_start = 0;
        user_acct.ticket_end = 0;

        msg!("✅ Withdrawal processed for Round #{}!", round_id);
        Ok(())
    }

    /// Create a ClaimTicket PDA for a round's winner
    /// Called by admin after round completes, or automatically during deposit finalization
    pub fn create_claim_ticket(
        ctx: Context<CreateClaimTicket>,
        round_id: u64,
        prize_amount: u64,
        stake_amount: u64,
    ) -> Result<()> {
        let round = &ctx.accounts.round_state;
        let claim_ticket = &mut ctx.accounts.claim_ticket;

        // Ensure round is complete and has a winner
        require!(round.is_complete, ErrorCode::RoundNotComplete);
        require!(round.winner.is_some(), ErrorCode::NoTicketsSold);

        let winner = round.winner.unwrap();

        // Initialize claim ticket
        claim_ticket.round_id = round_id;
        claim_ticket.winner = winner;
        claim_ticket.prize_amount = prize_amount;
        claim_ticket.stake_amount = stake_amount;
        claim_ticket.claimed = false;
        claim_ticket.bump = ctx.bumps.claim_ticket;

        // Update protocol state to track unclaimed prize
        let protocol = &mut ctx.accounts.protocol_state;
        protocol.total_unclaimed_prizes = protocol.total_unclaimed_prizes
            .checked_add(prize_amount)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        msg!("🎫 ClaimTicket created for Round #{}: winner={} prize={} stake={}",
             round_id, winner, prize_amount, stake_amount);

        Ok(())
    }

    /// Winner creates their own ClaimTicket (permissionless)
    /// Called by the winner after round completes
    pub fn create_claim_ticket_winner(
        ctx: Context<CreateClaimTicketWinner>,
        round_id: u64,
    ) -> Result<()> {
        let round = &ctx.accounts.round_state;
        let claim_ticket = &mut ctx.accounts.claim_ticket;
        let user_acct = &ctx.accounts.user_account;
        let winner = &ctx.accounts.winner;

        // Ensure round is complete and has a winner
        require!(round.is_complete, ErrorCode::RoundNotComplete);
        require!(round.winner.is_some(), ErrorCode::NoTicketsSold);

        // Ensure caller is the winner
        require!(round.winner.unwrap() == winner.key(), ErrorCode::NotWinner);

        // Calculate prize amount (total staked minus winner's stake)
        let prize_amount = round.total_staked_lamports
            .checked_sub(user_acct.balance)
            .unwrap_or(0);

        // Initialize claim ticket
        claim_ticket.round_id = round_id;
        claim_ticket.winner = winner.key();
        claim_ticket.prize_amount = prize_amount;
        claim_ticket.stake_amount = user_acct.balance;
        claim_ticket.claimed = false;
        claim_ticket.bump = ctx.bumps.claim_ticket;

        // Update protocol state to track unclaimed prize
        let protocol = &mut ctx.accounts.protocol_state;
        protocol.total_unclaimed_prizes = protocol.total_unclaimed_prizes
            .checked_add(prize_amount)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        msg!("🎫 ClaimTicket created by winner for Round #{}: prize={} stake={}",
             round_id, prize_amount, user_acct.balance);

        Ok(())
    }

    /// Crank: Advance epoch and finalize round based on time (callable by anyone)
    /// This instruction allows anyone to trigger epoch advancement and round finalization
    /// without needing to make a deposit. This prevents the round from getting "stuck"
    /// when no deposits are made for extended periods.
    pub fn crank(ctx: Context<Crank>) -> Result<()> {
        let protocol = &ctx.accounts.protocol_state;
        let round = &mut ctx.accounts.round_state;

        // Only process if round is not complete
        if round.is_complete {
            msg!("Round already complete, no action needed");
            return Ok(());
        }

        let clock = Clock::get()?;
        let current_time_ms = clock.unix_timestamp as u64 * 1000;

        let elapsed_ms = current_time_ms.saturating_sub(round.start_epoch);
        let epochs_passed = elapsed_ms / (EPOCH_DURATION_SECONDS as u64 * 1000);
        let target_epoch = std::cmp::min(epochs_passed as u8 + 1, 3);

        // Auto-advance epoch
        if target_epoch > round.epoch_in_round {
            msg!("⏰ Crank: Auto-advancing epoch {} → {}", round.epoch_in_round, target_epoch);
            round.epoch_in_round = target_epoch;
        }

        // Check if round should be finalized (epoch 3 ended)
        if round.epoch_in_round >= 3 {
            let epoch_3_end_ms = round.start_epoch + (3 * EPOCH_DURATION_SECONDS as u64 * 1000);

            if current_time_ms >= epoch_3_end_ms && round.total_tickets_sold > 0 {
                // AUTO-FINALIZE: Select winner!
                msg!("🎰 Crank: Auto-finalizing round #{}", round.round_id);

                // Generate pseudo-random seed from clock
                let seed = (clock.slot as u64)
                    .wrapping_mul(clock.unix_timestamp as u64)
                    .wrapping_add(clock.epoch);

                let winning_ticket_number = seed % round.total_tickets_sold;

                // Find winner from remaining_accounts
                let mut winner_pubkey: Option<Pubkey> = None;
                for user_ai in ctx.remaining_accounts.iter() {
                    if user_ai.data_len() > 0 {
                        let user_data = user_ai.try_borrow_data()?;
                        let mut user_slice: &[u8] = &user_data;
                        if let Ok(user) = UserAccount::try_deserialize(&mut user_slice) {
                            if user.round_joined == round.round_id &&
                               winning_ticket_number >= user.ticket_start &&
                               winning_ticket_number <= user.ticket_end {
                                winner_pubkey = Some(user.owner);
                                msg!("🎉 Winner found: {} (ticket #{})", user.owner, winning_ticket_number);
                                break;
                            }
                        }
                    }
                }

                if let Some(winner) = winner_pubkey {
                    // Calculate prize
                    let prize_amount = protocol.prize_seed_amount;

                    round.winner = Some(winner);
                    round.winning_ticket = winning_ticket_number;
                    round.total_prize_lamports = prize_amount;
                    round.end_epoch = current_time_ms;
                    round.is_complete = true;

                    msg!("Round #{} complete! Winner: {}, Prize: {} lamports",
                         round.round_id, winner, prize_amount);
                }
            }
        }

        msg!("✅ Crank complete: Epoch {}, Complete: {}", round.epoch_in_round, round.is_complete);
        Ok(())
    }

    /// Close the ProtocolState account and recover rent (admin only)
    /// DANGER: This will reset the entire protocol! Only use for testing/reinitialization.
    pub fn close_protocol_state(ctx: Context<CloseProtocolState>) -> Result<()> {
        let protocol = &ctx.accounts.protocol_state;

        msg!("⚠️  CLOSING ProtocolState account!");
        msg!("Admin: {}", protocol.admin);
        msg!("Current round: {}", protocol.current_round);
        msg!("Unclaimed prizes: {} lamports", protocol.total_unclaimed_prizes);

        // Safety check: require no unclaimed prizes
        require!(
            protocol.total_unclaimed_prizes == 0,
            ErrorCode::UnclaimedPrizesExist
        );

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        seeds = [b"state"],
        bump,
        space = 8 + ProtocolState::SIZE,
    )]
    pub protocol_state: Account<'info, ProtocolState>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SeedPrize<'info> {
    #[account(mut, address = protocol_state.admin)]
    pub admin: Signer<'info>,
    #[account(mut, seeds = [b"state"], bump = protocol_state.bump)]
    pub protocol_state: Account<'info, ProtocolState>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(round_id: u64)]
pub struct InitRound<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [b"state"], bump = protocol_state.bump)]
    pub protocol_state: Account<'info, ProtocolState>,
    /// CHECK: stake account created off-program for now; authority held by PDA in future edits
    pub stake_account: UncheckedAccount<'info>,
    #[account(
        init,
        payer = payer,
        // Derive PDA off protocol_state and round_id
        seeds = [b"round", protocol_state.key().as_ref(), &round_id.to_le_bytes()],
        bump,
        space = 8 + RoundState::SIZE,
    )]
    pub round_state: Account<'info, RoundState>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, seeds = [b"state"], bump = protocol_state.bump)]
    pub protocol_state: Account<'info, ProtocolState>,
    #[account(
        init_if_needed,
        payer = user,
        seeds = [b"user", user.key().as_ref()],
        bump,
        space = 8 + UserAccount::SIZE,
    )]
    pub user_account: Account<'info, UserAccount>,
    pub system_program: Program<'info, System>,
    // remaining_accounts[0] should be RoundState PDA (mutable)
}

#[derive(Accounts)]
pub struct RequestWithdrawal<'info> {
    pub user: Signer<'info>,
    #[account(seeds = [b"state"], bump = protocol_state.bump)]
    pub protocol_state: Account<'info, ProtocolState>,
    #[account(mut, seeds = [b"user", user.key().as_ref()], bump, constraint = user_account.owner == user.key())]
    pub user_account: Account<'info, UserAccount>,
}

#[derive(Accounts)]
pub struct TakeSnapshotBatch<'info> {
    #[account(seeds = [b"state"], bump = protocol_state.bump)]
    pub protocol_state: Account<'info, ProtocolState>,
    #[account(
        seeds = [b"round", protocol_state.key().as_ref(), &round_state.round_id.to_le_bytes()],
        bump = round_state.bump
    )]
    pub round_state: Account<'info, RoundState>,
    // remaining_accounts: Vec<UserAccount> expected
}

#[derive(Accounts)]
pub struct AdvanceEpoch<'info> {
    #[account(address = protocol_state.admin)]
    pub admin: Signer<'info>,
    #[account(seeds = [b"state"], bump = protocol_state.bump)]
    pub protocol_state: Account<'info, ProtocolState>,
    #[account(
        mut,
        seeds = [b"round", protocol_state.key().as_ref(), &round_state.round_id.to_le_bytes()],
        bump = round_state.bump
    )]
    pub round_state: Account<'info, RoundState>,
}

#[derive(Accounts)]
pub struct SelectWinnerLocal<'info> {
    #[account(address = protocol_state.admin)]
    pub admin: Signer<'info>,
    #[account(seeds = [b"state"], bump = protocol_state.bump)]
    pub protocol_state: Account<'info, ProtocolState>,
    #[account(
        mut,
        seeds = [b"round", protocol_state.key().as_ref(), &round_state.round_id.to_le_bytes()],
        bump = round_state.bump
    )]
    pub round_state: Account<'info, RoundState>,
}

#[derive(Accounts)]
#[instruction(round_id: u64)]
pub struct ClaimPrize<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, seeds = [b"state"], bump = protocol_state.bump)]
    pub protocol_state: Account<'info, ProtocolState>,
    #[account(
        mut,
        seeds = [b"round", protocol_state.key().as_ref(), &round_id.to_le_bytes()],
        bump = round_state.bump
    )]
    pub round_state: Account<'info, RoundState>,
    #[account(
        mut,
        seeds = [b"claim", round_id.to_le_bytes().as_ref(), user.key().as_ref()],
        bump,
        constraint = !claim_ticket.claimed @ ErrorCode::AlreadyClaimed,
        constraint = claim_ticket.winner == user.key() @ ErrorCode::NotWinner,
        constraint = claim_ticket.round_id == round_id @ ErrorCode::InvalidRound,
    )]
    pub claim_ticket: Account<'info, ClaimTicket>,
    #[account(
        mut,
        seeds = [b"user", user.key().as_ref()],
        bump = user_account.bump,
        constraint = user_account.owner == user.key()
    )]
    pub user_account: Account<'info, UserAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(round_id: u64)]
pub struct ProcessWithdrawal<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, seeds = [b"state"], bump = protocol_state.bump)]
    pub protocol_state: Account<'info, ProtocolState>,
    #[account(
        seeds = [b"round", protocol_state.key().as_ref(), &round_id.to_le_bytes()],
        bump = round_state.bump,
        constraint = round_state.is_complete @ ErrorCode::RoundNotComplete,
    )]
    pub round_state: Account<'info, RoundState>,
    #[account(
        mut,
        seeds = [b"user", user.key().as_ref()],
        bump = user_account.bump,
        constraint = user_account.owner == user.key(),
        constraint = user_account.round_joined == round_id @ ErrorCode::WrongRound,
    )]
    pub user_account: Account<'info, UserAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(round_id: u64, prize_amount: u64, stake_amount: u64)]
pub struct CreateClaimTicket<'info> {
    #[account(mut, address = protocol_state.admin)]
    pub admin: Signer<'info>,
    #[account(mut, seeds = [b"state"], bump = protocol_state.bump)]
    pub protocol_state: Account<'info, ProtocolState>,
    #[account(
        seeds = [b"round", protocol_state.key().as_ref(), &round_id.to_le_bytes()],
        bump = round_state.bump,
        constraint = round_state.is_complete @ ErrorCode::RoundNotComplete,
        constraint = round_state.winner.is_some() @ ErrorCode::NoTicketsSold,
    )]
    pub round_state: Account<'info, RoundState>,
    #[account(
        init,
        payer = admin,
        seeds = [b"claim", round_id.to_le_bytes().as_ref(), round_state.winner.unwrap().as_ref()],
        bump,
        space = 8 + ClaimTicket::SIZE,
    )]
    pub claim_ticket: Account<'info, ClaimTicket>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(round_id: u64)]
pub struct CreateClaimTicketWinner<'info> {
    #[account(mut)]
    pub winner: Signer<'info>,
    #[account(mut, seeds = [b"state"], bump = protocol_state.bump)]
    pub protocol_state: Account<'info, ProtocolState>,
    #[account(
        seeds = [b"round", protocol_state.key().as_ref(), &round_id.to_le_bytes()],
        bump = round_state.bump,
        constraint = round_state.is_complete @ ErrorCode::RoundNotComplete,
        constraint = round_state.winner.is_some() @ ErrorCode::NoTicketsSold,
        constraint = round_state.winner.unwrap() == winner.key() @ ErrorCode::NotWinner,
    )]
    pub round_state: Account<'info, RoundState>,
    #[account(
        seeds = [b"user", winner.key().as_ref()],
        bump = user_account.bump,
        constraint = user_account.owner == winner.key(),
    )]
    pub user_account: Account<'info, UserAccount>,
    #[account(
        init,
        payer = winner,
        seeds = [b"claim", round_id.to_le_bytes().as_ref(), winner.key().as_ref()],
        bump,
        space = 8 + ClaimTicket::SIZE,
    )]
    pub claim_ticket: Account<'info, ClaimTicket>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Crank<'info> {
    #[account(seeds = [b"state"], bump = protocol_state.bump)]
    pub protocol_state: Account<'info, ProtocolState>,
    #[account(
        mut,
        seeds = [b"round", protocol_state.key().as_ref(), &round_state.round_id.to_le_bytes()],
        bump = round_state.bump
    )]
    pub round_state: Account<'info, RoundState>,
    // remaining_accounts: Vec<UserAccount> for winner selection
}

#[derive(Accounts)]
pub struct CloseProtocolState<'info> {
    #[account(
        mut,
        address = protocol_state.admin,
    )]
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [b"state"],
        bump = protocol_state.bump,
        close = admin,
    )]
    pub protocol_state: Account<'info, ProtocolState>,
}

#[account]
pub struct ProtocolState {
    pub admin: Pubkey,
    pub validator: Pubkey,
    pub current_round: u64,
    pub prize_seed_amount: u64,  // Initial seed for prize pool (kept for backwards compat)
    pub total_unclaimed_prizes: u64,  // Track all pending prize claims
    pub bump: u8,
}

impl ProtocolState {
    // admin (32) + validator (32) + current_round (8) + prize_seed_amount (8) + total_unclaimed_prizes (8) + bump (1)
    pub const SIZE: usize = 32 + 32 + 8 + 8 + 8 + 1;
}

#[account]
pub struct RoundState {
    pub round_id: u64,
    pub epoch_in_round: u8,
    pub start_epoch: u64,  // When round started (milliseconds)
    pub end_epoch: u64,    // When round completed (milliseconds)
    pub stake_account: Pubkey,
    pub total_staked_lamports: u64,  // Total deposited this round
    pub total_prize_lamports: u64,   // Prize allocated for this round (interest)
    pub total_tickets_sold: u64,     // Track total tickets for sequential numbering
    pub winner: Option<Pubkey>,
    pub winning_ticket: u64,         // The winning ticket number
    pub is_complete: bool,            // Round finished (winner selected)
    pub prize_claimed: bool,          // Winner claimed their prize
    pub vrf_request: Option<Pubkey>,
    pub bump: u8,
}

impl RoundState {
    // round_id (8) + epoch_in_round (1) + start_epoch (8) + end_epoch (8) + stake_account (32)
    // + total_staked_lamports (8) + total_prize_lamports (8) + total_tickets_sold (8)
    // + winner (1 + 32) + winning_ticket (8) + is_complete (1) + prize_claimed (1) + vrf_request (1 + 32) + bump (1)
    pub const SIZE: usize = 8 + 1 + 8 + 8 + 32 + 8 + 8 + 8 + (1 + 32) + 8 + 1 + 1 + (1 + 32) + 1;
}

#[account]
pub struct UserAccount {
    pub owner: Pubkey,
    pub balance: u64,
    pub ticket_start: u64,  // First ticket number owned
    pub ticket_end: u64,    // Last ticket number owned
    pub snapshot_balances: [u64; 3],
    pub snapshots_recorded_mask: u8,
    pub round_joined: u64,
    pub pending_withdrawal_amount: u64,
    pub pending_withdrawal_round: u64,
    pub bump: u8,
}

impl UserAccount {
    // owner (32) + balance (8) + ticket_start (8) + ticket_end (8) + snapshot_balances (3*8) + mask (1)
    // + round_joined (8) + pending_withdrawal_amount (8) + pending_withdrawal_round (8) + bump (1)
    pub const SIZE: usize = 32 + 8 + 8 + 8 + (3 * 8) + 1 + 8 + 8 + 8 + 1;
}

/// ClaimTicket: Represents a winner's right to claim prize from a completed round
/// PDA seeds: [b"claim", round_id.to_le_bytes(), winner.as_ref()]
#[account]
pub struct ClaimTicket {
    pub round_id: u64,
    pub winner: Pubkey,
    pub prize_amount: u64,      // Interest/prize to claim
    pub stake_amount: u64,       // Original stake to return
    pub claimed: bool,
    pub bump: u8,
}

impl ClaimTicket {
    // round_id (8) + winner (32) + prize_amount (8) + stake_amount (8) + claimed (1) + bump (1)
    pub const SIZE: usize = 8 + 32 + 8 + 8 + 1 + 1;
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Missing PDA bump")]
    MissingBump,
    #[msg("Invalid epoch state")]
    InvalidEpoch,
    #[msg("Amount must be exact multiple of ticket price (0.01 SOL = 10,000,000 lamports)")]
    InvalidTicketAmount,
    #[msg("Round account must be provided in remaining_accounts")]
    MissingRoundAccount,
    #[msg("Invalid round account provided")]
    InvalidRoundAccount,
    #[msg("Insufficient funds in protocol account")]
    InsufficientFunds,
    #[msg("Deposits closed: Epoch 3 has started, waiting for round to complete")]
    DepositsClosedEpoch3,
    #[msg("No tickets sold in this round")]
    NoTicketsSold,
    #[msg("Prize already claimed")]
    AlreadyClaimed,
    #[msg("Not the winner of this round")]
    NotWinner,
    #[msg("Invalid round ID")]
    InvalidRound,
    #[msg("Round not complete yet")]
    RoundNotComplete,
    #[msg("User did not participate in this round")]
    WrongRound,
    #[msg("Winner must use claim_prize, not process_withdrawal")]
    WinnerMustClaim,
    #[msg("Nothing to withdraw")]
    NothingToWithdraw,
    #[msg("Round is complete, deposits blocked. Please wait for next round.")]
    RoundComplete,
    #[msg("Cannot close protocol: unclaimed prizes exist")]
    UnclaimedPrizesExist,
}

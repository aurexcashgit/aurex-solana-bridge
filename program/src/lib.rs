use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;
use spl_token::state::Mint;

declare_id!("AuRex11111111111111111111111111111111111111");

#[program]
pub mod aurex_solana_bridge {
    use super::*;

    /// Initialize the Aurex bridge program
    pub fn initialize(ctx: Context<Initialize>, authority: Pubkey) -> Result<()> {
        let bridge_state = &mut ctx.accounts.bridge_state;
        bridge_state.authority = authority;
        bridge_state.total_cards = 0;
        bridge_state.bump = *ctx.bumps.get("bridge_state").unwrap();
        
        msg!("Aurex Solana Bridge initialized with authority: {}", authority);
        Ok(())
    }

    /// Create a new virtual card
    pub fn create_card(
        ctx: Context<CreateCard>,
        card_id: String,
        balance_limit: u64,
        metadata: String,
    ) -> Result<()> {
        require!(card_id.len() <= 32, AurexError::CardIdTooLong);
        require!(metadata.len() <= 256, AurexError::MetadataTooLong);

        let card = &mut ctx.accounts.card;
        let bridge_state = &mut ctx.accounts.bridge_state;
        
        card.id = card_id;
        card.owner = ctx.accounts.owner.key();
        card.balance = 0;
        card.balance_limit = balance_limit;
        card.is_active = true;
        card.metadata = metadata;
        card.created_at = Clock::get()?.unix_timestamp;
        card.bump = *ctx.bumps.get("card").unwrap();
        
        bridge_state.total_cards += 1;
        
        emit!(CardCreated {
            card_pubkey: card.key(),
            owner: card.owner,
            card_id: card.id.clone(),
            balance_limit: card.balance_limit,
        });
        
        Ok(())
    }

    /// Top up a virtual card
    pub fn top_up_card(ctx: Context<TopUpCard>, amount: u64) -> Result<()> {
        let card = &mut ctx.accounts.card;
        
        require!(card.is_active, AurexError::CardInactive);
        require!(card.balance + amount <= card.balance_limit, AurexError::BalanceLimitExceeded);
        
        // Transfer tokens to the card's escrow account
        let transfer_instruction = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.card_escrow_account.to_account_info(),
            authority: ctx.accounts.owner.to_account_info(),
        };
        
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                transfer_instruction,
            ),
            amount,
        )?;
        
        card.balance += amount;
        
        emit!(CardToppedUp {
            card_pubkey: card.key(),
            amount,
            new_balance: card.balance,
        });
        
        Ok(())
    }

    /// Process a payment from a virtual card
    pub fn process_payment(
        ctx: Context<ProcessPayment>,
        amount: u64,
        merchant_reference: String,
    ) -> Result<()> {
        let card = &mut ctx.accounts.card;
        
        require!(card.is_active, AurexError::CardInactive);
        require!(card.balance >= amount, AurexError::InsufficientBalance);
        require!(merchant_reference.len() <= 64, AurexError::MerchantReferenceTooLong);
        
        // Transfer tokens from card escrow to merchant
        let seeds = &[
            b"card".as_ref(),
            card.owner.as_ref(),
            card.id.as_bytes(),
            &[card.bump],
        ];
        let signer = &[&seeds[..]];
        
        let transfer_instruction = Transfer {
            from: ctx.accounts.card_escrow_account.to_account_info(),
            to: ctx.accounts.merchant_token_account.to_account_info(),
            authority: card.to_account_info(),
        };
        
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                transfer_instruction,
                signer,
            ),
            amount,
        )?;
        
        card.balance -= amount;
        
        emit!(PaymentProcessed {
            card_pubkey: card.key(),
            merchant: ctx.accounts.merchant.key(),
            amount,
            merchant_reference,
            remaining_balance: card.balance,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }

    /// Deactivate a virtual card
    pub fn deactivate_card(ctx: Context<DeactivateCard>) -> Result<()> {
        let card = &mut ctx.accounts.card;
        card.is_active = false;
        
        emit!(CardDeactivated {
            card_pubkey: card.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }

    /// Withdraw remaining balance from a deactivated card
    pub fn withdraw_balance(ctx: Context<WithdrawBalance>) -> Result<()> {
        let card = &ctx.accounts.card;
        
        require!(!card.is_active, AurexError::CardStillActive);
        require!(card.balance > 0, AurexError::NoBalanceToWithdraw);
        
        let seeds = &[
            b"card".as_ref(),
            card.owner.as_ref(),
            card.id.as_bytes(),
            &[card.bump],
        ];
        let signer = &[&seeds[..]];
        
        let transfer_instruction = Transfer {
            from: ctx.accounts.card_escrow_account.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: card.to_account_info(),
        };
        
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                transfer_instruction,
                signer,
            ),
            card.balance,
        )?;
        
        emit!(BalanceWithdrawn {
            card_pubkey: card.key(),
            amount: card.balance,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }
}

// Account structures
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + BridgeState::LEN,
        seeds = [b"bridge_state"],
        bump
    )]
    pub bridge_state: Account<'info, BridgeState>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(card_id: String)]
pub struct CreateCard<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + Card::LEN,
        seeds = [b"card", owner.key().as_ref(), card_id.as_bytes()],
        bump
    )]
    pub card: Account<'info, Card>,
    #[account(
        init,
        payer = owner,
        seeds = [b"escrow", card.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = card,
    )]
    pub card_escrow_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub bridge_state: Account<'info, BridgeState>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct TopUpCard<'info> {
    #[account(mut, has_one = owner)]
    pub card: Account<'info, Card>,
    #[account(
        mut,
        seeds = [b"escrow", card.key().as_ref()],
        bump,
    )]
    pub card_escrow_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ProcessPayment<'info> {
    #[account(mut, has_one = owner)]
    pub card: Account<'info, Card>,
    #[account(
        mut,
        seeds = [b"escrow", card.key().as_ref()],
        bump,
    )]
    pub card_escrow_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub merchant_token_account: Account<'info, TokenAccount>,
    /// CHECK: This is the merchant's public key for reference
    pub merchant: AccountInfo<'info>,
    pub owner: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct DeactivateCard<'info> {
    #[account(mut, has_one = owner)]
    pub card: Account<'info, Card>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct WithdrawBalance<'info> {
    #[account(mut, has_one = owner)]
    pub card: Account<'info, Card>,
    #[account(
        mut,
        seeds = [b"escrow", card.key().as_ref()],
        bump,
    )]
    pub card_escrow_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    pub owner: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// Data structures
#[account]
pub struct BridgeState {
    pub authority: Pubkey,
    pub total_cards: u64,
    pub bump: u8,
}

impl BridgeState {
    pub const LEN: usize = 32 + 8 + 1;
}

#[account]
pub struct Card {
    pub id: String,          // 32 bytes (4 + 28)
    pub owner: Pubkey,       // 32 bytes
    pub balance: u64,        // 8 bytes
    pub balance_limit: u64,  // 8 bytes
    pub is_active: bool,     // 1 byte
    pub metadata: String,    // 260 bytes (4 + 256)
    pub created_at: i64,     // 8 bytes
    pub bump: u8,            // 1 byte
}

impl Card {
    pub const LEN: usize = 4 + 32 + 32 + 8 + 8 + 1 + 4 + 256 + 8 + 1;
}

// Events
#[event]
pub struct CardCreated {
    pub card_pubkey: Pubkey,
    pub owner: Pubkey,
    pub card_id: String,
    pub balance_limit: u64,
}

#[event]
pub struct CardToppedUp {
    pub card_pubkey: Pubkey,
    pub amount: u64,
    pub new_balance: u64,
}

#[event]
pub struct PaymentProcessed {
    pub card_pubkey: Pubkey,
    pub merchant: Pubkey,
    pub amount: u64,
    pub merchant_reference: String,
    pub remaining_balance: u64,
    pub timestamp: i64,
}

#[event]
pub struct CardDeactivated {
    pub card_pubkey: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct BalanceWithdrawn {
    pub card_pubkey: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

// Error codes
#[error_code]
pub enum AurexError {
    #[msg("Card ID is too long (max 32 characters)")]
    CardIdTooLong,
    #[msg("Metadata is too long (max 256 characters)")]
    MetadataTooLong,
    #[msg("Card is inactive")]
    CardInactive,
    #[msg("Balance limit exceeded")]
    BalanceLimitExceeded,
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("Merchant reference is too long (max 64 characters)")]
    MerchantReferenceTooLong,
    #[msg("Card is still active")]
    CardStillActive,
    #[msg("No balance to withdraw")]
    NoBalanceToWithdraw,
}
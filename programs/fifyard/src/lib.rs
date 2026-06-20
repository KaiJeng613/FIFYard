use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_pack::Pack;
use anchor_spl::token::{spl_token, Mint};
use std::collections::BTreeSet;

declare_id!("6Ew7FSCCyS5EG5gkJ8TTq7Hbjy7tpB5tBVhRPmKnfujB");

const MAX_NAME_LEN: usize = 32;
const MAX_URI_LEN: usize = 160;
const MAX_FORMATION_LEN: usize = 8;
const COUNTRY_CODE_LEN: usize = 3;
const STARTING_VERSION: u32 = 1;

#[program]
pub mod fifyard {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.next_player_id = 0;
        config.player_count = 0;
        config.bump = ctx.bumps.config;
        Ok(())
    }

    pub fn create_player(
        ctx: Context<CreatePlayer>,
        name: String,
        position: Position,
        stats: PlayerStats,
        metadata_uri: String,
    ) -> Result<()> {
        require!(name.as_bytes().len() <= MAX_NAME_LEN, FifyardError::NameTooLong);
        require!(metadata_uri.as_bytes().len() <= MAX_URI_LEN, FifyardError::UriTooLong);
        stats.validate()?;

        let config = &mut ctx.accounts.config;
        let player = &mut ctx.accounts.player;
        player.id = config.next_player_id;
        player.authority = config.authority;
        player.mint = ctx.accounts.mint.key();
        player.name = name;
        player.position = position;
        player.stats = stats;
        player.overall = stats.overall_for(position);
        player.metadata_uri = metadata_uri;
        player.version = STARTING_VERSION;
        player.updated_at = Clock::get()?.unix_timestamp;
        player.bump = ctx.bumps.player;

        config.next_player_id = config
            .next_player_id
            .checked_add(1)
            .ok_or(FifyardError::MathOverflow)?;
        config.player_count = config
            .player_count
            .checked_add(1)
            .ok_or(FifyardError::MathOverflow)?;
        Ok(())
    }

    pub fn update_player_stats(
        ctx: Context<UpdatePlayerStats>,
        stats: PlayerStats,
        metadata_uri: Option<String>,
    ) -> Result<()> {
        stats.validate()?;
        if let Some(uri) = &metadata_uri {
            require!(uri.as_bytes().len() <= MAX_URI_LEN, FifyardError::UriTooLong);
        }

        let player = &mut ctx.accounts.player;
        player.stats = stats;
        player.overall = stats.overall_for(player.position);
        if let Some(uri) = metadata_uri {
            player.metadata_uri = uri;
        }
        player.version = player.version.checked_add(1).ok_or(FifyardError::MathOverflow)?;
        player.updated_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn create_squad(
        ctx: Context<CreateSquad>,
        squad_id: u32,
        name: String,
        formation: String,
        country_code: String,
        opponent_rating: u8,
        player_ids: [u32; 11],
    ) -> Result<()> {
        require!(name.as_bytes().len() <= MAX_NAME_LEN, FifyardError::NameTooLong);
        require!(formation.as_bytes().len() <= MAX_FORMATION_LEN, FifyardError::InvalidFormation);
        require!(is_supported_formation(&formation), FifyardError::InvalidFormation);
        require!(is_country_code(&country_code), FifyardError::InvalidCountryCode);
        require!(opponent_rating <= 100, FifyardError::StatOutOfRange);
        require!(ctx.remaining_accounts.len() == 22, FifyardError::ElevenPlayersRequired);

        let unique: BTreeSet<u32> = player_ids.iter().copied().collect();
        require!(unique.len() == 11, FifyardError::DuplicatePlayer);

        let mut position_counts = [0_u8; 4];
        let mut total_rating = 0_u16;
        for (index, account_pair) in ctx.remaining_accounts.chunks_exact(2).enumerate() {
            let player_info = &account_pair[0];
            let token_info = &account_pair[1];
            require_keys_eq!(*player_info.owner, crate::ID, FifyardError::InvalidPlayerAccount);
            require_keys_eq!(*token_info.owner, spl_token::ID, FifyardError::InvalidTokenAccount);

            let player = Player::try_deserialize(&mut &player_info.data.borrow()[..])?;
            require!(player.id == player_ids[index], FifyardError::PlayerOrderMismatch);
            let token_account = spl_token::state::Account::unpack(&token_info.data.borrow())?;
            require_keys_eq!(token_account.owner, ctx.accounts.owner.key(), FifyardError::PlayerNotOwned);
            require_keys_eq!(token_account.mint, player.mint, FifyardError::PlayerNotOwned);
            require!(token_account.amount >= 1, FifyardError::PlayerNotOwned);
            position_counts[player.position as usize] += 1;
            total_rating = total_rating
                .checked_add(player.overall as u16)
                .ok_or(FifyardError::MathOverflow)?;
        }
        require!(position_counts == formation_counts(&formation)?, FifyardError::InvalidLineup);

        let squad = &mut ctx.accounts.squad;
        squad.owner = ctx.accounts.owner.key();
        squad.squad_id = squad_id;
        let rating = (total_rating / 11) as u8;
        squad.name = name;
        squad.formation = formation;
        squad.country_code = country_code;
        squad.player_ids = player_ids;
        squad.rating = rating;
        squad.opponent_rating = opponent_rating;
        squad.predicted_win_bps = predicted_win_bps(rating, opponent_rating);
        squad.created_at = Clock::get()?.unix_timestamp;
        squad.bump = ctx.bumps.squad;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Config::INIT_SPACE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreatePlayer<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        has_one = authority
    )]
    pub config: Account<'info, Config>,
    #[account(
        init,
        payer = authority,
        space = 8 + Player::INIT_SPACE,
        seeds = [b"player", &config.next_player_id.to_le_bytes()],
        bump
    )]
    pub player: Account<'info, Player>,
    #[account(
        constraint = mint.decimals == 0 @ FifyardError::InvalidNftMint,
        constraint = mint.supply == 1 @ FifyardError::InvalidNftMint
    )]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePlayerStats<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = authority)]
    pub config: Account<'info, Config>,
    #[account(mut, has_one = authority)]
    pub player: Account<'info, Player>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(squad_id: u32)]
pub struct CreateSquad<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + Squad::INIT_SPACE,
        seeds = [b"squad", owner.key().as_ref(), &squad_id.to_le_bytes()],
        bump
    )]
    pub squad: Account<'info, Squad>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub authority: Pubkey,
    pub next_player_id: u32,
    pub player_count: u32,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Player {
    pub id: u32,
    pub authority: Pubkey,
    pub mint: Pubkey,
    #[max_len(32)]
    pub name: String,
    pub position: Position,
    pub stats: PlayerStats,
    pub overall: u8,
    #[max_len(160)]
    pub metadata_uri: String,
    pub version: u32,
    pub updated_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Squad {
    pub owner: Pubkey,
    pub squad_id: u32,
    #[max_len(32)]
    pub name: String,
    #[max_len(8)]
    pub formation: String,
    #[max_len(3)]
    pub country_code: String,
    pub player_ids: [u32; 11],
    pub rating: u8,
    pub opponent_rating: u8,
    pub predicted_win_bps: u16,
    pub created_at: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace, PartialEq, Eq)]
pub enum Position {
    Goalkeeper,
    Defender,
    Midfielder,
    Forward,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace, PartialEq, Eq)]
pub struct PlayerStats {
    pub pace: u8,
    pub shooting: u8,
    pub passing: u8,
    pub dribbling: u8,
    pub defending: u8,
    pub stamina: u8,
}

impl PlayerStats {
    fn validate(&self) -> Result<()> {
        let values = [self.pace, self.shooting, self.passing, self.dribbling, self.defending, self.stamina];
        require!(values.iter().all(|value| *value <= 100), FifyardError::StatOutOfRange);
        Ok(())
    }

    fn overall_for(&self, position: Position) -> u8 {
        let weighted = match position {
            Position::Goalkeeper => self.defending as u16 * 45 + self.passing as u16 * 20 + self.stamina as u16 * 20 + self.pace as u16 * 15,
            Position::Defender => self.defending as u16 * 40 + self.stamina as u16 * 20 + self.pace as u16 * 15 + self.passing as u16 * 15 + self.dribbling as u16 * 10,
            Position::Midfielder => self.passing as u16 * 30 + self.dribbling as u16 * 25 + self.stamina as u16 * 20 + self.pace as u16 * 10 + self.shooting as u16 * 10 + self.defending as u16 * 5,
            Position::Forward => self.shooting as u16 * 35 + self.pace as u16 * 25 + self.dribbling as u16 * 20 + self.stamina as u16 * 10 + self.passing as u16 * 10,
        };
        (weighted / 100) as u8
    }
}

fn is_supported_formation(formation: &str) -> bool {
    matches!(formation, "4-3-3" | "4-4-2" | "3-5-2" | "4-2-3-1")
}

fn is_country_code(country_code: &str) -> bool {
    country_code.len() == COUNTRY_CODE_LEN
        && country_code.bytes().all(|byte| byte.is_ascii_uppercase())
}

fn predicted_win_bps(team_rating: u8, opponent_rating: u8) -> u16 {
    let difference = team_rating as i32 - opponent_rating as i32;
    (5_000 + difference * 350).clamp(500, 9_500) as u16
}

fn formation_counts(formation: &str) -> Result<[u8; 4]> {
    match formation {
        "4-3-3" => Ok([1, 4, 3, 3]),
        "4-4-2" => Ok([1, 4, 4, 2]),
        "3-5-2" => Ok([1, 3, 5, 2]),
        "4-2-3-1" => Ok([1, 4, 5, 1]),
        _ => err!(FifyardError::InvalidFormation),
    }
}

#[error_code]
pub enum FifyardError {
    #[msg("Player or squad name is too long")]
    NameTooLong,
    #[msg("Metadata URI is too long")]
    UriTooLong,
    #[msg("Every statistic must be between 0 and 100")]
    StatOutOfRange,
    #[msg("Exactly eleven player and token-account pairs are required")]
    ElevenPlayersRequired,
    #[msg("A player cannot appear twice in a squad")]
    DuplicatePlayer,
    #[msg("The formation is not supported")]
    InvalidFormation,
    #[msg("Country code must contain exactly three uppercase ASCII letters")]
    InvalidCountryCode,
    #[msg("The lineup does not satisfy positional requirements")]
    InvalidLineup,
    #[msg("A supplied account is not a FIFYard player")]
    InvalidPlayerAccount,
    #[msg("A supplied account is not a classic SPL Token account")]
    InvalidTokenAccount,
    #[msg("The squad owner does not hold this player's NFT")]
    PlayerNotOwned,
    #[msg("The player mint must have zero decimals and a supply of one")]
    InvalidNftMint,
    #[msg("Player accounts must be supplied in the same order as player IDs")]
    PlayerOrderMismatch,
    #[msg("Arithmetic overflow")]
    MathOverflow,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn forward_rating_prioritizes_attack() {
        let stats = PlayerStats { pace: 90, shooting: 95, passing: 80, dribbling: 92, defending: 30, stamina: 85 };
        assert_eq!(stats.overall_for(Position::Forward), 89);
    }

    #[test]
    fn formations_are_allowlisted() {
        assert!(is_supported_formation("4-3-3"));
        assert!(!is_supported_formation("1-1-8"));
        assert_eq!(formation_counts("4-3-3").unwrap(), [1, 4, 3, 3]);
    }

    #[test]
    fn prediction_is_deterministic_and_bounded() {
        assert_eq!(predicted_win_bps(90, 90), 5_000);
        assert_eq!(predicted_win_bps(100, 50), 9_500);
        assert!(is_country_code("MAS"));
        assert!(!is_country_code("Malaysia"));
    }
}

#!/usr/bin/env python3
import re

with open('programs/litterbox-v2/src/lib.rs', 'r') as f:
    content = f.read()

# Add CHECK comments before UncheckedAccount fields in GraduateToReal
content = content.replace(
    'pub vault_authority: UncheckedAccount<\'info>,\n    #[account(mut)]\n    pub raydium_usdc_vault: UncheckedAccount<\'info>,',
    'pub vault_authority: UncheckedAccount<\'info>,\n    /// CHECK: Raydium USDC vault - verified by Raydium program\n    #[account(mut)]\n    pub raydium_usdc_vault: UncheckedAccount<\'info>,'
)

content = content.replace(
    'pub raydium_usdc_vault: UncheckedAccount<\'info>,\n    #[account(mut)]\n    pub raydium_litter_vault: UncheckedAccount<\'info>,',
    'pub raydium_usdc_vault: UncheckedAccount<\'info>,\n    /// CHECK: Raydium LITTER vault - verified by Raydium program\n    #[account(mut)]\n    pub raydium_litter_vault: UncheckedAccount<\'info>,'
)

content = content.replace(
    'pub raydium_litter_vault: UncheckedAccount<\'info>,\n    #[account(mut)]\n    pub raydium_pool: UncheckedAccount<\'info>,',
    'pub raydium_litter_vault: UncheckedAccount<\'info>,\n    /// CHECK: Raydium pool account - verified by Raydium program\n    #[account(mut)]\n    pub raydium_pool: UncheckedAccount<\'info>,'
)

content = content.replace(
    'pub raydium_pool: UncheckedAccount<\'info>,\n    #[account(',
    'pub raydium_pool: UncheckedAccount<\'info>,\n    /// CHECK: Raydium CPMM program - verified by constraint\n    #[account('
)

with open('programs/litterbox-v2/src/lib.rs', 'w') as f:
    f.write(content)

print("Added CHECK comments successfully!")

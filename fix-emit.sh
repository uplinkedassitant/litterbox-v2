#!/bin/bash
# Fix the emit! stack overflow in lib.rs

FILE="/home/jay/.openclaw/workspace/litterbox-v2/programs/litterbox-v2/src/lib.rs"

# Replace the emit! call with boxed version
sed -i 's/pool.bump = 0; emit!(ProtocolInitialized { authority: config.authority,/pool.bump = 0;\n    let event = Box::new(ProtocolInitialized {\n      authority: config.authority,/' "$FILE"
sed -i 's/litter_mint: config.litter_mint,/litter_mint: config.litter_mint,/' "$FILE"
sed -i 's/graduation_threshold: config.graduation_threshold,/graduation_threshold: config.graduation_threshold,/' "$FILE"
sed -i 's/virtual_initial_usdc: params.virtual_initial_usdc,/virtual_initial_usdc: params.virtual_initial_usdc,/' "$FILE"
sed -i 's/virtual_initial_litter: params.virtual_initial_litter, });/virtual_initial_litter: params.virtual_initial_litter,\n    });\n    emit!(*event);/' "$FILE"

echo "Fixed! Now rebuild with: anchor clean && anchor build --provider.cluster devnet"

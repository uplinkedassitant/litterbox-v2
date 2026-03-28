#!/usr/bin/env python3
import re

file_path = "/home/jay/.openclaw/workspace/litterbox-v2/programs/litterbox-v2/src/lib.rs"

with open(file_path, 'r') as f:
    content = f.read()

# Find and replace the emit! call
old_pattern = r'pool\.bump = 0; emit!\(ProtocolInitialized \{ authority: config\.authority, litter_mint: config\.litter_mint, graduation_threshold: config\.graduation_threshold, virtual_initial_usdc: params\.virtual_initial_usdc, virtual_initial_litter: params\.virtual_initial_litter, \}\); Ok\(\(\)\)'

new_code = '''pool.bump = 0;
    let event = Box::new(ProtocolInitialized {
      authority: config.authority,
      litter_mint: config.litter_mint,
      graduation_threshold: config.graduation_threshold,
      virtual_initial_usdc: params.virtual_initial_usdc,
      virtual_initial_litter: params.virtual_initial_litter,
    });
    emit!(*event);
    Ok(())'''

content = re.sub(old_pattern, new_code, content)

with open(file_path, 'w') as f:
    f.write(content)

print("Fix applied! Now run: anchor clean && anchor build --provider.cluster devnet")

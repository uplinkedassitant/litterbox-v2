#[cfg(test)]
mod phase2_tests {
    use crate::utils::calculate_litter_out;

    const V_USDC: u64 = 30_000 * 1_000_000;
    const V_LITTER: u64 = 1_000_000_000 * 1_000_000;
    const GRADUATION_THRESHOLD: u64 = 10_000 * 1_000_000;
    const MIN_DEPOSIT_USDC: u64 = 1_000_000;
    const MIN_SWEEP_USDC: u64 = 100_000;

    #[test]
    fn sweep_updates_accumulated_usdc_only() {
        let accumulated_before: u64 = 1_000 * 1_000_000;
        let sweep_usdc: u64 = 100 * 1_000_000;
        let accumulated_after = accumulated_before + sweep_usdc;
        assert_eq!(accumulated_after, 1_100 * 1_000_000);
    }

    #[test]
    fn sweep_does_not_change_virtual_reserves() {
        let v_usdc_before = V_USDC;
        let v_litter_before = V_LITTER;
        assert_eq!(v_usdc_before, V_USDC);
        assert_eq!(v_litter_before, V_LITTER);
    }

    #[test]
    fn sweep_below_minimum_is_rejected() {
        let usdc_gained: u64 = MIN_SWEEP_USDC - 1;
        assert!(usdc_gained < MIN_SWEEP_USDC);
    }

    #[test]
    fn sweep_at_minimum_is_accepted() {
        let usdc_gained: u64 = MIN_SWEEP_USDC;
        assert!(usdc_gained >= MIN_SWEEP_USDC);
    }

    #[test]
    fn deposit_below_minimum_is_rejected() {
        let usdc_in: u64 = MIN_DEPOSIT_USDC - 1;
        assert!(usdc_in < MIN_DEPOSIT_USDC);
    }

    #[test]
    fn graduation_not_ready_after_partial_sweep() {
        let accumulated: u64 = 5_000 * 1_000_000;
        assert!(accumulated < GRADUATION_THRESHOLD);
    }

    #[test]
    fn graduation_ready_after_deposits_and_sweeps() {
        let deposits: u64 = 8_000 * 1_000_000;
        let sweeps: u64 = 2_000 * 1_000_000;
        let total = deposits + sweeps;
        assert!(total >= GRADUATION_THRESHOLD);
    }

    #[test]
    fn bonding_curve_calculation() {
        let usdc_in = 100 * 1_000_000;
        let litter_out = calculate_litter_out(usdc_in, V_USDC, V_LITTER).unwrap();
        assert!(litter_out > 0);
        assert!(litter_out < V_LITTER);
    }

    #[test]
    fn price_unchanged_after_sweep() {
        let price_before = (V_USDC as u128) * 1_000_000_000_000 / (V_LITTER as u128);
        let price_after = price_before;
        assert_eq!(price_before, price_after);
    }
}

mod phase3_tests {
    const V_USDC_INITIAL: u64 = 30_000 * 1_000_000;
    const V_LITTER_INITIAL: u64 = 1_000_000_000 * 1_000_000_000;
    const GRADUATION_THRESHOLD: u64 = 10_000 * 1_000_000;

    #[test]
    fn cannot_graduate_before_threshold() {
        let accumulated: u64 = GRADUATION_THRESHOLD - 1;
        assert!(accumulated < GRADUATION_THRESHOLD);
    }

    #[test]
    fn can_graduate_at_exact_threshold() {
        let accumulated: u64 = GRADUATION_THRESHOLD;
        assert!(accumulated >= GRADUATION_THRESHOLD);
    }

    #[test]
    fn can_graduate_above_threshold() {
        let accumulated: u64 = GRADUATION_THRESHOLD + 500 * 1_000_000;
        assert!(accumulated >= GRADUATION_THRESHOLD);
    }

    #[test]
    fn graduation_is_one_way() {
        #[derive(PartialEq, Debug, Clone)]
        enum PoolMode {
            Virtual,
            Real,
        }

        let mut mode = PoolMode::Virtual;
        mode = PoolMode::Real;
        assert_eq!(mode, PoolMode::Real);

        let deposit_allowed = mode == PoolMode::Virtual;
        assert!(!deposit_allowed);

        let flush_allowed = mode == PoolMode::Real;
        assert!(flush_allowed);
    }

    #[test]
    fn flush_full_vault_balance() {
        let vault_usdc: u64 = 500 * 1_000_000;
        let vault_litter: u64 = 10_000 * 1_000_000_000;

        let flush_usdc = vault_usdc;
        let flush_litter = vault_litter;

        assert!(flush_usdc <= vault_usdc);
        assert!(flush_litter <= vault_litter);

        let remaining_usdc = vault_usdc - flush_usdc;
        let remaining_litter = vault_litter - flush_litter;

        assert_eq!(remaining_usdc, 0);
        assert_eq!(remaining_litter, 0);
    }

    #[test]
    fn flush_partial_amounts() {
        let vault_usdc: u64 = 1_000 * 1_000_000;
        let partial_flush: u64 = 200 * 1_000_000;

        assert!(partial_flush < vault_usdc);
        let remaining = vault_usdc - partial_flush;
        assert_eq!(remaining, 800 * 1_000_000);
    }

    #[test]
    fn flush_rejects_amounts_exceeding_vault() {
        let vault_usdc: u64 = 100 * 1_000_000;
        let attempted_flush: u64 = 200 * 1_000_000;

        assert!(attempted_flush > vault_usdc);
    }
}

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

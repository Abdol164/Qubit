#[test_only]
module qubit::registry_tests {
    use sui::test_scenario::{Self as ts};
    use qubit::registry::{Self, Registry, UserProfile};

    // Build a deterministic 1184-byte vector (valid ML-KEM-768 pk length per FIPS 203)
    fun make_pk(seed: u8): vector<u8> {
        let mut pk = vector[];
        let mut i = 0u64;
        while (i < 1184) {
            pk.push_back(seed);
            i = i + 1;
        };
        pk
    }

    // ===== 1. Happy-path registration =====

    #[test]
    fun test_register_success() {
        let alice = @0xA11CE;
        let mut scenario = ts::begin(alice);

        {
            registry::init_for_testing(ts::ctx(&mut scenario));
        };

        {
            ts::next_tx(&mut scenario, alice);
            let mut registry = ts::take_shared<Registry>(&scenario);
            registry::register(&mut registry, make_pk(42), ts::ctx(&mut scenario));
            ts::return_shared(registry);
        };

        {
            ts::next_tx(&mut scenario, alice);
            let registry = ts::take_shared<Registry>(&scenario);
            assert!(registry::is_registered(&registry, alice), 0);
            assert!(registry::get_public_key(&registry, alice) == make_pk(42), 1);
            ts::return_shared(registry);

            let profile = ts::take_from_sender<UserProfile>(&scenario);
            assert!(registry::profile_owner(&profile) == alice, 2);
            assert!(registry::profile_public_key(&profile) == make_pk(42), 3);
            ts::return_to_sender(&scenario, profile);
        };

        ts::end(scenario);
    }

    // ===== 2. Double registration is rejected =====

    #[test]
    #[expected_failure(abort_code = registry::EAlreadyRegistered)]
    fun test_register_duplicate_aborts() {
        let alice = @0xA11CE;
        let mut scenario = ts::begin(alice);

        { registry::init_for_testing(ts::ctx(&mut scenario)); };

        {
            ts::next_tx(&mut scenario, alice);
            let mut registry = ts::take_shared<Registry>(&scenario);
            registry::register(&mut registry, make_pk(1), ts::ctx(&mut scenario));
            ts::return_shared(registry);
        };

        {
            ts::next_tx(&mut scenario, alice);
            let mut registry = ts::take_shared<Registry>(&scenario);
            registry::register(&mut registry, make_pk(2), ts::ctx(&mut scenario));
            ts::return_shared(registry);
        };

        ts::end(scenario);
    }

    // ===== 3. Wrong key length is rejected =====

    #[test]
    #[expected_failure(abort_code = registry::EInvalidKeyLength)]
    fun test_register_wrong_key_length_aborts() {
        let alice = @0xA11CE;
        let mut scenario = ts::begin(alice);

        { registry::init_for_testing(ts::ctx(&mut scenario)); };

        {
            ts::next_tx(&mut scenario, alice);
            let mut registry = ts::take_shared<Registry>(&scenario);
            registry::register(&mut registry, b"too_short", ts::ctx(&mut scenario));
            ts::return_shared(registry);
        };

        ts::end(scenario);
    }

    // ===== 4. update_key success =====

    #[test]
    fun test_update_key_success() {
        let alice = @0xA11CE;
        let mut scenario = ts::begin(alice);

        { registry::init_for_testing(ts::ctx(&mut scenario)); };

        {
            ts::next_tx(&mut scenario, alice);
            let mut registry = ts::take_shared<Registry>(&scenario);
            registry::register(&mut registry, make_pk(10), ts::ctx(&mut scenario));
            ts::return_shared(registry);
        };

        {
            ts::next_tx(&mut scenario, alice);
            let mut registry = ts::take_shared<Registry>(&scenario);
            let mut profile = ts::take_from_sender<UserProfile>(&scenario);

            registry::update_key(&mut registry, &mut profile, make_pk(20), ts::ctx(&mut scenario));

            assert!(registry::profile_public_key(&profile) == make_pk(20), 0);
            assert!(registry::get_public_key(&registry, alice) == make_pk(20), 1);

            ts::return_shared(registry);
            ts::return_to_sender(&scenario, profile);
        };

        ts::end(scenario);
    }

    // ===== 5. update_key by non-owner is rejected =====

    #[test]
    #[expected_failure(abort_code = registry::ENotOwner)]
    fun test_update_key_non_owner_aborts() {
        let alice = @0xA11CE;
        let bob   = @0xB0B;
        let mut scenario = ts::begin(alice);

        { registry::init_for_testing(ts::ctx(&mut scenario)); };

        {
            ts::next_tx(&mut scenario, alice);
            let mut registry = ts::take_shared<Registry>(&scenario);
            registry::register(&mut registry, make_pk(1), ts::ctx(&mut scenario));
            ts::return_shared(registry);
        };

        {
            ts::next_tx(&mut scenario, bob);
            let mut registry = ts::take_shared<Registry>(&scenario);
            // test_scenario allows taking any address's object; production ownership prevents this
            let mut profile = ts::take_from_address<UserProfile>(&scenario, alice);
            registry::update_key(&mut registry, &mut profile, make_pk(99), ts::ctx(&mut scenario));
            ts::return_shared(registry);
            ts::return_to_address(alice, profile);
        };

        ts::end(scenario);
    }

    // ===== 6. get_public_key for unregistered address aborts =====

    #[test]
    #[expected_failure(abort_code = registry::ENotRegistered)]
    fun test_get_public_key_unregistered_aborts() {
        let alice   = @0xA11CE;
        let charlie = @0xC4A511E;
        let mut scenario = ts::begin(alice);

        { registry::init_for_testing(ts::ctx(&mut scenario)); };

        {
            ts::next_tx(&mut scenario, alice);
            let registry = ts::take_shared<Registry>(&scenario);
            let _pk = registry::get_public_key(&registry, charlie);
            ts::return_shared(registry);
        };

        ts::end(scenario);
    }

    // ===== 7. Two users register independently =====

    #[test]
    fun test_two_users_register() {
        let alice = @0xA11CE;
        let bob   = @0xB0B;
        let mut scenario = ts::begin(alice);

        { registry::init_for_testing(ts::ctx(&mut scenario)); };

        {
            ts::next_tx(&mut scenario, alice);
            let mut registry = ts::take_shared<Registry>(&scenario);
            registry::register(&mut registry, make_pk(1), ts::ctx(&mut scenario));
            ts::return_shared(registry);
        };

        {
            ts::next_tx(&mut scenario, bob);
            let mut registry = ts::take_shared<Registry>(&scenario);
            registry::register(&mut registry, make_pk(2), ts::ctx(&mut scenario));
            ts::return_shared(registry);
        };

        {
            ts::next_tx(&mut scenario, alice);
            let registry = ts::take_shared<Registry>(&scenario);
            assert!(registry::is_registered(&registry, alice), 0);
            assert!(registry::is_registered(&registry, bob), 1);
            assert!(registry::get_public_key(&registry, alice) == make_pk(1), 2);
            assert!(registry::get_public_key(&registry, bob) == make_pk(2), 3);
            ts::return_shared(registry);
        };

        ts::end(scenario);
    }
}

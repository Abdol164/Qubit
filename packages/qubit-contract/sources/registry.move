#[allow(lint(self_transfer))]
module qubit::registry {
    use sui::table::{Self, Table};
    use sui::event;

    // ===== Error codes =====

    const EAlreadyRegistered: u64 = 1;
    const ENotOwner: u64          = 2;
    const ENotRegistered: u64     = 3;
    const EInvalidKeyLength: u64  = 4;

    // ML-KEM-768 public key length per FIPS 203
    const MLKEM768_PK_LENGTH: u64 = 1184;

    // ===== Structs =====

    /// Shared singleton. Holds two parallel tables so get_public_key can do a
    /// direct O(1) lookup without resolving object IDs (not possible in Move).
    public struct Registry has key {
        id: UID,
        profiles: Table<address, ID>,
        public_keys: Table<address, vector<u8>>,
    }

    /// Owned by the registering user. Required to call update_key.
    public struct UserProfile has key, store {
        id: UID,
        owner: address,
        mlkem_public_key: vector<u8>,
        created_at: u64,
    }

    // ===== Events =====

    public struct KeyRegistered has copy, drop {
        owner: address,
        profile_id: ID,
    }

    public struct KeyUpdated has copy, drop {
        owner: address,
        profile_id: ID,
    }

    // ===== Init =====

    fun init(ctx: &mut TxContext) {
        let registry = Registry {
            id: object::new(ctx),
            profiles: table::new(ctx),
            public_keys: table::new(ctx),
        };
        transfer::share_object(registry);
    }

    // ===== Entry functions =====

    /// Register the caller's ML-KEM-768 public key on-chain.
    /// Caller must not already have a profile. Key must be exactly 1184 bytes.
    public fun register(
        registry: &mut Registry,
        public_key: vector<u8>,
        ctx: &mut TxContext,
    ) {
        let sender = ctx.sender();
        assert!(!table::contains(&registry.profiles, sender), EAlreadyRegistered);
        assert!(public_key.length() == MLKEM768_PK_LENGTH, EInvalidKeyLength);

        let profile_uid = object::new(ctx);
        let profile_id = object::uid_to_inner(&profile_uid);

        table::add(&mut registry.profiles, sender, profile_id);
        table::add(&mut registry.public_keys, sender, public_key);

        event::emit(KeyRegistered { owner: sender, profile_id });

        let profile = UserProfile {
            id: profile_uid,
            owner: sender,
            mlkem_public_key: *table::borrow(&registry.public_keys, sender),
            created_at: ctx.epoch(),
        };
        transfer::transfer(profile, sender);
    }

    /// Update the caller's ML-KEM-768 public key.
    /// Caller must own the UserProfile. Both the profile and registry table are updated.
    public fun update_key(
        registry: &mut Registry,
        profile: &mut UserProfile,
        new_key: vector<u8>,
        ctx: &mut TxContext,
    ) {
        let sender = ctx.sender();
        assert!(profile.owner == sender, ENotOwner);
        assert!(table::contains(&registry.public_keys, sender), ENotRegistered);
        assert!(new_key.length() == MLKEM768_PK_LENGTH, EInvalidKeyLength);

        profile.mlkem_public_key = new_key;
        *table::borrow_mut(&mut registry.public_keys, sender) = profile.mlkem_public_key;

        event::emit(KeyUpdated {
            owner: sender,
            profile_id: object::uid_to_inner(&profile.id),
        });
    }

    // ===== View functions =====

    public fun get_public_key(registry: &Registry, owner: address): vector<u8> {
        assert!(table::contains(&registry.public_keys, owner), ENotRegistered);
        *table::borrow(&registry.public_keys, owner)
    }

    public fun get_profile_id(registry: &Registry, owner: address): ID {
        assert!(table::contains(&registry.profiles, owner), ENotRegistered);
        *table::borrow(&registry.profiles, owner)
    }

    public fun is_registered(registry: &Registry, owner: address): bool {
        table::contains(&registry.profiles, owner)
    }

    // ===== UserProfile accessors =====

    public fun profile_owner(profile: &UserProfile): address           { profile.owner }
    public fun profile_public_key(profile: &UserProfile): vector<u8>  { profile.mlkem_public_key }
    public fun profile_created_at(profile: &UserProfile): u64         { profile.created_at }

    // ===== Test helpers =====

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
}

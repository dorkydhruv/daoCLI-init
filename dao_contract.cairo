%lang starknet

from starkware.cairo.common.cairo_builtins import HashBuiltin
from starkware.starknet.common.syscalls import get_caller_address, get_block_timestamp

@storage_var
func manager() -> felt:
end

@storage_var
func dao_token() -> felt:
end

@storage_var
func fundraise_target() -> felt:
end

@storage_var
func min_pool_price() -> felt:
end

@storage_var
func expiry_timestamp() -> felt:
end

@storage_var
func trading_active() -> felt:
end

@constructor
func constructor{
        syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr
    }(
        manager_: felt,
        dao_token_: felt,
        fundraise_target_: felt,
        min_pool_price_: felt,
        expiry_timestamp_: felt
    ):
    # Basic validations.
    assert manager_ != 0, 'Invalid manager'
    assert dao_token_ != 0, 'Invalid dao_token'
    assert fundraise_target_ > 0, 'Invalid fundraise target'
    assert min_pool_price_ > 0, 'Invalid min pool price'
    let current_time = get_block_timestamp()
    assert expiry_timestamp_ > current_time, 'Invalid expiry'
    manager.write(manager_)
    dao_token.write(dao_token_)
    fundraise_target.write(fundraise_target_)
    min_pool_price.write(min_pool_price_)
    expiry_timestamp.write(expiry_timestamp_)
    trading_active.write(0)
    return ()
end

@external
func create_pool{
        syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr
    }(sol_amount: felt, token_amount: felt) -> ():
    # Only the manager can call this.
    let caller = get_caller_address()
    let mgr = manager.read()
    assert caller == mgr, 'UNAUTHORIZED'
    assert sol_amount > 0, 'Invalid sol amount'
    assert token_amount > 0, 'Invalid token amount'
    trading_active.write(1)
    return ()
end

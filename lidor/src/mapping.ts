import { BigInt } from "@graphprotocol/graph-ts"
import {
  identity,
  BlacklistAdded,
  BlacklistRemoved,
  ContractAdded,
  ContractRemoved,
  IdentityAdminAdded,
  IdentityAdminRemoved,
  OwnershipTransferred,
  Paused,
  PauserAdded,
  PauserRemoved,
  Unpaused,
  WhitelistedAdded,
  WhitelistedRemoved,
  AuthenticateCall
} from "../generated/identity/identity"
import { ExampleEntity } from "../generated/schema"

export function handleBlacklistAdded(event: BlacklistAdded): void {
  // Entities can be loaded from the store using a string ID; this ID
  // needs to be unique across all entities of the same type
  let entity = ExampleEntity.load(event.transaction.from.toHex())

  // Entities only exist after they have been saved to the store;
  // `null` checks allow to create entities on demand
  if (entity == null) {
    entity = new ExampleEntity(event.transaction.from.toHex())

    // Entity fields can be set using simple assignments
    entity.count = BigInt.fromI32(0)
  }

  // BigInt and BigDecimal math are supported
  entity.count = entity.count + BigInt.fromI32(1)

  // Entity fields can be set based on event parameters
  entity.account = event.params.account

  // Entities can be written to the store with `.save()`
  entity.save()

  // Note: If a handler doesn't require existing field values, it is faster
  // _not_ to load the entity from the store. Instead, create it fresh with
  // `new Entity(...)`, set the fields that should be updated and save the
  // entity back to the store. Fields that were not set or unset remain
  // unchanged, allowing for partial updates to be applied.

  // It is also possible to access smart contracts from mappings. For
  // example, the contract that has emitted the event can be connected to
  // with:
  //
  // let contract = Contract.bind(event.address)
  //
  // The following functions can then be called on this contract to access
  // state variables and other data:
  //
  // - contract.addIdentityAdmin(...)
  // - contract.addrToDID(...)
  // - contract.authenticationPeriod(...)
  // - contract.dateAdded(...)
  // - contract.dateAuthenticated(...)
  // - contract.didHashToAddress(...)
  // - contract.isIdentityAdmin(...)
  // - contract.isOwner(...)
  // - contract.isPauser(...)
  // - contract.isRegistered(...)
  // - contract.isRegistered(...)
  // - contract.owner(...)
  // - contract.paused(...)
  // - contract.removeIdentityAdmin(...)
  // - contract.whitelistedContracts(...)
  // - contract.whitelistedCount(...)
  // - contract.isWhitelisted(...)
  // - contract.lastAuthenticated(...)
  // - contract.isDAOContract(...)
  // - contract.isBlacklisted(...)
}

export function handleBlacklistRemoved(event: BlacklistRemoved): void {}

export function handleContractAdded(event: ContractAdded): void {}

export function handleContractRemoved(event: ContractRemoved): void {}

export function handleIdentityAdminAdded(event: IdentityAdminAdded): void {}

export function handleIdentityAdminRemoved(event: IdentityAdminRemoved): void {}

export function handleOwnershipTransferred(event: OwnershipTransferred): void {}

export function handlePaused(event: Paused): void {}

export function handlePauserAdded(event: PauserAdded): void {}

export function handlePauserRemoved(event: PauserRemoved): void {}

export function handleUnpaused(event: Unpaused): void {}

export function handleWhitelistedAdded(event: WhitelistedAdded): void {}

export function handleWhitelistedRemoved(event: WhitelistedRemoved): void {}

export function handleAuthenticate(call: AuthenticateCall): void {
  let entity = ExampleEntity.load(call.transaction.from.toHex())
  if (entity == null) {
    entity = new ExampleEntity(call.transaction.from.toHex())
    entity.count = BigInt.fromI32(0)
  }
  entity.count = entity.count + BigInt.fromI32(1)
  entity.account = call.params.account
  entity.save()

  let citizen = Citizen.load(call.transcation.from.toHex())
  if (citizen == null) {
    citizen = new Citizen(call.transaction.from.toHex())
  }
  citizen.account = call.params.account
  citizen.lastAuthenticated = call.block.timestamp
  citizen.save()
}
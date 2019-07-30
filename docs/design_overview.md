# Learn about GoodDollar
Welcome to the GoodDollar repository! The [GoodDollar](https://www.gooddollar.org/#what-is-GoodDollar) mission is to build a new, global, open-source cryptocurrency – called GoodDollar – to distribute money using the principles of universal basic income (UBI), reducing wealth inequality. To learn more about the political position of the GoodDollar Experiment read the [Position Paper](https://www.gooddollar.org/wp-content/uploads/2018/11/GD-Wealth-Distribution-Position-Paper.pdf).

In this document, we present the on going development efforts and specification of the extended design of the GoodDollar contract system.

This specification is subject to ongoing development and frequent review. This test may not reflect the most recent commits to this repo. 

## GoodDollar Design Overview

In the Table presented below, we provide an overview of the extended design of the GoodDollar contract system suggested for this specification.

![overview](images/SystemOverview.svg)

*__Figure 1:__ Design overview of the GoodContracts system*

# GoodDollar Contract System: Key Concepts

The GoodDollar contract system is a decentralized autonomous organization consisting of four main components:

## Token
The GoodDollar is a mintable, burnable and ERC20 compatible token. The GoodDollar token can collect an adjustable fee stored in a reserve, whenever a transaction is made.


## DAU
The DAU is a decentralized decision-making and ressource distribution mechanism. It contains four elements: 

* Schemes -   A "scheme" is a 'wrapper' enacting a given policy or functionality in the GoodDollar contract system. Schemes are deployed and elected by the DAU contract through a re-defineable voting mechanisms. The UBI distribution policy, the one-time payment link policy, the sign-up bonus policy, and the identity contract are all currently implemented as 'schemes' and can be reiterated and redployed by the GoodDollar community. 


* Voting Mechanism - Proposals are approved or rejected through voting. Rules can be implemented for any voting process, from a simple vote to an absolute vote where 51% of voting power is required for approval.


* Reputation points - Reputation points are awarded to user accounts by the DAU, based on their contribution to the system, as defined by the GoodDollar community. The balance of reputation points represents the influence each participant will hold in a given voting policy elected by the DAU. Reputation is non-transferable and (re)distributed by the DAU.


* Global Constraints - Global constraints are limitations the DAUs actions. When executing a scheme, the controller component checks the constraints to see if a given action violates them, and blocks the execution if it does. Some examples of constraints might be: the token supply can't be increased over 1M tokens, the organization won't use more than 60% of its funds at once, etc

## Bridge Contract
The bridge is an interoperability protocol that allows users to easily and safely transfer digital assets (coins, tokens) between different blockchain in the Ethereum ecosystem. In order for chains to interoperate, the assets are locked in one network while representative assets are minted in the other one, and when the process is reversed the representative assets are burned and the locked assets released.

## Sidechain
The GoodDollar system is currently implemented on a sidechain connected through the Bridge Contract. A sidechain is a blockchain that is independent and runs in parallel to the main net while being linked to it in a two-way connection. The main functionality provided by this solution is to perform an interchain transfer of tokens.


## Key Contract Taxonomy

In the Table presented below, we provide a simple overview of the GoodDollar contract and scheme taxonomy. Only the most fundemental schemes are included in the list below.

name | Description 
---- | ----------------
`GoodDollar` | ERC20 Token that collects fees in every transfer. Native token of the system
`DaoCreator` | Creates a single GoodDollar organization with an array of founders able to vote for schemes.
`Controller` | The central entity of the DAO which connects the Avatar and gives permission to the other contracts.
`Avatar` | A contract that receives the fee, stores it and communicates with the outer world
`UBI` | The Universal Basic Income calculating and processing contract scheme.
`SignUpBonus`| The sign-up bonus handling contract.
`OneTimePayments` | The one-time payment contract.
`Identity` | The contract defines who is eligible to claim the tokens and counts the total number of people who signed up for it.

### Token

The GoodDollar token is a mintable, burnable and ERC20 compatible token. What makes it different from other ERC20 tokens is that whenever a transfer is made it will collect some fees that will be stored in a reserve. 

Below are three main functions, that have been adopted from the standard framework in order to perform the actions necessary to allow the system to work.

name | Description | Working Priciple
| ------------- | ------------- | ------------- |
`transfer(to, value) / transferFrom(from, to, value)` | Gives the system the ability to collect fees. | Whenever transfer or transferFrom is called with a given value, processFees is called with said value, transferring the transactional fees (set by the DAO at any given time, by a specific scheme) to the feeRecipient and returning the new value to be transferred along.
`approve(spender, value)` | Gives a delegate the right to spend a certain amount of tokens of a delegator. The delegators retain the ownership of the tokens until they are spent. | no peculiarities
`balanceOf(user)` | It allows the system to know the G$ balance of a specific address. | no peculiarities 

Below, we display the GoodDollar transfer function sequence diagram, highlighting the details of the process.

![transfer](images/TransferFunction.svg)

*__Figure 2:__ Transfer function. Checks identity, then sends fees to avatar, which returns the new transfer value and sends it to the receiver.*

### DAU

Below, the most important elements of the DAU are introduced.

#### DaoCreator

The DaoCreator contract is responsible for creating the DAO in a single transaction. When creating a DAO, a Token(The GoodDollar token) and reputation are created, which are then used to create the avatar. The founders specified in the creation are then granted their respective tokens and reputation. The controller is then created and given ownership of the GoodDollar, Reputation and Avatar. The caller of the dao creation transaction is then allowed to register an array of initial schemes.

#### Controller
The Controller is the 'owner' of the DAO. It gives permission to other schemes, enforce adherence to global constraints, regulate the reputation points and most importantly it connects to the Avatar.

#### Avatar
The Avatar is the outer facing part of the DAO system, which interacts with the other  DAOs and contracts. The three main functions of the Avatar are to:

* Communicate with other contracts
* Receive the transaction fees 
* Store the fees and also other tokens (i.e., Ether)

#### UBI

A UBI scheme can be created by anyone and is designed to be used only one-time. A UBI scheme is proposed and then the users of the DAO vote for it (weighed by their reputation points), deciding which proposal they prefer. Once the decision is taken, the scheme will be eligble to start. The Controller then transfers the reserves from the Avatar to the UBI allowing the distribution. 

Initially, when the UBI is created the start and end periods are given. A bool, isActive, is set to false, making the policy ‘dormant’ until start() is called. Once the start() is called the UBI is active and the claiming process begins. First of all, the Reserve (Avatar) sends all its funds to the UBI contract, and the amount to mint indicated in the constructor is minted to the contract.

![UBIstates](images/UBIStates.svg)

*__Figure 3:__ The three states the UBI contract moves through*

Then the distribution ratio is calculated and isActive is set to true, allowing users registered as claimers before the start period to claim UBI. Thereafter, their claiming status is updated in order to prevent multiple claiming by the same claimer and then the G$ are transferred to the claimers.

![UBIsequence](images/UBISequenceDiagram.svg)

*__Figure 4:__ UBI claiming sequence diagram*

Finally, the end() function needs to be called in order to terminate the contract. This can only be done after the end period has been reached. Similarly to the start() function, the end() functions can be called by whoever is willing to pay the costs in exchange for reputation points. When the scheme ends, it transfers any and all remaining funds back to the reserve, leaving the scheme empty and 'useless'

### Sign-up bonus

The sign-up bonus is a scheme that actually mints new tokens every time a user claims tokens. This can only be done once per-claimer, and only by verified claimers.

### OneTimePayments

The OneTimePayments scheme takes care of allowing people who have GoodDollar to deposit some GoodDollar on a one-time payment address. Consequently, non-wallet holders will be able to withdraw the token automatically

### Identity

The identity scheme works as an access unit which allows admins to register and authenticate users. The identity defines who is eligible to claim UBI and counts the total number of people signed-up. The purpose of the Identity is solely to ensure that transactions performed are only done by users that have not been blacklisted, and that claims are only done by claimers. 



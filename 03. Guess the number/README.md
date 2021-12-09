# 03. Guess the number

I’m thinking of a number. All you have to do is guess it.

## Target contract

```js
pragma solidity ^0.4.21;

contract GuessTheNumberChallenge {
    uint8 answer = 42;

    function GuessTheNumberChallenge() public payable {
        require(msg.value == 1 ether);
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

The answer is simply given at `uint8 answer = 42;` and is used at `if (n == answer)` so we just need to send `42` to the `guess` function.

```js
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
  [42]
);

await web3.eth.sendTransaction({
  from: accounts[0],
  to: contract,
  data: data,
  value: web3.utils.toWei("1", "ether"),
});
```
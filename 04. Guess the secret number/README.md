# 04. Guess the secret number

Putting the answer in the code makes things a little too easy.

This time I’ve only stored the hash of the number. Good luck reversing a cryptographic hash!

## Target contract

```solidity
pragma solidity ^0.4.21;

contract GuessTheSecretNumberChallenge {
    bytes32 answerHash = 0xdb81b4d58595fbbbb592d3661a34cdca14d7ab379441400cbfa1b78bc447c365;

    function GuessTheSecretNumberChallenge() public payable {
        require(msg.value == 1 ether);
    }
    
    function isComplete() public view returns (bool) {
        return address(this).balance == 0;
    }

    function guess(uint8 n) public payable {
        require(msg.value == 1 ether);

        if (keccak256(n) == answerHash) {
            msg.sender.transfer(2 ether);
        }
    }
}
```

## Vulnerability

All we know from the code is that `keccak256(answer) == 0xdb81b4d58595fbbbb592d3661a34cdca14d7ab379441400cbfa1b78bc447c365`. But as `n` is of type `uint8` it means that there are only 256 possibilities, we can bruteforce that quite easily and guess the answer.


```js
const answerHash = "0xdb81b4d58595fbbbb592d3661a34cdca14d7ab379441400cbfa1b78bc447c365";
let answer = 0;

for (answer = 0; answer < 256; answer++) {
  if (web3.utils.soliditySha3({ t: "uint8", v: answer }) == answerHash) {
    break;
  }
}

console.log(`Answer is : ${answer}`);
// 170
```

All we need to do is send `170` to the `guess` function :

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
  [170]
);

await web3.eth.sendTransaction({
  from: accounts[0],
  to: contract,
  data: data,
  value: web3.utils.toWei("1", "ether"),
});
```

And submit the challenge !

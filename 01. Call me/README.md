# 01. Call me

To complete this challenge, all you need to do is call a function.

## Target contract 

```solidity
pragma solidity ^0.4.21;

contract CallMeChallenge {
    bool public isComplete = false;

    function callme() public {
        isComplete = true;
    }
}
```

Just call the `callme` function either through Remix, web3 or ethers :

```js
const data = web3.eth.abi.encodeFunctionSignature("callme()");
await web3.eth.sendTransaction({ from: accounts[0], to: contract, data: data });
```

And submit the challenge.


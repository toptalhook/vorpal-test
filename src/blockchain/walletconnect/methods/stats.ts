import { ethers } from "ethers";
import { network } from "../../config";
import { contractABIs } from "../../config";

export async function OpenBox(
  walletProvider: ethers.providers.ExternalProvider,
  _boxId: number
) {
  return new Promise(async (resolve, reject) => {
    const ethersProvider = new ethers.providers.Web3Provider(walletProvider);
    const signer = ethersProvider.getSigner();
    const BoxContract = new ethers.Contract(
      network.contracts.BoxNFT,
      contractABIs.BoxNFTAbi,
      signer
    );
	const randomValue = Math.round(Math.random() * 10000000);
    try {
      const tx = await BoxContract.openBox(String(_boxId), String(randomValue));
      const receipt = await ethersProvider.waitForTransaction(tx.hash);
        if (!receipt || !receipt.blockNumber) {
          reject("Transaction not included in block");
          return;
        }
      resolve(true);
    } catch (e) {
      reject("Failed to open: " + e.message);
    }
  });
}

export async function GenerateSignature(walletProvider: ethers.providers.ExternalProvider, account: string): Promise<string> {
  return new Promise (async (resolve, reject) => {
      if (!walletProvider) reject("Web3 not found!");
      const ethersProvider = new ethers.providers.Web3Provider(walletProvider);
      const signer = ethersProvider.getSigner();
      const dt = new Date().getTime();
      const signMsg = "auth_" + String(dt - (dt % 600000));
      try {
          const signature = await signer.signMessage(signMsg);
          resolve(signature);
      } catch (e) {
          reject("Sign failed : " + e.message)
      }
  })
}

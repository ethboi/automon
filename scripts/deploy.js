const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying AutoMonNFT with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // Base URI for metadata - update this to your production URL
  const baseURI = process.env.METADATA_BASE_URL || "https://automon.xyz/api/metadata/";

  const AutoMonNFT = await hre.ethers.getContractFactory("AutoMonNFT");
  const autoMonNFT = await AutoMonNFT.deploy(baseURI);

  await autoMonNFT.waitForDeployment();

  const contractAddress = await autoMonNFT.getAddress();

  console.log("AutoMonNFT deployed to:", contractAddress);
  console.log("Base URI:", baseURI);
  console.log("\nAdd this to your .env.local:");
  console.log(`AUTOMON_NFT_ADDRESS=${contractAddress}`);

  // Verify contract details
  console.log("\nContract Details:");
  console.log("- Pack Price: 0.1 MON");
  console.log("- Cards per Pack: 3");
  console.log("- Total AutoMon Types: 20");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
